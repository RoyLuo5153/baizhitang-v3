import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/learning/[levelId] - 获取某关的题目
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> }
) {
  const { levelId } = await params;
  const level = parseInt(levelId, 10);

  if (isNaN(level) || level < 1 || level > 21) {
    return NextResponse.json({ error: 'Invalid level ID' }, { status: 400 });
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  // 获取该关卡题目（不返回答案）
  const { data: questions, error } = await client
    .from('questions')
    .select('id, question_type, difficulty, content, options')
    .eq('level_id', level)
    .eq('is_active', true)
    .order('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    levelId: level,
    questions: questions || [],
    totalQuestions: questions?.length || 0,
  });
}
