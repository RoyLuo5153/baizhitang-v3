/**
 * 四象限计算引擎
 * 
 * 双轨驱动模型:
 * - 过程线: 闯关进度 + 质检4维度 + 日常考核
 * - 结果线: 加V率/面诊率/接诊率/签收率/用药率/挂号率
 * 
 * 四象限分类:
 * - A(实力型): 过程线达标 + 结果线达标
 * - B(运气型): 过程线未达标 + 结果线达标
 * - C(成长型): 过程线达标 + 结果线未达标
 * - D(危险型): 过程线未达标 + 结果线未达标
 */

import { pgQuery } from '@/storage/database/pg-client';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onQuadrantChange } from '@/lib/triggers';

export interface QuadrantDetail {
  label: string;
  value: number | null;
  unit: string;
  threshold: { qualified: number; good: number; excellent: number };
  level: 'excellent' | 'good' | 'qualified' | 'unqualified';
}

export interface QuadrantResult {
  userId: string;
  userName?: string;
  quadrant: 'A' | 'B' | 'C' | 'D';
  quadrantName: string;
  processQualified: boolean;
  resultQualified: boolean;
  processDetails: Record<string, QuadrantDetail>;
  resultDetails: Record<string, QuadrantDetail>;
  processScore: number;
  resultScore: number;
  unqualifiedItems: string[];
}

const QUADRANT_NAMES: Record<string, string> = {
  A: '实力型',
  B: '运气型',
  C: '成长型',
  D: '危险型',
};

/**
 * 计算单个用户的四象限分类
 */
export async function calculateQuadrant(userId: string): Promise<QuadrantResult> {
  // 1. 获取阈值配置
  const thresholds = await pgQuery<Record<string, unknown>>(
    'SELECT * FROM thresholds ORDER BY id'
  );
  const thresholdMap: Record<string, Record<string, unknown>> = {};
  for (const t of thresholds) {
    thresholdMap[t.indicator_key as string] = t;
  }

  // 2. 获取学习进度
  const progress = await pgQuery<Record<string, unknown>>(
    "SELECT * FROM level_progress WHERE user_id = $1",
    [userId]
  );

  // 3. 获取质检记录（最近5条）
  const qcRecords = await pgQuery<Record<string, unknown>>(
    "SELECT * FROM qc_records WHERE user_id = $1 ORDER BY qc_date DESC LIMIT 5",
    [userId]
  );

  // 4. 获取最新业务数据
  const bizData = await pgQuery<Record<string, unknown>>(
    "SELECT * FROM business_data WHERE user_id = $1 ORDER BY period_start DESC LIMIT 1",
    [userId]
  );

  // === 过程线逐项对标 ===
  const processItems: Record<string, QuadrantDetail> = {};

  // 闯关对标
  const passedLevels = progress.filter((p: Record<string, unknown>) => p.status === 'passed').length;
  const learningT = thresholdMap['learning'];
  processItems.learning = {
    label: '闯关进度',
    value: passedLevels,
    unit: '关',
    threshold: getThresholdValues(learningT, { qualified: 7, good: 14, excellent: 21 }),
    level: getLevel(passedLevels, learningT, { qualified: 7, good: 14, excellent: 21 }),
  };

  // 质检平均分
  const avgQcScore = qcRecords.length > 0
    ? Math.round(qcRecords.reduce((sum: number, q: Record<string, unknown>) => {
        const scores = [
          q.score_business, q.score_service,
          q.score_communication, q.score_process
        ].filter((s): s is number => s != null) as number[];
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return sum + avg;
      }, 0) / qcRecords.length)
    : 0;

  const qcScoreT = thresholdMap['qcScore'];
  processItems.qcScore = {
    label: '质检平均分',
    value: avgQcScore,
    unit: '分',
    threshold: getThresholdValues(qcScoreT, { qualified: 70, good: 80, excellent: 90 }),
    level: getLevel(avgQcScore, qcScoreT, { qualified: 70, good: 80, excellent: 90 }),
  };

  // 质检4维度
  const qcDimensions: Record<string, { key: string; label: string }> = {
    qc_communication: { key: 'score_communication', label: '沟通表达' },
    qc_professional: { key: 'score_process', label: '流程规范' },
    qc_service: { key: 'score_service', label: '服务态度' },
    qc_compliance: { key: 'score_business', label: '业务能力' },
  };

  for (const [tKey, dimConfig] of Object.entries(qcDimensions)) {
    const dimT = thresholdMap[tKey];
    const dimValue = qcRecords.length > 0
      ? Math.round(qcRecords.reduce((sum: number, q: Record<string, unknown>) => sum + ((q[dimConfig.key] as number) || 0), 0) / qcRecords.length)
      : 0;
    processItems[tKey] = {
      label: (dimT?.indicator_name as string) || dimConfig.label,
      value: dimValue,
      unit: '分',
      threshold: getThresholdValues(dimT, { qualified: 70, good: 80, excellent: 90 }),
      level: getLevel(dimValue, dimT, { qualified: 70, good: 80, excellent: 90 }),
    };
  }

  // 过程线判定：逐项对标，全合格才算达标（与diagnosis API一致）
  const processQualified = Object.values(processItems).every(i => i.level !== 'unqualified');

  // === 结果线逐项对标 ===
  const resultItems: Record<string, QuadrantDetail> = {};
  const latestBiz = bizData[0] || {};

  const bizMetrics = [
    { key: 'wechatAddRate', label: '加V率', dbKey: 'wechat_add_rate' },
    { key: 'consultationRate', label: '面诊率', dbKey: 'consultation_rate' },
    { key: 'receptionRate', label: '接诊率', dbKey: 'reception_rate' },
    { key: 'deliveryRate', label: '签收率', dbKey: 'delivery_rate' },
    { key: 'medicationRate', label: '用药率', dbKey: 'medication_rate' },
    { key: 'appointmentRate', label: '挂号率', dbKey: 'appointment_rate' },
  ];

  for (const metric of bizMetrics) {
    const t = thresholdMap[metric.key];
    const rawValue = latestBiz[metric.dbKey];
    const value = rawValue != null ? parseFloat(String(rawValue)) : null;
    const defaults = { qualified: 60, good: 75, excellent: 90 };
    resultItems[metric.key] = {
      label: (t?.indicator_name as string) || metric.label,
      value,
      unit: '%',
      threshold: getThresholdValues(t, defaults),
      level: value === null ? 'unqualified' : getLevel(value, t, defaults),
    };
  }

  // 结果线判定：核心指标(面诊率+签收率)达标
  const resultQualified = Object.values(resultItems).every(item => item.level !== 'unqualified');

  // === 四象限组合 ===
  const quadrant = processQualified && resultQualified ? 'A' :
    !processQualified && resultQualified ? 'B' :
    processQualified && !resultQualified ? 'C' : 'D';

  // 未达标项
  const unqualifiedItems: string[] = [];
  for (const [key, val] of Object.entries(processItems)) {
    if (val.level === 'unqualified') unqualifiedItems.push(key);
  }
  for (const [key, val] of Object.entries(resultItems)) {
    if (val.level === 'unqualified') unqualifiedItems.push(key);
  }

  // 计算汇总分数
  const processScore = calcAggregateScore(processItems);
  const resultScore = calcAggregateScore(resultItems);

  // 获取用户姓名
  const userRows = await pgQuery<{ real_name: string; username: string }>(
    "SELECT real_name, username FROM users WHERE id = $1",
    [userId]
  );
  const userName = userRows.length > 0 ? (userRows[0].real_name || userRows[0].username || undefined) : undefined;

  return {
    userId,
    userName,
    quadrant,
    quadrantName: QUADRANT_NAMES[quadrant],
    processQualified,
    resultQualified,
    processDetails: processItems,
    resultDetails: resultItems,
    processScore,
    resultScore,
    unqualifiedItems,
  };
}

/**
 * 批量计算四象限（团队视角）
 */
export async function calculateTeamQuadrant(): Promise<{
  summary: { total: number; A: number; B: number; C: number; D: number };
  members: QuadrantResult[];
}> {
  // 获取所有trainee
  const users = await pgQuery<Record<string, unknown>>(
    "SELECT id, real_name, username FROM users WHERE role_id = 1 AND is_active = true ORDER BY real_name"
  );

  const members: QuadrantResult[] = [];
  for (const u of users) {
    const result = await calculateQuadrant(String(u.id));
    result.userName = String(u.real_name || u.username || '未知');
    members.push(result);
  }

  const summary = {
    total: members.length,
    A: members.filter(m => m.quadrant === 'A').length,
    B: members.filter(m => m.quadrant === 'B').length,
    C: members.filter(m => m.quadrant === 'C').length,
    D: members.filter(m => m.quadrant === 'D').length,
  };

  return { summary, members };
}

/**
 * 保存四象限快照到 quadrant_snapshots 表
 */
export async function saveQuadrantSnapshot(
  userId: string,
  result: QuadrantResult,
  periodType: string = 'weekly'
): Promise<void> {
  // 获取当前周期的起止时间
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);

  const processItems = Object.entries(result.processDetails).map(([key, detail]) => ({
    key,
    label: detail.label,
    value: detail.value,
    unit: detail.unit,
    level: detail.level,
  }));

  const resultItems = Object.entries(result.resultDetails).map(([key, detail]) => ({
    key,
    label: detail.label,
    value: detail.value,
    unit: detail.unit,
    level: detail.level,
  }));

  // 查询该用户上一个快照的象限
  const prevSnapshots = await pgQuery<{ quadrant: string }>(
    "SELECT quadrant FROM quadrant_snapshots WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const oldQuadrant = prevSnapshots.length > 0 ? prevSnapshots[0].quadrant : null;

  await pgQuery(
    `INSERT INTO quadrant_snapshots (
      user_id, period_type, period_start, period_end,
      process_qualified, result_qualified, quadrant,
      process_items, result_items
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id, period_type, period_start) 
    DO UPDATE SET 
      process_qualified = EXCLUDED.process_qualified,
      result_qualified = EXCLUDED.result_qualified,
      quadrant = EXCLUDED.quadrant,
      process_items = EXCLUDED.process_items,
      result_items = EXCLUDED.result_items`,
    [
      userId,
      periodType,
      periodStart.toISOString().split('T')[0],
      periodEnd.toISOString().split('T')[0],
      result.processQualified,
      result.resultQualified,
      result.quadrant,
      JSON.stringify(processItems),
      JSON.stringify(resultItems),
    ]
  );

  // 象限变化时触发赋能方案推送
  const newQuadrant = result.quadrant;
  if (oldQuadrant !== null && oldQuadrant !== newQuadrant) {
    try {
      await onQuadrantChange(userId, oldQuadrant, newQuadrant, result.unqualifiedItems);
    } catch (err) {
      // 触发器失败不影响主流程
      console.error('[quadrant-engine] onQuadrantChange error:', err);
    }
  } else if (oldQuadrant === null && ['C', 'D'].includes(newQuadrant)) {
    // 首次快照且已落入C/D类，也触发
    try {
      await onQuadrantChange(userId, 'A', newQuadrant, result.unqualifiedItems);
    } catch (err) {
      console.error('[quadrant-engine] onQuadrantChange error:', err);
    }
  }
}

// === 工具函数 ===

function getThresholdValues(
  threshold: Record<string, unknown> | undefined,
  defaults: { qualified: number; good: number; excellent: number }
): { qualified: number; good: number; excellent: number } {
  if (!threshold) return defaults;
  return {
    qualified: Number(threshold.passing) || defaults.qualified,
    good: Number(threshold.good) || defaults.good,
    excellent: Number(threshold.excellent) || defaults.excellent,
  };
}

function getLevel(
  value: number,
  threshold: Record<string, unknown> | undefined,
  defaults: { qualified: number; good: number; excellent: number }
): 'excellent' | 'good' | 'qualified' | 'unqualified' {
  const tv = getThresholdValues(threshold, defaults);
  if (value >= tv.excellent) return 'excellent';
  if (value >= tv.good) return 'good';
  if (value >= tv.qualified) return 'qualified';
  return 'unqualified';
}

function calcAggregateScore(details: Record<string, QuadrantDetail>): number {
  const items = Object.values(details);
  if (items.length === 0) return 0;
  const scores = items.map(item => {
    const { value, threshold } = item;
    const t = threshold.excellent || threshold.good || threshold.qualified || 100;
    if (t <= 0 || value === null) return 0;
    return Math.min(Math.round((value / t) * 100), 100);
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
