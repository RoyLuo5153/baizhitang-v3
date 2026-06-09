import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/home - 获取首页数据（按角色分化）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: '缺少userId参数' }, { status: 400 });
  }

  // 获取用户信息
  const { data: user } = await client
    .from('users')
    .select('id, real_name, username, role_id, stage')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  const roleId = user.role_id;

  // 培训负责人驾驶舱
  if (roleId === 4) {
    return await getTrainingManagerDashboard(client, userId);
  }

  // 带教老师看板
  if (roleId === 2) {
    return await getMentorDashboard(client, userId);
  }

  // 老师教务工作台
  if (roleId === 3) {
    return await getTeacherDashboard(client, userId);
  }

  // 总经理概览
  if (roleId === 5) {
    return await getBossDashboard(client);
  }

  // 默认：新人成长计划
  return await getTraineeDashboard(client, userId, user);
}

async function getTrainingManagerDashboard(client: any, userId: string) {
  // 所有新人列表
  const { data: trainees } = await client
    .from('users')
    .select('id, real_name, username, stage, role_id')
    .eq('role_id', 1)
    .eq('is_active', true);

  // 所有成长计划进度
  const { data: allPlans } = await client
    .from('daily_plans')
    .select('user_id, stage_key, day_index, is_completed, task_type')
    .in('user_id', (trainees || []).map((t: any) => t.id));

  // 闯关进度
  const { data: levelProgress } = await client
    .from('level_progress')
    .select('user_id, status')
    .in('user_id', (trainees || []).map((t: any) => t.id));

  // 质检记录
  const { data: qcRecords } = await client
    .from('qc_records')
    .select('user_id, score_business, score_service, score_communication, score_process')
    .order('qc_date', { ascending: false })
    .limit(20);

  // 赋能方案
  const { data: empowerPlans } = await client
    .from('empower_plans')
    .select('*');

  // 通知/预警
  const { data: alerts } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10);

  // 统计
  const totalTrainees = (trainees || []).length;
  
  // 按阶段分组
  const stageDistribution: Record<number, number> = {};
  for (const t of trainees || []) {
    const s = t.stage || 1;
    stageDistribution[s] = (stageDistribution[s] || 0) + 1;
  }

  // 预警：进度落后的新人（7天任务完成率<50%）
  const traineeProgressMap: Record<string, { total: number; completed: number }> = {};
  for (const p of allPlans || []) {
    if (!traineeProgressMap[p.user_id]) traineeProgressMap[p.user_id] = { total: 0, completed: 0 };
    traineeProgressMap[p.user_id].total++;
    if (p.is_completed) traineeProgressMap[p.user_id].completed++;
  }

  const warnings: any[] = [];
  for (const t of trainees || []) {
    const progress = traineeProgressMap[t.id];
    if (progress && progress.total > 0) {
      const pct = progress.completed / progress.total;
      if (pct < 0.5) {
        warnings.push({
          userId: t.id,
          name: t.real_name,
          type: 'progress_lag',
          message: `${t.real_name} 任务完成率 ${Math.round(pct * 100)}%，低于50%`,
        });
      }
    }
    // 闯关失败多次预警
    const failedAttempts = (levelProgress || []).filter(
      (lp: any) => lp.user_id === t.id && lp.status === 'failed'
    );
    if (failedAttempts.length >= 3) {
      warnings.push({
        userId: t.id,
        name: t.real_name,
        type: 'quiz_retry',
        message: `${t.real_name} 闯关多次未通过，需要辅导`,
      });
    }
  }

  // === 三层质量数据 ===

  // 第一层：课程完成率
  const { data: enrollments } = await client
    .from('course_enrollments')
    .select('user_id, status')
    .in('user_id', (trainees || []).map((t: any) => t.id));
  const totalEnrollments = (enrollments || []).length;
  const completedEnrollments = (enrollments || []).filter((e: any) => e.status === 'completed').length;
  const courseCompletionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  // 阶段进阶待审批
  const { data: pendingStageChanges } = await client
    .from('notifications')
    .select('id, user_id, title, message, created_at, users!notifications_user_id_fkey(real_name, stage)')
    .eq('type', 'stage_change_request')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10);

  // 第二层：质检数据
  const { data: allQcRecords } = await client
    .from('qc_records')
    .select('id, user_id, score_business, score_service, score_communication, score_process, qc_date, users!qc_records_user_id_fkey(real_name)')
    .order('qc_date', { ascending: false })
    .limit(50);

  // 按维度计算平均分
  const qcScores = allQcRecords || [];
  const avgQcBusiness = qcScores.length > 0 ? Math.round(qcScores.reduce((s: number, r: any) => s + (r.score_business || 0), 0) / qcScores.length * 10) / 10 : 0;
  const avgQcService = qcScores.length > 0 ? Math.round(qcScores.reduce((s: number, r: any) => s + (r.score_service || 0), 0) / qcScores.length * 10) / 10 : 0;
  const avgQcCommunication = qcScores.length > 0 ? Math.round(qcScores.reduce((s: number, r: any) => s + (r.score_communication || 0), 0) / qcScores.length * 10) / 10 : 0;
  const avgQcProcess = qcScores.length > 0 ? Math.round(qcScores.reduce((s: number, r: any) => s + (r.score_process || 0), 0) / qcScores.length * 10) / 10 : 0;

  // 19动作通过率
  const { data: actionScoresData } = await client
    .from('action_scores')
    .select('score')
    .limit(200);
  const totalActionScores = (actionScoresData || []).length;
  const passedActions = (actionScoresData || []).filter((a: any) => a.score >= 4).length;
  const actionPassRate = totalActionScores > 0 ? Math.round((passedActions / totalActionScores) * 100) : 0;

  // 低分质检预警
  const lowScoreWarnings = (allQcRecords || []).filter((r: any) => {
    const avg = (r.score_business + r.score_service + r.score_communication + r.score_process) / 4;
    return avg < 3;
  }).slice(0, 5).map((r: any) => ({
    userId: r.user_id,
    name: (r.users as any)?.real_name || '未知',
    avgScore: Math.round(((r.score_business + r.score_service + r.score_communication + r.score_process) / 4) * 10) / 10,
  }));

  // 第三层：业务指标
  const { data: latestBizData } = await client
    .from('business_data')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(20);

  const { data: thresholdData } = await client
    .from('thresholds')
    .select('indicator_key, indicator_name, qualified_value, good_value, excellent_value, direction')
    .eq('category', 'result');

  // 计算指标达成状态
  const resultIndicators = [
    { key: 'wechat_add_rate', name: '加V率' },
    { key: 'consultation_rate', name: '面诊率' },
    { key: 'reception_rate', name: '接诊率' },
    { key: 'delivery_rate', name: '签收率' },
    { key: 'medication_rate', name: '用药率' },
    { key: 'appointment_rate', name: '挂号率' },
  ];

  const resultMetrics = resultIndicators.map(ind => {
    const vals = (latestBizData || []).map((b: Record<string, unknown>) => b[ind.key] ? parseFloat(String(b[ind.key])) : 0).filter((v: number) => v > 0);
    const avg = vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
    const threshold = (thresholdData || []).find((t: any) => t.indicator_key === ind.key);
    const qualifiedVal = threshold ? Number(threshold.qualified_value) : 70;
    const goodVal = threshold ? Number(threshold.good_value) : 85;
    let status: 'excellent' | 'good' | 'warning' | 'danger' = 'danger';
    if (avg >= goodVal) status = 'excellent';
    else if (avg >= qualifiedVal) status = 'good';
    else if (avg >= qualifiedVal * 0.8) status = 'warning';
    return { key: ind.key, name: ind.name, value: avg, qualified: qualifiedVal, good: goodVal, status };
  });

  // 结果触发的赋能
  const { data: resultEmpowerments } = await client
    .from('empower_executions')
    .select('id, user_id, plan_id, status, empower_plans!empower_executions_plan_id_fkey(name, indicator_key), users!empower_executions_user_id_fkey(real_name)')
    .eq('triggered_by', 'result')
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    role: 'training_manager',
    stats: {
      totalTrainees,
      stageDistribution,
      totalWarnings: warnings.length,
      unreadAlerts: (alerts || []).length,
    },
    warnings,
    recentAlerts: (alerts || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      message: a.message,
      createdAt: a.created_at,
    })),
    // 三层质量数据
    layer1: {
      courseCompletionRate,
      stageDistribution,
      pendingStageApprovals: (pendingStageChanges || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        traineeName: (n.users as any)?.real_name || '未知',
        currentStage: (n.users as any)?.stage || 1,
        message: n.message,
        createdAt: n.created_at,
      })),
    },
    layer2: {
      avgScores: { business: avgQcBusiness, service: avgQcService, communication: avgQcCommunication, process: avgQcProcess },
      actionPassRate,
      lowScoreWarnings,
    },
    layer3: {
      resultMetrics,
      resultEmpowerments: (resultEmpowerments || []).map((e: any) => ({
        id: e.id,
        traineeName: (e.users as any)?.real_name || '未知',
        planName: (e.empower_plans as any)?.name || '未知方案',
        indicatorKey: (e.empower_plans as any)?.indicator_key || '',
        status: e.status,
      })),
    },
    quickActions: [
      { label: '查看新人看板', href: '/trainee-board' },
      { label: '双轨诊断', href: '/diagnosis' },
      { label: '赋能中心', href: '/empowerment' },
      { label: '质检审核', href: '/qc-review' },
      { label: '服务质量追踪', href: '/qc-flow' },
      { label: '阈值配置', href: '/settings' },
    ],
  });
}

async function getMentorDashboard(client: any, userId: string) {
  // 我带的新人
  const { data: mentees } = await client
    .from('mentor_trainees')
    .select('trainee_id, users!mentor_trainees_trainee_id_fkey(id, real_name, username, stage)')
    .eq('mentor_id', userId);

  const menteeIds = (mentees || []).map((m: any) => m.trainee_id);

  // 新人双线状态（从trainee_profiles获取）
  const { data: profiles } = await client
    .from('trainee_profiles')
    .select('user_id, stage, process_status, result_status')
    .in('user_id', menteeIds.length > 0 ? menteeIds : ['__none__']);

  const profileMap: Map<string, { user_id: string; stage: string; process_status: string; result_status: string }> = new Map((profiles || []).map((p: any) => [String(p.user_id), p]));

  // 模块通关进度
  const { data: moduleProgress } = await client
    .from('module_progress')
    .select('user_id, module_code, status')
    .in('user_id', menteeIds.length > 0 ? menteeIds : ['__none__']);

  // 新人成长计划
  const { data: menteePlans } = await client
    .from('daily_plans')
    .select('*')
    .in('user_id', menteeIds.length > 0 ? menteeIds : ['__none__']);

  // 待评分的演练
  const { data: pendingReviews } = await client
    .from('practice_submissions')
    .select('*')
    .in('user_id', menteeIds.length > 0 ? menteeIds : ['__none__'])
    .is('reviewer_score', null)
    .order('submitted_at', { ascending: false })
    .limit(10);

  // 通知
  const { data: alerts } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5);

  // 赋能方案（所有可用的）
  const { data: empowerPlans } = await client
    .from('empower_plans')
    .select('id, name, indicator_key, target_indicators, content, estimated_hours')
    .eq('is_active', true);

  // 赋能执行记录（查看已推送的方案）
  const { data: executions } = await client
    .from('empower_executions')
    .select('plan_id, user_id, status')
    .in('user_id', menteeIds.length > 0 ? menteeIds : ['__none__']);

  // 构建每个学员的已推送方案集合
  const pushedMap = new Map<string, Set<string>>();
  for (const e of executions || []) {
    const key = String(e.user_id);
    if (!pushedMap.has(key)) pushedMap.set(key, new Set());
    pushedMap.get(key)!.add(String(e.plan_id));
  }

  // 过程线指标到赋能方案的映射
  const processIndicatorMap: Record<string, string> = {
    flagged: 'qc_communication', // 过程线预警→质检沟通赋能
  };

  // 结果线指标到赋能方案的映射
  const resultIndicatorMap: Record<string, string[]> = {
    yellow_alert: ['wechatAddRate', 'consultationRate'],
    red_alert: ['wechatAddRate', 'consultationRate', 'receptionRate'],
  };

  return NextResponse.json({
    role: 'mentor',
    mentees: (mentees || []).map((m: any) => {
      const t = m.users;
      const profile = profileMap.get(String(t.id));
      const plans = (menteePlans || []).filter((p: any) => p.user_id === t.id);
      const completed = plans.filter((p: any) => p.is_completed).length;
      const myModules = (moduleProgress || []).filter((mp: any) => mp.user_id === t.id);
      const passedModules = myModules.filter((mp: any) => mp.status === 'passed').length;
      const totalModules = 8; // 4基础+4实操

      // 根据双线状态匹配赋能方案
      const recommendedPlans: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[] = [];
      const processStatus = profile?.process_status || 'not_started';
      const resultStatus = profile?.result_status || 'not_started';
      const userPushed = pushedMap.get(String(t.id)) || new Set();

      if (processStatus === 'flagged') {
        const indicator = processIndicatorMap.flagged;
        const matched = (empowerPlans || []).find((p: any) =>
          p.indicator_key === indicator || (p.target_indicators && Array.isArray(p.target_indicators) && p.target_indicators.includes(indicator))
        );
        if (matched) {
          recommendedPlans.push({
            planId: String(matched.id),
            planName: matched.name,
            indicatorKey: indicator,
            alreadyPushed: userPushed.has(String(matched.id)),
          });
        }
      }

      if (resultStatus === 'yellow_alert' || resultStatus === 'red_alert') {
        const indicators = resultIndicatorMap[resultStatus] || [];
        for (const indicator of indicators) {
          const matched = (empowerPlans || []).find((p: any) =>
            p.indicator_key === indicator || (p.target_indicators && Array.isArray(p.target_indicators) && p.target_indicators.includes(indicator))
          );
          if (matched) {
            recommendedPlans.push({
              planId: String(matched.id),
              planName: matched.name,
              indicatorKey: indicator,
              alreadyPushed: userPushed.has(String(matched.id)),
            });
          }
        }
      }

      return {
        id: t.id,
        name: t.real_name,
        stage: t.stage || profile?.stage || 'foundation',
        processStatus,
        resultStatus,
        planProgress: plans.length > 0 ? Math.round((completed / plans.length) * 100) : 0,
        completedTasks: completed,
        totalTasks: plans.length,
        moduleProgress: `${passedModules}/${totalModules}`,
        passedModules,
        totalModules,
        recommendedPlans,
        hasAlert: processStatus === 'flagged' || resultStatus === 'yellow_alert' || resultStatus === 'red_alert',
      };
    }),
    pendingReviews: (pendingReviews || []).map((r: any) => ({
      id: r.id,
      traineeId: r.user_id,
      taskTitle: r.task_title || '录音演练',
      submittedAt: r.submitted_at,
    })),
    alerts: (alerts || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      message: a.message,
      createdAt: a.created_at,
    })),
  });
}

async function getTeacherDashboard(client: any, userId: string) {
  // 待审核的质检
  const { data: pendingQc } = await client
    .from('qc_records')
    .select('*')
    .is('reviewer_id', null)
    .order('qc_date', { ascending: false })
    .limit(10);

  // 今日课程
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySessions } = await client
    .from('course_sessions')
    .select('*')
    .gte('session_date', today)
    .order('session_date', { ascending: true })
    .limit(5);

  return NextResponse.json({
    role: 'teacher',
    pendingQcCount: (pendingQc || []).length,
    pendingQc: (pendingQc || []).map((q: any) => ({
      id: q.id,
      userId: q.user_id,
      qcDate: q.qc_date,
      scores: [q.score_business, q.score_service, q.score_communication, q.score_process].filter((s: any) => s != null),
    })),
    todaySessions: (todaySessions || []).map((s: any) => ({
      id: s.id,
      title: s.title || '培训课程',
      sessionDate: s.session_date,
      status: s.status,
    })),
    quickActions: [
      { label: '质检审核', href: '/qc-review' },
      { label: '题库管理', href: '/question-bank' },
      { label: '资料中心', href: '/resources' },
    ],
  });
}

async function getBossDashboard(client: any) {
  // 全体新人数据
  const { data: trainees } = await client
    .from('users')
    .select('id, real_name, stage')
    .eq('role_id', 1)
    .eq('is_active', true);

  // 最新业务数据
  const { data: bizData } = await client
    .from('business_data')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(20);

  // 计算平均指标
  const avgMetrics: Record<string, number> = {};
  if (bizData && bizData.length > 0) {
    const metrics = ['wechat_add_rate', 'consultation_rate', 'reception_rate', 'delivery_rate', 'medication_rate', 'appointment_rate'];
    for (const m of metrics) {
      const vals = bizData.map((b: Record<string, unknown>) => b[m] ? parseFloat(String(b[m])) : 0).filter((v: number) => v > 0);
      avgMetrics[m] = vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
    }
  }

  return NextResponse.json({
    role: 'boss',
    totalTrainees: (trainees || []).length,
    stageDistribution: (() => {
      const dist: Record<number, number> = {};
      for (const t of trainees || []) {
        const s = t.stage || 1;
        dist[s] = (dist[s] || 0) + 1;
      }
      return dist;
    })(),
    avgMetrics,
  });
}

async function getTraineeDashboard(client: any, userId: string, user: any) {
  // 复用growth-plan逻辑
  const { data: stages } = await client
    .from('growth_stages')
    .select('*')
    .order('stage_index');

  const { data: levelProgress } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId);

  const passedLevels = (levelProgress || []).filter((p: Record<string, unknown>) => p.status === 'passed').length;

  let currentStageKey = 'learning';
  let currentStageIndex = 1;
  if (passedLevels >= 7) {
    currentStageKey = 'practice';
    currentStageIndex = 2;
    if (passedLevels >= 21) {
      currentStageKey = 'proficient';
      currentStageIndex = 4;
    }
  }

  const currentStage = (stages || []).find((s: any) => s.stage_key === currentStageKey);
  const currentDayIndex = currentStageKey === 'learning' ? 1 : 0;

  const { data: todayPlans } = await client
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('stage_key', 'learning')
    .eq('day_index', currentDayIndex)
    .order('sort_order');

  const { data: allStagePlans } = await client
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('stage_key', currentStageKey);

  const totalTasks = (allStagePlans || []).length;
  const completedTasks = (allStagePlans || []).filter((p: Record<string, unknown>) => p.is_completed).length;

  let weekOverview: { day: number; total: number; completed: number; isToday: boolean; isFuture: boolean }[] = [];
  if (currentStageKey === 'learning') {
    for (let d = 1; d <= 7; d++) {
      const dayPlans = (allStagePlans || []).filter((p: Record<string, unknown>) => p.day_index === d);
      const dayCompleted = dayPlans.filter((p: Record<string, unknown>) => p.is_completed).length;
      weekOverview.push({
        day: d,
        total: dayPlans.length,
        completed: dayCompleted,
        isToday: d === currentDayIndex,
        isFuture: d > currentDayIndex,
      });
    }
  }

  // 双线状态
  const { data: traineeProfile } = await client
    .from('trainee_profiles')
    .select('stage, process_status, result_status')
    .eq('user_id', userId)
    .maybeSingle();

  // 模块通关进度
  const { data: moduleProgressData } = await client
    .from('module_progress')
    .select('module_code, status')
    .eq('user_id', userId);
  const passedModuleCount = (moduleProgressData || []).filter((mp: any) => mp.status === 'passed').length;

  return NextResponse.json({
    role: 'trainee',
    user: { id: user.id, name: user.real_name },
    currentStage: currentStage ? {
      key: currentStage.stage_key,
      name: currentStage.stage_name,
      index: currentStage.stage_index,
      description: currentStage.description,
      enterCondition: currentStage.enter_condition,
      exitCondition: currentStage.exit_condition,
      durationWeeks: currentStage.duration_weeks,
    } : null,
    dualTrackStatus: {
      stage: traineeProfile?.stage || 'foundation',
      processStatus: traineeProfile?.process_status || 'not_started',
      resultStatus: traineeProfile?.result_status || 'not_started',
      moduleProgress: `${passedModuleCount}/8`,
      passedModules: passedModuleCount,
      totalModules: 8,
    },
    currentDayIndex,
    stageProgress: { total: totalTasks, completed: completedTasks, percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
    passedLevels,
    todayPlans: (todayPlans || []).map((p: any) => ({
      id: p.id,
      dayIndex: p.day_index,
      taskType: p.task_type,
      taskTitle: p.task_title,
      taskDescription: p.task_description,
      standard: p.standard,
      deadlineType: p.deadline_type,
      deadlineTime: p.deadline_time,
      isCompleted: p.is_completed,
      completedAt: p.completed_at,
      relatedLevelId: p.related_level_id,
      sortOrder: p.sort_order,
    })),
    weekOverview,
    stages: (stages || []).map((s: any) => ({
      key: s.stage_key,
      name: s.stage_name,
      index: s.stage_index,
      description: s.description,
      isActive: s.stage_key === currentStageKey,
      isCompleted: s.stage_index < currentStageIndex,
    })),
  });
}
