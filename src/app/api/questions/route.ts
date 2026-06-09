import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/questions - 获取题目列表（带筛选分页+角色过滤）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);
  const user = getAuthFromHeaders(request);

  const { searchParams } = new URL(request.url);
  const levelId = searchParams.get('levelId');
  const questionType = searchParams.get('questionType');
  const difficulty = searchParams.get('difficulty');
  const moduleFilter = searchParams.get('module');
  const stageFilter = searchParams.get('stage');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
  const keyword = searchParams.get('keyword');
  const statusFilter = searchParams.get('status');

  let query = client
    .from('questions')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('id');

  // 角色过滤：新人只看approved题目
  if (user?.role === 'trainee') {
    query = query.eq('status', 'approved');
  } else if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  if (levelId) query = query.eq('level_id', parseInt(levelId));
  if (questionType) query = query.eq('question_type', questionType);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (moduleFilter) query = query.eq('module', moduleFilter);
  if (stageFilter) query = query.eq('stage', stageFilter);
  if (keyword) query = query.ilike('content', `%${keyword}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 统计各题型数量和待审核数
  const { data: stats } = await client
    .from('questions')
    .select('question_type, status')
    .eq('is_active', true);

  const typeStats: Record<string, number> = { total: 0 };
  let pendingCount = 0;
  for (const s of stats || []) {
    typeStats.total++;
    typeStats[s.question_type] = (typeStats[s.question_type] || 0) + 1;
    if (s.status === 'pending_review') pendingCount++;
  }

  return NextResponse.json({
    questions: data || [],
    total: count || 0,
    page,
    pageSize,
    stats: typeStats,
    pendingCount,
    userRole: user?.role || 'trainee',
  });
}

// POST /api/questions - 创建题目（按角色设置审核状态）
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);
  const user = getAuthFromHeaders(request);

  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 新人无权创建题目
  if (user.role === 'trainee') {
    return NextResponse.json({ error: '新人无权创建题目' }, { status: 403 });
  }

  const body = await request.json();
  const { level_id, question_type, difficulty, content, options, answer, explanation, module: qModule, stage: qStage } = body;

  if (!level_id || !question_type || !content || !answer) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  // 按角色设置审核状态
  const isManager = user.role === 'training_manager';
  const status = isManager ? 'approved' : 'pending_review';

  const insertData: Record<string, unknown> = {
    level_id,
    question_type,
    difficulty: difficulty || 'easy',
    content,
    options: options || null,
    answer,
    explanation: explanation || '',
    is_active: true,
    created_by: String(user.id),
    status,
  };

  // 新增module和stage字段
  if (qModule) insertData.module = qModule;
  if (qStage) insertData.stage = qStage;

  if (isManager) {
    insertData.reviewed_by = user.id;
    insertData.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('questions')
    .insert(insertData)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    question: data?.[0],
    reviewStatus: status,
    message: isManager ? '题目已发布' : '已提交审核，等待培训负责人审核',
  }, { status: 201 });
}

// PUT /api/questions - 更新题目（按角色设置审核状态）
export async function PUT(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);
  const user = getAuthFromHeaders(request);

  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (user.role === 'trainee') {
    return NextResponse.json({ error: '新人无权编辑题目' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少题目ID' }, { status: 400 });
  }

  // 培训老师只能编辑自己创建的pending_review题目
  if (user.role === 'teacher' || user.role === 'mentor') {
    const { data: existing } = await client
      .from('questions')
      .select('created_by, status')
      .eq('id', id)
      .single();

    if (existing && existing.created_by !== String(user.id) && existing.status !== 'pending_review') {
      return NextResponse.json({ error: '只能编辑自己创建的待审核题目' }, { status: 403 });
    }
  }

  // 培训负责人编辑后直接approved
  const isManager = user.role === 'training_manager';
  if (isManager) {
    updates.status = 'approved';
    updates.reviewed_by = user.id;
    updates.reviewed_at = new Date().toISOString();
  } else {
    // 其他角色编辑后重新进入pending_review
    updates.status = 'pending_review';
    updates.reviewed_by = null;
    updates.reviewed_at = null;
  }

  const { data, error } = await client
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    question: data?.[0],
    reviewStatus: updates.status as string,
    message: isManager ? '题目已更新发布' : '已提交审核，等待培训负责人审核',
  });
}

// DELETE /api/questions - 软删除题目
export async function DELETE(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);
  const user = getAuthFromHeaders(request);

  if (!user || user.role === 'trainee') {
    return NextResponse.json({ error: '无权删除题目' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少题目ID' }, { status: 400 });
  }

  const { error } = await client
    .from('questions')
    .update({ is_active: false })
    .eq('id', parseInt(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
