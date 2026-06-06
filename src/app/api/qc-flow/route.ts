import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/qc-flow - 获取服务质量追踪数据（4节点19动作）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: '缺少userId参数' }, { status: 400 });
  }

  // 获取4节点19核心动作
  const { data: coreActions } = await client
    .from('core_actions')
    .select('*')
    .order('action_index');

  // 按节点分组
  const nodeMap: Record<string, any[]> = {};
  for (const action of coreActions || []) {
    if (!nodeMap[action.node_key]) nodeMap[action.node_key] = [];
    nodeMap[action.node_key].push(action);
  }

  const nodes = [
    { key: 'first_call', name: '首通电话', weight: 30, desc: '建立信任的第一步' },
    { key: 'day3_followup', name: '第三天回访', weight: 25, desc: '巩固用药信心' },
    { key: 'day5_appointment', name: '第五天预约', weight: 30, desc: '推动面诊转化' },
    { key: 'clinic_day', name: '面诊当天', weight: 15, desc: '完成诊中服务' },
  ].map(node => ({
    ...node,
    actions: (nodeMap[node.key] || []).map((a: any) => ({
      id: a.id,
      index: a.action_index,
      name: a.action_name,
      description: a.description,
      standard: a.standard,
    })),
  }));

  // 获取该用户的质检记录
  const { data: qcRecords } = await client
    .from('qc_records')
    .select('id, score_business, score_service, score_communication, score_process, qc_date, source_type')
    .eq('user_id', userId)
    .order('qc_date', { ascending: false })
    .limit(10);

  // 获取该用户的动作评分
  const { data: actionScores } = await client
    .from('action_scores')
    .select('id, action_id, score, scored_at, scorer_id')
    .eq('user_id', userId)
    .order('scored_at', { ascending: false });

  // 动作评分映射
  const actionScoreMap: Record<number, number> = {};
  for (const s of actionScores || []) {
    if (!actionScoreMap[s.action_id]) {
      actionScoreMap[s.action_id] = s.score;
    }
  }

  // 为每个动作附带评分
  const nodesWithScores = nodes.map(node => {
    const actionsWithScores = node.actions.map((action: any) => ({
      ...action,
      score: actionScoreMap[action.id] ?? null,
      passed: actionScoreMap[action.id] != null ? actionScoreMap[action.id] >= 4 : null,
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

  // 计算加权总分
  const totalWeight = nodesWithScores.reduce((sum, n) => sum + (n.avgScore != null ? n.weight : 0), 0);
  const weightedScore = totalWeight > 0
    ? Math.round((nodesWithScores.reduce((sum, n) => sum + (n.avgScore || 0) * (n.avgScore != null ? n.weight : 0), 0) / totalWeight) * 10) / 10
    : null;

  // 特殊患者情况
  const { data: specialActions } = await client
    .from('special_patient_actions')
    .select('*')
    .order('case_type, action_index');

  const caseTypes: Record<string, { key: string; name: string; actions: any[] }> = {};
  for (const sa of specialActions || []) {
    if (!caseTypes[sa.case_type]) {
      const names: Record<string, string> = {
        'not_on_time': '未按时用药',
        'delayed': '延迟用药',
        'interrupted': '用药中断',
        'irregular': '不规律用药',
      };
      caseTypes[sa.case_type] = { key: sa.case_type, name: names[sa.case_type] || sa.case_type, actions: [] };
    }
    caseTypes[sa.case_type].actions.push({
      id: sa.id,
      index: sa.action_index,
      name: sa.action_name,
      description: sa.description,
      scriptTemplate: sa.script_template,
    });
  }

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
    specialCases: Object.values(caseTypes),
  });
}
