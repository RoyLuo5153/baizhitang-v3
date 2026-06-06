import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onModulePassed, onModuleFailed } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

// POST /api/learning/modules/[moduleCode]/submit - 模块化答题提交
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleCode: string }> }
) {
  const { moduleCode } = await params;

  const body = await request.json();
  const { userId, answers } = body as {
    userId: string;
    answers: Record<number, string | string[]>;
  };

  if (!userId || !answers) {
    return NextResponse.json({ error: 'Missing userId or answers' }, { status: 400 });
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  // 1. 获取模块配置
  const { data: moduleConfig, error: modError } = await client
    .from('assessment_modules')
    .select('*')
    .eq('code', moduleCode)
    .eq('is_active', true)
    .maybeSingle();

  if (modError || !moduleConfig) {
    return NextResponse.json({ error: '模块不存在或未激活' }, { status: 404 });
  }

  const passThreshold = moduleConfig.pass_threshold || 80;
  const stage = moduleConfig.stage as string;

  // 2. 获取该模块的题目（含正确答案）
  const { data: questions, error: qError } = await client
    .from('questions')
    .select('id, question_type, answer, explanation')
    .eq('module', moduleCode)
    .eq('is_active', true);

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  // 3. 评分
  let correctCount = 0;
  const results: Array<{
    questionId: number;
    correct: boolean;
    userAnswer: string | string[];
    correctAnswer: string | string[];
    explanation: string;
  }> = [];

  for (const q of questions || []) {
    const userAnswer = answers[q.id];
    const correctAnswer = q.answer?.correct;
    let isCorrect = false;

    if (q.question_type === 'single_choice' || q.question_type === 'true_false') {
      isCorrect = userAnswer === correctAnswer;
    } else if (q.question_type === 'multiple_choice') {
      const userArr = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
      const correctArr = Array.isArray(correctAnswer) ? [...correctAnswer].sort() : [];
      isCorrect = JSON.stringify(userArr) === JSON.stringify(correctArr);
    }

    if (isCorrect) correctCount++;

    results.push({
      questionId: q.id,
      correct: isCorrect,
      userAnswer: userAnswer || '',
      correctAnswer: correctAnswer || '',
      explanation: q.explanation || '',
    });
  }

  const totalQuestions = questions?.length || 0;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = score >= passThreshold;

  // 4. 记录答题记录（复用quiz_attempts，用level_id=0标记模块答题）
  await client
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      level_id: 0, // 模块答题标记
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      answers: { moduleCode, results },
    });

  // 5. 更新模块进度
  const { data: existingProgress } = await client
    .from('module_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('module_code', moduleCode)
    .maybeSingle();

  if (existingProgress) {
    const updateData: Record<string, unknown> = {
      attempts: (existingProgress.attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      best_score: Math.max(existingProgress.best_score || 0, score),
      updated_at: new Date().toISOString(),
    };
    if (passed && existingProgress.status !== 'passed') {
      updateData.status = 'passed';
      updateData.passed_at = new Date().toISOString();
    }
    await client
      .from('module_progress')
      .update(updateData)
      .eq('id', existingProgress.id);
  } else {
    await client.from('module_progress').insert({
      user_id: userId,
      module_code: moduleCode,
      status: passed ? 'passed' : 'failed',
      best_score: score,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      passed_at: passed ? new Date().toISOString() : null,
    });
  }

  // 6. 联动触发
  try {
    const { data: userData } = await client
      .from('users')
      .select('real_name')
      .eq('id', userId)
      .maybeSingle();
    const traineeName = (userData as Record<string, unknown>)?.real_name as string || userId;

    // 收集错题ID
    const wrongQuestionIds = results.filter(r => !r.correct).map(r => r.questionId);

    if (!passed) {
      const failCount = (existingProgress?.attempts || 0) + 1;
      await onModuleFailed(userId, traineeName, moduleCode, moduleConfig.name as string, failCount, wrongQuestionIds);
    } else {
      await onModulePassed(userId, traineeName, moduleCode, stage);
    }
  } catch (triggerErr) {
    console.error('Trigger error:', triggerErr);
  }

  return NextResponse.json({
    score,
    totalQuestions,
    correctCount,
    passed,
    passingScore: passThreshold,
    results,
    moduleCode,
    moduleName: moduleConfig.name,
  });
}
