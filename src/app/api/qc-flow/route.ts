import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { calculateTrustScore, type ActionScoreInput } from '@/lib/trust-engine';

export const dynamic = 'force-dynamic';

// GET /api/qc-flow - 获取服务质量追踪数据（4节点19动作+信任度）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: '缺少userId参数' }, { status: 400 });
  }

  // 获取4节点定义
  const { data: serviceNodes } = await client
    .from('service_nodes')
    .select('*')
    .order('sort_order');

  // 获取19核心动作（新schema: action_no, node_id, trust_element, weight...）
  const { data: coreActions } = await client
    .from('core_actions')
    .select('*')
    .order('action_no');

  // 按节点分组
  const nodeMap: Record<number, any[]> = {};
  for (const action of coreActions || []) {
    if (!nodeMap[action.node_id]) nodeMap[action.node_id] = [];
    nodeMap[action.node_id].push(action);
  }

  const nodes = (serviceNodes || []).map((node: any) => ({
    id: node.id,
    key: node.id === 1 ? 'first_call' : node.id === 2 ? 'day3_followup' : node.id === 3 ? 'day5_appointment' : 'clinic_day',
    name: node.node_name,
    weight: Number(node.weight) * 100,
    trustFocus: node.trust_focus,
    desc: node.description,
    actions: (nodeMap[node.id] || []).map((a: any) => ({
      actionNo: a.action_no,
      name: a.action_name,
      trustElement: a.trust_element,
      weight: Number(a.weight),
      isV2New: a.is_v2_new,
      description: a.description,
      purpose: a.purpose,
      keyPoints: a.key_points,
      scoringCriteria: a.scoring_criteria,
      executionForms: a.execution_forms,
    })),
  }));

  // 获取该用户的质检记录
  const { data: qcRecords } = await client
    .from('qc_records')
    .select('id, score_business, score_service, score_communication, score_process, qc_date, source_type')
    .eq('user_id', userId)
    .order('qc_date', { ascending: false })
    .limit(10);

  // 获取该用户的动作评分（新schema: record_id, action_no, score, perspective）
  const recordIds = (qcRecords || []).map((r: any) => r.id);
  let allScores: any[] = [];
  if (recordIds.length > 0) {
    const { data: scoreData } = await client
      .from('action_scores')
      .select('record_id, action_no, score, perspective, executed, created_at')
      .in('record_id', recordIds);
    allScores = scoreData || [];
  }

  // 按动作编号映射最新评分（high_level视角优先）
  const actionScoreMap: Record<number, number> = {};
  const sortedScores = [...allScores].sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  for (const s of sortedScores) {
    // 优先取high_level视角
    if (actionScoreMap[s.action_no] === undefined && (s.perspective === 'high_level' || !actionScoreMap[s.action_no])) {
      actionScoreMap[s.action_no] = s.score;
    }
  }

  // 为每个动作附带评分
  const nodesWithScores = nodes.map(node => {
    const actionsWithScores = node.actions.map((action: any) => ({
      ...action,
      score: actionScoreMap[action.actionNo] ?? null,
      passed: actionScoreMap[action.actionNo] != null ? actionScoreMap[action.actionNo] >= 3 : null,
    }));

    const scoredActions = actionsWithScores.filter((a: any) => a.score != null);
    const passedActions = scoredActions.filter((a: any) => a.passed);
    const avgScore = scoredActions.length > 0
      ? Math.round((scoredActions.reduce((s: number, a: any) => s + a.score, 0) / scoredActions.length) * 10) / 10
      : null;

    return {
      ...node,
      actions: actionsWithScores,
      avgScore,
      passRate: scoredActions.length > 0 ? Math.round((passedActions.length / scoredActions.length) * 100) : 0,
      scoredCount: scoredActions.length,
      totalActions: node.actions.length,
      status: avgScore != null ? (avgScore >= 4 ? 'good' : avgScore >= 3 ? 'warning' : 'danger') : 'pending',
    };
  });

  // 计算信任度
  const trustInputs: ActionScoreInput[] = Object.entries(actionScoreMap)
    .map(([actionNo, score]) => ({ actionNo: Number(actionNo), score: score as number }));
  const trustResult = trustInputs.length > 0 ? calculateTrustScore(trustInputs) : null;

  // 计算加权总分
  const totalWeight = nodesWithScores.reduce((sum, n) => sum + (n.avgScore != null ? n.weight : 0), 0);
  const weightedScore = totalWeight > 0
    ? Math.round((nodesWithScores.reduce((sum, n) => sum + (n.avgScore || 0) * (n.avgScore != null ? n.weight : 0), 0) / totalWeight) * 10) / 10
    : null;

  // 特殊患者情况（新schema: 患者级记录，按special_type分组展示类型定义）
  const specialCases = [
    { key: 'not_on_time', name: '未按时用药', actions: ['用药催促'] },
    { key: 'delayed', name: '延迟用药', actions: ['延迟原因挖掘', '承诺建立'] },
    { key: 'interrupted', name: '用药中断', actions: ['中断响应', '原因挖掘', '重新激活话术', '阶段性归零'] },
    { key: 'irregular', name: '不规律用药', actions: ['习惯培养', '多重提醒', '依从性评估'] },
  ];

  // 获取该用户的特殊情况记录
  const { data: patientSpecialActions } = await client
    .from('special_patient_actions')
    .select('*')
    .eq('patient_id', userId);

  // 综合评级
  let quadrant = '--';
  if (weightedScore != null) {
    if (weightedScore >= 4) quadrant = 'A类';
    else if (weightedScore >= 3) quadrant = 'C类';
    else quadrant = 'D类';
  }

  return NextResponse.json({
    userId,
    nodes: nodesWithScores,
    weightedScore,
    quadrant,
    trustScore: trustResult ? {
      cognitiveScore: trustResult.cognitiveScore,
      professionalScore: trustResult.professionalScore,
      safetyScore: trustResult.safetyScore,
      obstacleClearanceScore: trustResult.obstacleClearanceScore,
      totalTrust: trustResult.totalTrust,
      bottleneck: trustResult.bottleneck,
      suggestion: trustResult.suggestion,
    } : null,
    latestQc: (qcRecords || []).slice(0, 3).map((r: any) => ({
      id: r.id,
      scores: {
        business: r.score_business,
        service: r.score_service,
        communication: r.score_communication,
        process: r.score_process,
      },
      date: r.qc_date,
      sourceType: r.source_type,
    })),
    specialCases,
    patientSpecialActions: patientSpecialActions || [],
  });
}
