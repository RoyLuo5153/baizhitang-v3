import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

const STAGE_NAMES: Record<string, string> = {
  foundation: '基础通关',
  practice: '实操通关',
  qualified: '独立达标',
};

// GET /api/learning/modules - 获取模块化通关列表和进度
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  // 1. 获取所有模块定义
  const { data: modules, error: modulesError } = await client
    .from('assessment_modules')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (modulesError) {
    return NextResponse.json({ error: modulesError.message }, { status: 500 });
  }

  // 2. 获取用户模块进度
  const { data: progress, error: progressError } = await client
    .from('module_progress')
    .select('*')
    .eq('user_id', userId);

  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 });
  }

  // 3. 获取用户阶段状态
  const { data: profile } = await client
    .from('trainee_profiles')
    .select('stage, process_status, result_status')
    .eq('user_id', userId)
    .maybeSingle();

  const currentStage = profile?.stage || 'foundation';
  const processStatus = profile?.process_status || 'not_started';
  const resultStatus = profile?.result_status || 'not_started';

  // 4. 获取各模块题目统计
  const { data: questionStats } = await client
    .from('questions')
    .select('module, question_type')
    .eq('is_active', true);

  // 按module统计题型分布
  const moduleQuestionMap: Record<string, { single: number; multi: number; tf: number; total: number }> = {};
  for (const q of (questionStats || []) as Array<{ module: string | null; question_type: string }>) {
    const mod = q.module || 'unknown';
    if (!moduleQuestionMap[mod]) {
      moduleQuestionMap[mod] = { single: 0, multi: 0, tf: 0, total: 0 };
    }
    moduleQuestionMap[mod].total++;
    if (q.question_type === 'single_choice') moduleQuestionMap[mod].single++;
    else if (q.question_type === 'multiple_choice') moduleQuestionMap[mod].multi++;
    else if (q.question_type === 'true_false') moduleQuestionMap[mod].tf++;
  }

  // 5. 构建进度map
  const progressMap: Record<string, Record<string, unknown>> = {};
  for (const p of (progress || []) as Array<Record<string, unknown>>) {
    progressMap[p.module_code as string] = p;
  }

  // 6. 判断基础通关是否全部通过
  const foundationModules = (modules || []).filter((m: Record<string, unknown>) => m.stage === 'foundation');
  const foundationAllPassed = foundationModules.every((m: Record<string, unknown>) => {
    const p = progressMap[m.code as string];
    return p?.status === 'passed';
  });

  // 7. 构建模块列表
  const result = (modules || []).map((m: Record<string, unknown>) => {
    const p = progressMap[m.code as string];
    const stats = moduleQuestionMap[m.code as string] || { single: 0, multi: 0, tf: 0, total: 0 };
    const isFoundation = m.stage === 'foundation';
    const isPractice = m.stage === 'practice';

    let status: string;
    if (p?.status === 'passed') {
      status = 'passed';
    } else if (isPractice && !foundationAllPassed) {
      // 实操模块在基础通关全部通过前锁定
      status = 'locked';
    } else if (p?.status === 'in_progress') {
      status = 'in_progress';
    } else if (isFoundation || foundationAllPassed) {
      // 基础模块始终可考（只要未通过），实操模块在基础通过后可考
      status = 'active';
    } else {
      status = 'locked';
    }

    return {
      code: m.code,
      name: m.name,
      stage: m.stage,
      stageName: STAGE_NAMES[m.stage as string] || '未知阶段',
      sortOrder: m.sort_order,
      description: m.description || '',
      questionCount: m.question_count || 10,
      passThreshold: m.pass_threshold || 80,
      status,
      bestScore: (p?.best_score as number) ?? null,
      attempts: (p?.attempts as number) ?? 0,
      lastAttemptAt: (p?.last_attempt_at as string) ?? null,
      passedAt: (p?.passed_at as string) ?? null,
      questionStats: stats,
    };
  });

  // 8. 阶段进度统计
  const stageProgress: Record<string, { completed: number; total: number; allPassed: boolean }> = {};
  for (const stageKey of ['foundation', 'practice']) {
    const stageModules = result.filter(m => m.stage === stageKey);
    const passedCount = stageModules.filter(m => m.status === 'passed').length;
    stageProgress[stageKey] = {
      completed: passedCount,
      total: stageModules.length,
      allPassed: stageModules.length > 0 && passedCount === stageModules.length,
    };
  }

  // 9. 推荐赋能方案（仅在双线异常时匹配）
  let recommendedPlans: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[] = [];
  const hasAlert = processStatus === 'flagged' || resultStatus === 'yellow_alert' || resultStatus === 'red_alert';
  if (hasAlert) {
    const { data: empowerPlans } = await client
      .from('empower_plans')
      .select('id, name, indicator_key, target_indicators')
      .eq('is_active', true);

    const { data: executions } = await client
      .from('empower_executions')
      .select('plan_id')
      .eq('user_id', userId);
    const pushedPlanIds = new Set((executions || []).map((e: Record<string, unknown>) => String(e.plan_id)));

    const processIndicatorMap: Record<string, string> = { flagged: 'qc_communication' };
    const resultIndicatorMap: Record<string, string[]> = {
      yellow_alert: ['wechatAddRate', 'consultationRate'],
      red_alert: ['wechatAddRate', 'consultationRate', 'receptionRate'],
    };

    if (processStatus === 'flagged') {
      const indicator = processIndicatorMap.flagged;
      const matched = (empowerPlans || []).find((p: Record<string, unknown>) =>
        p.indicator_key === indicator || (Array.isArray(p.target_indicators) && p.target_indicators.includes(indicator))
      );
      if (matched) {
        recommendedPlans.push({ planId: String(matched.id), planName: matched.name as string, indicatorKey: indicator, alreadyPushed: pushedPlanIds.has(String(matched.id)) });
      }
    }

    if (resultStatus === 'yellow_alert' || resultStatus === 'red_alert') {
      const indicators = resultIndicatorMap[resultStatus] || [];
      for (const indicator of indicators) {
        const matched = (empowerPlans || []).find((p: Record<string, unknown>) =>
          p.indicator_key === indicator || (Array.isArray(p.target_indicators) && p.target_indicators.includes(indicator))
        );
        if (matched) {
          recommendedPlans.push({ planId: String(matched.id), planName: matched.name as string, indicatorKey: indicator, alreadyPushed: pushedPlanIds.has(String(matched.id)) });
        }
      }
    }
  }

  return NextResponse.json({
    modules: result,
    currentStage,
    processStatus,
    resultStatus,
    stageProgress,
    totalPassed: result.filter(m => m.status === 'passed').length,
    totalModules: result.length,
    recommendedPlans,
    hasAlert,
  });
}
