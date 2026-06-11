/**
 * 信任度计算引擎
 * 
 * 公式: 患者信任度 = 认知水平 × 专业感知 × 安全感 × 障碍清除
 * 信任建立顺序: 安全感 → 专业度 → 归属感 → 成交
 * 
 * 每个维度得分 = Σ(该维度下各动作加权得分) / Σ(该维度下各动作权重×5) × 100
 * 总信任度 = (认知水平得分 × 专业感知得分 × 安全感得分 × 障碍清除得分) / 100^3
 */

// 信任维度定义
export const TRUST_ELEMENTS = ['认知水平', '专业感知', '安全感', '障碍清除'] as const;
export type TrustElement = typeof TRUST_ELEMENTS[number];

// 动作→信任维度映射
const ACTION_TRUST_MAP: Record<number, TrustElement> = {
  // 认知水平: 4,8,12,14
  4: '认知水平', 8: '认知水平', 12: '认知水平', 14: '认知水平',
  // 专业感知: 2,3,7,10,11,19
  2: '专业感知', 3: '专业感知', 7: '专业感知', 10: '专业感知', 11: '专业感知', 19: '专业感知',
  // 安全感: 1,9,13,15
  1: '安全感', 9: '安全感', 13: '安全感', 15: '安全感',
  // 障碍清除: 5,6,16,17,18
  5: '障碍清除', 6: '障碍清除', 16: '障碍清除', 17: '障碍清除', 18: '障碍清除',
};

// 动作权重 (v2新增动作权重1.5，其余1.0)
const ACTION_WEIGHTS: Record<number, number> = {
  1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0,
  5: 1.5, 6: 1.5, // v2新增
  7: 1.0, 8: 1.0, 9: 1.0,
  10: 1.5, // v2新增
  11: 1.0, 12: 1.0, 13: 1.0, 14: 1.0, 15: 1.0,
  16: 1.5, // v2新增
  17: 1.0, 18: 1.0, 19: 1.0,
};

// 节点权重
export const NODE_WEIGHTS: Record<number, number> = {
  1: 0.30, // 首通电话
  2: 0.25, // 用药第三天回访
  3: 0.30, // 用药第五天预约
  4: 0.15, // 面诊当天
};

// 评分输入
export interface ActionScoreInput {
  actionNo: number;
  score: number; // 0/2/3/4/5
  weight?: number;
}

// 信任度计算结果
export interface TrustScoreResult {
  cognitiveScore: number;       // 认知水平得分 (0-100)
  professionalScore: number;    // 专业感知得分 (0-100)
  safetyScore: number;          // 安全感得分 (0-100)
  obstacleClearanceScore: number; // 障碍清除得分 (0-100)
  totalTrust: number;           // 总信任度 (0-100)
  bottleneck: TrustElement;     // 瓶颈维度(最低分)
  suggestion: string;           // 改进建议
  elementDetails: Record<TrustElement, {
    actions: number[];
    totalWeight: number;
    achievedWeight: number;
    rawScore: number;
  }>;
}

/**
 * 计算单次质检的信任度得分
 */
export function calculateTrustScore(scores: ActionScoreInput[]): TrustScoreResult {
  // 按信任维度分组
  const elementScores: Record<TrustElement, { achieved: number; total: number; actions: number[] }> = {
    '认知水平': { achieved: 0, total: 0, actions: [] },
    '专业感知': { achieved: 0, total: 0, actions: [] },
    '安全感': { achieved: 0, total: 0, actions: [] },
    '障碍清除': { achieved: 0, total: 0, actions: [] },
  };

  for (const s of scores) {
    const element = ACTION_TRUST_MAP[s.actionNo];
    if (!element) continue; // 未知动作号跳过

    const weight = s.weight ?? ACTION_WEIGHTS[s.actionNo] ?? 1.0;
    elementScores[element].achieved += s.score * weight;
    elementScores[element].total += 5 * weight; // 满分5分
    elementScores[element].actions.push(s.actionNo);
  }

  // 计算各维度得分 (0-100)
  const details: TrustScoreResult['elementDetails'] = {} as any;
  const dimensionScores: Record<TrustElement, number> = {
    '认知水平': 0,
    '专业感知': 0,
    '安全感': 0,
    '障碍清除': 0,
  };

  for (const element of TRUST_ELEMENTS) {
    const es = elementScores[element];
    const rawScore = es.total > 0 ? Math.round((es.achieved / es.total) * 10000) / 100 : 0;
    dimensionScores[element] = rawScore;
    details[element] = {
      actions: es.actions,
      totalWeight: es.total,
      achievedWeight: es.achieved,
      rawScore,
    };
  }

  // 总信任度 = (认知 × 专业 × 安全 × 障碍) / 100^3
  // 使用乘法模型：任一维度为0则总信任度为0
  const totalTrust = Math.round(
    (dimensionScores['认知水平'] *
     dimensionScores['专业感知'] *
     dimensionScores['安全感'] *
     dimensionScores['障碍清除']) / (100 * 100 * 100) * 100
  ) / 100;

  // 找瓶颈维度
  const sorted = TRUST_ELEMENTS.map(e => ({ element: e, score: dimensionScores[e] }))
    .sort((a, b) => a.score - b.score);
  const bottleneck = sorted[0].element;

  // 生成改进建议
  const suggestion = generateSuggestion(bottleneck, dimensionScores);

  return {
    cognitiveScore: dimensionScores['认知水平'],
    professionalScore: dimensionScores['专业感知'],
    safetyScore: dimensionScores['安全感'],
    obstacleClearanceScore: dimensionScores['障碍清除'],
    totalTrust,
    bottleneck,
    suggestion,
    elementDetails: details,
  };
}

/**
 * 按节点计算信任度
 */
export function calculateNodeTrustScore(
  scores: ActionScoreInput[],
  nodeId: number
): TrustScoreResult {
  // 过滤出该节点的动作
  const nodeActions = getNodeActions(nodeId);
  const nodeScores = scores.filter(s => nodeActions.includes(s.actionNo));
  return calculateTrustScore(nodeScores);
}

/**
 * 获取节点包含的动作编号
 */
export function getNodeActions(nodeId: number): number[] {
  switch (nodeId) {
    case 1: return [1, 2, 3, 4, 5, 6];
    case 2: return [7, 8, 9, 10];
    case 3: return [11, 12, 13, 14, 15, 16];
    case 4: return [17, 18, 19];
    default: return [];
  }
}

/**
 * 获取动作所属节点
 */
export function getActionNode(actionNo: number): number {
  if (actionNo >= 1 && actionNo <= 6) return 1;
  if (actionNo >= 7 && actionNo <= 10) return 2;
  if (actionNo >= 11 && actionNo <= 16) return 3;
  if (actionNo >= 17 && actionNo <= 19) return 4;
  return 0;
}

/**
 * 生成改进建议
 */
function generateSuggestion(bottleneck: TrustElement, scores: Record<TrustElement, number>): string {
  const suggestions: Record<TrustElement, string> = {
    '安全感': '安全感是信任建立的第一步。建议重点强化：首通电话的治疗动机深度挖掘(动作1)、逆转案例分享(动作9)、权威视频增信(动作13)、复诊预约确认(动作15)——让患者先感到"被理解、被保护"。',
    '专业感知': '专业感知是信任的支柱。建议加强：用药反应告知与接受(动作2)、血糖波动提醒(动作3)、身体轻微变化询问(动作7)、变化发现与引导(动作10)、5天变化了解(动作11)、接诊电话沟通技巧(动作19)——用专业表现建立"这个人懂我"的信心。',
    '认知水平': '认知水平决定患者配合度。建议重点提升：舌苔留存的解释引导(动作4)、糖尿病认知教育(动作8)、清理内环境比喻(动作12)、病史长现状警示(动作14)——帮助患者"理解为什么"才能主动配合。',
    '障碍清除': '障碍不清除，前面建立的信任可能功亏一篑。建议加强：价格预期管理(动作5)、家属态度确认(动作6)、效果对比确认(动作16)、顾虑提前了解(动作17)、顾虑针对性消除(动作18)——提前发现并清除每个可能的障碍。',
  };

  const extra: string[] = [];
  if (scores['障碍清除'] < 60) {
    extra.push('特别注意：障碍清除得分偏低，价格、家属、顾虑等前置化动作未到位，可能导致已建立信任在关键时刻崩塌。');
  }
  if (scores['安全感'] < 40) {
    extra.push('⚠️ 安全感严重不足！信任建立顺序是安全感→专业度→归属感，安全感是地基，地基不牢后续难以弥补。');
  }

  return suggestions[bottleneck] + (extra.length > 0 ? '\n' + extra.join('\n') : '');
}

/**
 * 计算综合信任度趋势（多期对比）
 */
export function calculateTrustTrend(
  snapshots: Array<{
    cognitiveScore: number;
    professionalScore: number;
    safetyScore: number;
    obstacleClearanceScore: number;
    totalTrust: number;
    createdAt: string;
  }>
): {
  trend: 'improving' | 'stable' | 'declining';
  avgTrust: number;
  changePct: number;
  weakestElement: TrustElement;
} {
  if (snapshots.length === 0) {
    return { trend: 'stable', avgTrust: 0, changePct: 0, weakestElement: '安全感' };
  }

  const avgTrust = snapshots.reduce((sum, s) => sum + s.totalTrust, 0) / snapshots.length;

  // 最近3期 vs 之前3期对比
  const recent = snapshots.slice(-3);
  const earlier = snapshots.slice(-6, -3);

  let changePct = 0;
  let trend: 'improving' | 'stable' | 'declining' = 'stable';

  if (earlier.length > 0) {
    const recentAvg = recent.reduce((sum, s) => sum + s.totalTrust, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, s) => sum + s.totalTrust, 0) / earlier.length;
    changePct = earlierAvg > 0 ? Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100) : 0;
    trend = changePct > 5 ? 'improving' : changePct < -5 ? 'declining' : 'stable';
  }

  // 找最弱维度
  const elementAvgs: Record<TrustElement, number> = {
    '认知水平': 0,
    '专业感知': 0,
    '安全感': 0,
    '障碍清除': 0,
  };
  for (const s of snapshots) {
    elementAvgs['认知水平'] += s.cognitiveScore;
    elementAvgs['专业感知'] += s.professionalScore;
    elementAvgs['安全感'] += s.safetyScore;
    elementAvgs['障碍清除'] += s.obstacleClearanceScore;
  }
  const weakest = (Object.entries(elementAvgs) as [TrustElement, number][])
    .sort((a, b) => (a[1] / snapshots.length) - (b[1] / snapshots.length))[0][0];

  return { trend, avgTrust: Math.round(avgTrust * 100) / 100, changePct, weakestElement: weakest };
}
