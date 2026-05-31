import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

const PASSING_SCORE = 80;

// POST /api/learning/[levelId]/submit - 提交答题
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> }
) {
  const { levelId } = await params;
  const level = parseInt(levelId, 10);

  if (isNaN(level) || level < 1 || level > 21) {
    return NextResponse.json({ error: 'Invalid level ID' }, { status: 400 });
  }

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

  // 获取该关所有题目（含正确答案）
  const { data: questions, error: qError } = await client
    .from('questions')
    .select('id, question_type, answer, explanation')
    .eq('level_id', level)
    .eq('is_active', true);

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  // 评分
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
  const passed = score >= PASSING_SCORE;

  // 记录答题记录
  const { error: attemptError } = await client
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      level_id: level,
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      answers: results,
    });

  if (attemptError) {
    console.error('Failed to save attempt:', attemptError.message);
  }

  // 更新关卡进度
  const { data: existingProgress } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('level_id', level)
    .maybeSingle();

  if (existingProgress) {
    const updateData: Record<string, unknown> = {
      attempts: existingProgress.attempts + 1,
      last_attempt_at: new Date().toISOString(),
      best_score: Math.max(existingProgress.best_score || 0, score),
    };
    if (passed && existingProgress.status !== 'passed') {
      updateData.status = 'passed';
      updateData.passed_at = new Date().toISOString();
    }
    await client
      .from('level_progress')
      .update(updateData)
      .eq('id', existingProgress.id);
  } else {
    await client.from('level_progress').insert({
      user_id: userId,
      level_id: level,
      status: passed ? 'passed' : 'failed',
      best_score: score,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      passed_at: passed ? new Date().toISOString() : null,
    });
  }

  return NextResponse.json({
    score,
    totalQuestions,
    correctCount,
    passed,
    passingScore: PASSING_SCORE,
    results,
  });
}
