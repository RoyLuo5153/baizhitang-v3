import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/qc - 获取质检记录
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const qcType = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = client.from('qc_records').select('*');
  if (userId) query = query.eq('user_id', userId);
  if (qcType) query = query.eq('qc_type', qcType);

  const { data, error } = await query.order('qc_date', { ascending: false }).limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const records = data || [];

  // 计算维度均值
  let dimensionAvgs = null;
  if (records.length > 0) {
    const dims = ['score_business', 'score_service', 'score_communication', 'score_process'];
    dimensionAvgs = {} as Record<string, number>;
    for (const dim of dims) {
      const vals = records.map((r: any) => r[dim]).filter((v: any) => v != null);
      dimensionAvgs[dim] = vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
    }
  }

  return NextResponse.json({
    records: records.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      type: r.qc_type,
      date: r.qc_date,
      dimensions: {
        business: r.score_business,
        service: r.score_service,
        communication: r.score_communication,
        process: r.score_process,
      },
      status: r.status,
      comment: r.human_comment || r.ai_analysis,
      reviewerId: r.reviewer_id,
      createdAt: r.created_at,
    })),
    dimensionAvgs,
    total: records.length,
  });
}

// POST /api/qc - 创建质检记录
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
  } = body;

  if (!userId || !qcType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const insertData: any = {
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
    status: humanScore ? 'completed' : 'pending',
  };

  const { data, error } = await client
    .from('qc_records')
    .insert(insertData)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
