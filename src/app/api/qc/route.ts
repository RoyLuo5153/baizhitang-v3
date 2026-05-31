import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onQcLowScore } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

// GET /api/qc - 获取质检记录（按角色分化）
// trainee: 只看自己的质检结果
// reviewer (mentor/teacher/manager): 看待审核+已审核列表
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const qcType = searchParams.get('type');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  // 获取当前用户角色
  let roleId = 1;
  if (userId) {
    const { data: userData } = await client.from('users').select('role_id').eq('id', userId).maybeSingle();
    roleId = (userData as any)?.role_id || 1;
  }

  let query = client.from('qc_records').select('*');
  
  // 角色分化查询
  if (roleId === 1) {
    // trainee: 只看自己的
    query = query.eq('user_id', userId || '');
  }
  // mentor/teacher/manager/boss: 看全部
  
  if (qcType) query = query.eq('qc_type', qcType);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.order('qc_date', { ascending: false }).limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get trainee names separately
  const traineeIds = [...new Set((data || []).map((r: Record<string, unknown>) => String(r.user_id)))];
  const { data: trainees } = await client.from('users').select('id, real_name').in('id', traineeIds);
  const traineeMap: Record<string, string> = {};
  (trainees || []).forEach((t: Record<string, unknown>) => {
    traineeMap[String(t.id)] = String(t.real_name || t.id);
  });

  interface QcRecord {
    id: number;
    userId: string;
    traineeName: string;
    type: string;
    date: string;
    sourceType: string | null;
    sourceId: number | null;
    dimensions: {
      business: number | null;
      service: number | null;
      communication: number | null;
      process: number | null;
    };
    aiScore: number | null;
    humanScore: number | null;
    audioUrl: string | null;
    screenshots: unknown;
    wechatNode: string | null;
    wechatActions: Record<string, unknown> | null;
    aiAnalysis: unknown;
    status: string;
    comment: string | null;
    reviewerId: string | null;
    createdAt: string;
  }

  const records: QcRecord[] = (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    userId: String(r.user_id),
    traineeName: traineeMap[String(r.user_id)] || String(r.user_id),
    type: String(r.qc_type),
    date: String(r.qc_date),
    sourceType: r.source_type ? String(r.source_type) : null,
    sourceId: r.source_id ? Number(r.source_id) : null,
    dimensions: {
      business: r.score_business ? Number(r.score_business) : null,
      service: r.score_service ? Number(r.score_service) : null,
      communication: r.score_communication ? Number(r.score_communication) : null,
      process: r.score_process ? Number(r.score_process) : null,
    },
    aiScore: r.ai_score ? Number(r.ai_score) : null,
    humanScore: r.human_score ? Number(r.human_score) : null,
    audioUrl: r.audio_url ? String(r.audio_url) : null,
    screenshots: r.screenshots,
    wechatNode: r.wechat_node ? String(r.wechat_node) : null,
    wechatActions: r.wechat_actions as Record<string, unknown> | null,
    aiAnalysis: r.ai_analysis,
    status: String(r.status),
    comment: r.human_comment ? String(r.human_comment) : (r.ai_analysis ? JSON.stringify(r.ai_analysis) : null),
    reviewerId: r.reviewer_id ? String(r.reviewer_id) : null,
    createdAt: String(r.created_at),
  }));

  // 统计
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const avgScore = records.filter(r => r.humanScore != null).length > 0
    ? Math.round(records.filter(r => r.humanScore != null).reduce((s: number, r) => s + (r.humanScore || 0), 0) / records.filter(r => r.humanScore != null).length)
    : 0;

  return NextResponse.json({
    records,
    stats: {
      total: records.length,
      pendingCount,
      completedCount,
      avgScore,
    },
    roleId,
  });
}

// POST /api/qc - 创建质检记录（通常由上游动作自动调用）
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const {
    userId, qcType, qcDate,
    scoreBusiness, scoreService, scoreCommunication, scoreProcess,
    audioUrl, screenshots, reviewerId,
    aiScore, aiTranscript, aiAnalysis,
    humanScore, humanComment,
    wechatNode, wechatActions,
    sourceType, sourceId,
  } = body;

  if (!userId || !qcType) {
    return NextResponse.json({ error: 'Missing required fields: userId, qcType' }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    user_id: userId,
    qc_type: qcType,
    qc_date: qcDate || new Date().toISOString().split('T')[0],
    score_business: scoreBusiness,
    score_service: scoreService,
    score_communication: scoreCommunication,
    score_process: scoreProcess,
    audio_url: audioUrl,
    screenshots,
    reviewer_id: reviewerId,
    ai_score: aiScore,
    ai_transcript: aiTranscript,
    ai_analysis: aiAnalysis,
    human_score: humanScore,
    human_comment: humanComment,
    wechat_node: wechatNode,
    wechat_actions: wechatActions,
    source_type: sourceType,
    source_id: sourceId,
    status: humanScore ? 'completed' : 'pending',
  };

  const { data, error } = await client
    .from('qc_records')
    .insert(insertData)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 联动触发：质检低分自动赋能
  try {
    const scores = [scoreBusiness, scoreService, scoreCommunication, scoreProcess].filter((s: unknown) => s != null) as number[];
    if (scores.length > 0) {
      const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      if (avgScore <= 2) {
        const { data: userData } = await client
          .from('users')
          .select('real_name')
          .eq('id', userId)
          .maybeSingle();
        const traineeName = (userData as any)?.real_name || userId;
        await onQcLowScore(userId, traineeName, (data as any)?.id || 0, Math.round(avgScore * 10) / 10);
      }
    }
  } catch (triggerErr) {
    console.error('QC trigger error:', triggerErr);
  }

  return NextResponse.json({ data });
}

// PATCH /api/qc - 审核质检记录（导师/负责人审核）
export async function PATCH(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const { id, reviewerId, humanScore, humanComment, scoreBusiness, scoreService, scoreCommunication, scoreProcess } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    reviewer_id: reviewerId,
    human_score: humanScore,
    human_comment: humanComment,
    status: 'completed',
    updated_at: new Date().toISOString(),
  };

  if (scoreBusiness != null) updateData.score_business = scoreBusiness;
  if (scoreService != null) updateData.score_service = scoreService;
  if (scoreCommunication != null) updateData.score_communication = scoreCommunication;
  if (scoreProcess != null) updateData.score_process = scoreProcess;

  const { data, error } = await client
    .from('qc_records')
    .update(updateData)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 联动触发：审核低分自动赋能
  try {
    const finalScore = humanScore ?? 0;
    if (finalScore < 60) {
      const { data: qcData } = await client
        .from('qc_records')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();
      const userId = (qcData as any)?.user_id;
      if (userId) {
        const { data: userData } = await client
          .from('users')
          .select('real_name')
          .eq('id', userId)
          .maybeSingle();
        const traineeName = (userData as any)?.real_name || userId;
        await onQcLowScore(userId, traineeName, id, finalScore);
      }
    }
  } catch (triggerErr) {
    console.error('QC review trigger error:', triggerErr);
  }

  return NextResponse.json({ data });
}
