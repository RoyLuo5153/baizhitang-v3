import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/core-actions - 获取19个核心动作及评分
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const nodeKey = searchParams.get('nodeKey');

  // 获取核心动作
  let query = client
    .from('core_actions')
    .select('*')
    .order('node_key, action_index');

  if (nodeKey) {
    query = client
      .from('core_actions')
      .select('*')
      .eq('node_key', nodeKey)
      .order('action_index');
  }

  const { data: actions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 获取用户的评分记录
  let userScores: any[] = [];
  if (userId) {
    const { data: scores } = await client
      .from('action_scores')
      .select('*')
      .eq('user_id', userId)
      .order('scored_at', { ascending: false });
    userScores = scores || [];
  }

  // 获取特殊情况补充动作
  const { data: specialActions } = await client
    .from('special_patient_actions')
    .select('*')
    .order('case_type, action_index');

  // 按节点分组
  const nodeGroups: Record<string, any> = {};
  for (const action of actions || []) {
    if (!nodeGroups[action.node_key]) {
      nodeGroups[action.node_key] = {
        key: action.node_key,
        name: action.node_name,
        weight: action.node_weight,
        actions: [],
      };
    }
    
    // 查找该动作的最新评分
    const latestScore = userScores.find(s => s.action_id === action.id);
    
    nodeGroups[action.node_key].actions.push({
      id: action.id,
      index: action.action_index,
      name: action.action_name,
      description: action.action_description,
      keyPoints: action.key_points,
      scriptTemplate: action.script_template,
      scoring: {
        5: action.scoring_5,
        4: action.scoring_4,
        3: action.scoring_3,
        2: action.scoring_2,
        0: action.scoring_0,
      },
      latestScore: latestScore ? {
        score: latestScore.score,
        perspective: latestScore.review_perspective,
        comment: latestScore.comment,
        scoredAt: latestScore.scored_at,
      } : null,
    });
  }

  // 特殊情况按类型分组
  const specialGroups: Record<string, any> = {};
  for (const sa of specialActions || []) {
    if (!specialGroups[sa.case_type]) {
      specialGroups[sa.case_type] = {
        key: sa.case_type,
        name: sa.case_name,
        actions: [],
      };
    }
    specialGroups[sa.case_type].actions.push({
      id: sa.id,
      index: sa.action_index,
      name: sa.action_name,
      description: sa.action_description,
      scriptTemplate: sa.script_template,
    });
  }

  return NextResponse.json({
    nodes: Object.values(nodeGroups),
    specialCases: Object.values(specialGroups),
    totalActions: (actions || []).length,
  });
}

// POST /api/core-actions - 提交核心动作评分
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    const body = await request.json();
    const { userId, actionId, score, perspective, reviewerId, comment } = body;

    if (!userId || !actionId || score === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (![0, 2, 3, 4, 5].includes(score)) {
      return NextResponse.json({ error: '评分必须为0/2/3/4/5' }, { status: 400 });
    }

    const { data, error } = await client
      .from('action_scores')
      .insert({
        user_id: userId,
        action_id: actionId,
        score,
        review_perspective: perspective || 'self',
        reviewer_id: reviewerId || null,
        comment: comment || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, scoreRecord: data });
  } catch (err) {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
