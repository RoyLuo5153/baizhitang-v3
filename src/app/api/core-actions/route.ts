import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/core-actions - 获取19个核心动作(按节点分组)
// 查询参数: nodeId, trustElement, withScores(userId), withNodes
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');
  const trustElement = searchParams.get('trustElement');
  const userId = searchParams.get('userId');
  const withNodes = searchParams.get('withNodes') === 'true';

  // 获取核心动作
  let query = client
    .from('core_actions')
    .select('*')
    .order('action_no');

  if (nodeId) {
    query = query.eq('node_id', Number(nodeId));
  }
  if (trustElement) {
    query = query.eq('trust_element', trustElement);
  }

  const { data: actions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 获取节点定义
  let nodes: any[] = [];
  if (withNodes || !nodeId) {
    const { data: nodeData } = await client
      .from('service_nodes')
      .select('*')
      .order('sort_order');
    nodes = nodeData || [];
  }

  // 获取用户评分记录（如果提供了userId）
  let userScores: Record<string, any[]> = {};
  if (userId) {
    // 先获取用户的质检记录ID
    const { data: qcRecords } = await client
      .from('qc_records')
      .select('id')
      .eq('user_id', userId);

    const recordIds = (qcRecords || []).map(r => r.id);

    if (recordIds.length > 0) {
      const { data: scores } = await client
        .from('action_scores')
        .select('*')
        .in('record_id', recordIds);

      // 按 action_no 分组
      for (const s of scores || []) {
        if (!userScores[s.action_no]) userScores[s.action_no] = [];
        userScores[s.action_no].push(s);
      }
    }
  }

  // 按节点分组
  const nodeGroups: Record<number, any> = {};
  for (const node of nodes) {
    nodeGroups[node.id] = {
      id: node.id,
      name: node.node_name,
      timeType: node.time_type,
      weight: Number(node.weight),
      trustFocus: node.trust_focus,
      description: node.description,
      actions: [],
    };
  }

  for (const action of actions || []) {
    if (!nodeGroups[action.node_id]) {
      // 动作引用了不存在的节点，创建占位
      nodeGroups[action.node_id] = {
        id: action.node_id,
        name: `节点${action.node_id}`,
        actions: [],
      };
    }

    const scores = userScores[action.action_no] || [];
    const latestScore = scores.length > 0
      ? scores.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;

    nodeGroups[action.node_id].actions.push({
      actionNo: action.action_no,
      name: action.action_name,
      timeType: action.time_type,
      isV2New: action.is_v2_new,
      trustElement: action.trust_element,
      weight: Number(action.weight),
      description: action.description,
      purpose: action.purpose,
      keyPoints: action.key_points,
      scoringCriteria: action.scoring_criteria,
      executionForms: action.execution_forms,
      latestScore: latestScore ? {
        score: latestScore.score,
        perspective: latestScore.perspective,
        executed: latestScore.executed,
        notes: latestScore.notes,
        scoredAt: latestScore.created_at,
      } : null,
    });
  }

  // 获取特殊情况类型列表
  const { data: specialTypes } = await client
    .from('special_patient_actions')
    .select('special_type')
    .limit(1);

  const specialCaseTypes = [
    { key: '未按时用药', name: '未按时用药', actions: ['用药催促'] },
    { key: '延迟用药', name: '延迟用药', actions: ['延迟原因挖掘', '承诺建立'] },
    { key: '用药中断', name: '用药中断', actions: ['中断响应', '原因挖掘', '重新激活话术', '阶段性归零'] },
    { key: '不规律用药', name: '不规律用药', actions: ['习惯培养', '多重提醒', '依从性评估'] },
  ];

  return NextResponse.json({
    nodes: Object.values(nodeGroups).sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0)),
    specialCases: specialCaseTypes,
    totalActions: (actions || []).length,
    v2NewCount: (actions || []).filter((a: any) => a.is_v2_new).length,
  });
}
