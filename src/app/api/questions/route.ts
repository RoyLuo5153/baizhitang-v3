import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/questions - 获取题目列表（带筛选分页）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const levelId = searchParams.get('levelId');
  const questionType = searchParams.get('questionType');
  const difficulty = searchParams.get('difficulty');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const keyword = searchParams.get('keyword');

  let query = client
    .from('questions')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('id');

  if (levelId) query = query.eq('level_id', parseInt(levelId));
  if (questionType) query = query.eq('question_type', questionType);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (keyword) query = query.ilike('content', `%${keyword}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 统计各题型数量
  const { data: stats } = await client
    .from('questions')
    .select('question_type')
    .eq('is_active', true);

  const typeStats: Record<string, number> = { total: 0 };
  for (const s of stats || []) {
    typeStats.total++;
    typeStats[s.question_type] = (typeStats[s.question_type] || 0) + 1;
  }

  return NextResponse.json({
    questions: data || [],
    total: count || 0,
    page,
    pageSize,
    stats: typeStats,
  });
}

// POST /api/questions - 创建题目
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const { level_id, question_type, difficulty, content, options, answer, explanation, created_by } = body;

  if (!level_id || !question_type || !content || !answer) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await client
    .from('questions')
    .insert({
      level_id,
      question_type,
      difficulty: difficulty || 'easy',
      content,
      options: options || null,
      answer,
      explanation: explanation || '',
      is_active: true,
      created_by: created_by || '1',
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ question: data?.[0] }, { status: 201 });
}

// PUT /api/questions - 更新题目
export async function PUT(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing question id' }, { status: 400 });
  }

  const { data, error } = await client
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ question: data?.[0] });
}

// DELETE /api/questions - 软删除题目
export async function DELETE(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing question id' }, { status: 400 });
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
