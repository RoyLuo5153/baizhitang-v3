import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onModuleFailed, onModulePassed } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

const PASSING_SCORE = 80;

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
  const { data: moduleConfig, error: moduleError } = await client
    .from('assessment_modules')
    .select('*')
    .eq('code', moduleCode)
    .eq('is_active', true)
    .maybeSingle();

  if (moduleError || !moduleConfig) {
    return NextResponse.json({ error: '模块不存在或已停用' }, { status: 404 });
  }

  const passThreshold = moduleConfig.pass_threshold || 80;
  const questionCount = moduleConfig.question_count || 10;

  // 2. 从questions表按module+stage随机抽题
  const { data: questions, error: qError } = await client
    .from('questions')
    .select('id, question_type, answer, explanation')
    .eq('module', moduleCode)
    .eq('is_active', true)
    .limit(questionCount);

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: '该模块暂无题目' }, { status: 400 });
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

  const wrongQuestionIds: number[] = [];

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

    if (isCorrect) {
      correctCount++;
    } else {
      wrongQuestionIds.push(q.id);
    }

    results.push({
      questionId: q.id,
      correct: isCorrect,
      userAnswer: userAnswer || '',
      correctAnswer: correctAnswer || '',
      explanation: q.explanation || '',
    });
  }

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = score >= passThreshold;

  // 4. 记录答题记录（复用quiz_attempts，新增module_code字段）
  const { error: attemptError } = await client
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      level_id: 0, // 模块化答题不绑定level_id
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      answers: results,
    });

  if (attemptError) {
    console.error('Failed to save attempt:', attemptError.message);
  }

  // 5. 更新模块进度
  const { data: existingProgress } = await client
    .from('module_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('module_code', moduleCode)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existingProgress) {
    const updateData: Record<string, unknown> = {
      attempts: (existingProgress.attempts || 0) + 1,
      last_attempt_at: now,
      best_score: Math.max(existingProgress.best_score || 0, score),
    };
    if (passed && existingProgress.status !== 'passed') {
      updateData.status = 'passed';
      updateData.passed_at = now;
    } else if (!passed && existingProgress.status === 'locked') {
      updateData.status = 'active';
    }
    await client
      .from('module_progress')
      .update(updateData)
      .eq('id', existingProgress.id);
  } else {
    await client.from('module_progress').insert({
      user_id: userId,
      module_code: moduleCode,
      status: passed ? 'passed' : 'active',
      best_score: score,
      attempts: 1,
      last_attempt_at: now,
      passed_at: passed ? now : null,
    });
  }

  // 6. 联动触发
  try {
    const { data: userData } = await client
      .from('users')
      .select('real_name')
      .eq('id', userId)
      .maybeSingle();
    const traineeName = userData?.real_name || userId;
    const moduleName = moduleConfig.name || moduleCode;
    const stage = moduleConfig.stage || 'foundation';

    if (!passed) {
      const failCount = (existingProgress?.attempts || 0) + 1;
      await onModuleFailed(userId, traineeName, moduleCode, moduleName, failCount, wrongQuestionIds);
    } else {
      await onModulePassed(userId, traineeName, moduleCode, stage);
    }
  } catch (triggerErr) {
    console.error('Module trigger error:', triggerErr);
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
