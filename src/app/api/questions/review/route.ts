import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/questions/review - 获取待审核题目列表（培训负责人专用）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);
  const user = getAuthFromHeaders(request);

  if (!user || user.role !== 'training_manager') {
    return NextResponse.json({ error: '仅培训负责人可查看待审核题目' }, { status: 403 });
  }

  const { data, error } = await client
    .from('questions')
    .select('id, level_id, question_type, content, difficulty, created_by, status, created_at')
    .eq('status', 'pending_review')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 获取创建者名称映射
  const creatorIds = [...new Set((data || []).map(q => q.created_by).filter(Boolean))];
  let creatorMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await client
      .from('users')
      .select('id, real_name')
      .in('id', creatorIds);
    for (const c of creators || []) {
      creatorMap[String(c.id)] = c.real_name;
    }
  }

  const questions = (data || []).map(q => ({
    ...q,
    creatorName: creatorMap[q.created_by] || '未知',
  }));

  return NextResponse.json({ questions, count: questions.length });
}

// PATCH /api/questions/review - 审核题目（approve/reject）
export async function PATCH(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);
  const user = getAuthFromHeaders(request);

  if (!user || user.role !== 'training_manager') {
    return NextResponse.json({ error: '仅培训负责人可审核题目' }, { status: 403 });
  }

  const body = await request.json();
  const { questionId, action, rejectReason } = body;

  if (!questionId || !action) {
    return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
  }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: '无效的审核操作' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const updateData: Record<string, unknown> = {
    status: newStatus,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };

  if (action === 'reject' && rejectReason) {
    updateData.reject_reason = rejectReason;
  }

  const { data, error } = await client
    .from('questions')
    .update(updateData)
    .eq('id', questionId)
    .eq('status', 'pending_review')
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: '题目不存在或已审核' }, { status: 404 });
  }

  return NextResponse.json({
    question: data[0],
    status: newStatus,
    message: action === 'approve' ? '题目已通过审核' : '题目已拒绝',
  });
}
