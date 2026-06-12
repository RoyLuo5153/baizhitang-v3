import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/learning/modules/[moduleCode] - 获取模块详情+题目
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleCode: string }> }
) {
  const { moduleCode } = await params;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  // 1. 获取模块配置
  const { data: moduleConfig, error: moduleError } = await client
    .from('assessment_modules')
    .select('*')
    .eq('code', moduleCode)
    .eq('is_active', true)
    .maybeSingle();

  if (moduleError || !moduleConfig) {
    return NextResponse.json({ error: '模块不存在或已停用' }, { status: 404 });
  }

  // 2. 获取该模块的题目（不返回答案）
  const { data: questions, error: qError } = await client
    .from('questions')
    .select('id, question_type, difficulty, content, options')
    .eq('module', moduleCode)
    .eq('is_active', true)
    .limit(moduleConfig.question_count || 10);

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  // 3. 获取用户进度
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  let progress = null;
  if (userId) {
    const { data: prog } = await client
      .from('module_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('module_code', moduleCode)
      .maybeSingle();
    progress = prog;
  }

  return NextResponse.json({
    module: {
      code: moduleConfig.code,
      name: moduleConfig.name,
      stage: moduleConfig.stage,
      description: moduleConfig.description,
      sortOrder: moduleConfig.sort_order,
      passThreshold: moduleConfig.pass_threshold,
      questionCount: moduleConfig.question_count,
    },
    questions: (questions || []).map((q: Record<string, unknown>) => ({
      id: q.id,
      questionType: q.question_type,
      difficulty: q.difficulty,
      content: q.content,
      options: q.options,
    })),
    progress: progress ? {
      status: progress.status,
      bestScore: progress.best_score,
      attempts: progress.attempts,
      passedAt: progress.passed_at,
    } : null,
  });
}
