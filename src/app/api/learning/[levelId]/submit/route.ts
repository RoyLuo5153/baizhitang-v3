import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onQuizFailed, onQuizPassed } from '@/lib/triggers';
import { checkAndTransitionStage } from '@/lib/stage-engine';

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

  // 联动触发：闯关失败/通过通知
  try {
    const { data: userData } = await client
      .from('users')
      .select('real_name')
      .eq('id', userId)
      .maybeSingle();
    const traineeName = userData?.real_name || userId;

    const levelNames: Record<number, string> = {
      1: '初心启航', 2: '角色认知', 3: '糖尿病基础', 4: '血糖监测原理', 5: '药物分类认知',
      6: '营养饮食指导', 7: '并发症预防', 8: '首诊服务用语实训', 9: '加微承接服务用语', 10: '用药关怀服务用语',
      11: '实战服务用语演练', 12: '复诊邀约服务用语', 13: '续方确认服务用语', 14: '综合实战考核',
      15: '全流程模拟', 16: '紧急情况应对', 17: '患者异议处理', 18: '服务质量达标',
      19: '业务指标达标', 20: '独立接诊验证', 21: '综合能力达标',
    };

    if (!passed) {
      // 计算该关失败次数
      const failCount = (existingProgress?.attempts || 0) + 1;
      await onQuizFailed(userId, traineeName, level, levelNames[level] || `第${level}关`, failCount);
    } else {
      // 统计总通过数
      const { data: allProgress } = await client
        .from('level_progress')
        .select('status')
        .eq('user_id', userId);
      const totalPassed = (allProgress || []).filter((p: any) => p.status === 'passed').length;
      await onQuizPassed(userId, traineeName, level, totalPassed);

      // 阶段转换引擎：闯关通过后自动检查是否满足阶段转换条件
      try {
        const transitionResult = await checkAndTransitionStage(userId);
        if (transitionResult.transitioned) {
          console.info(`Stage transitioned: user=${userId} ${transitionResult.fromStage}->${transitionResult.toStage} reason=${transitionResult.reason}`);
        }
      } catch (transitionErr) {
        // 阶段转换失败不影响答题结果
        console.error('Stage transition error:', transitionErr);
      }
    }
  } catch (triggerErr) {
    // 联动触发失败不影响答题结果
    console.error('Trigger error:', triggerErr);
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
