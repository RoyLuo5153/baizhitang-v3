import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

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

  // 导师看板
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
    quickActions: [
      { label: '查看新人看板', href: '/trainee-board' },
      { label: '双轨诊断', href: '/diagnosis' },
      { label: '赋能中心', href: '/empowerment' },
      { label: '质检审核', href: '/qc-review' },
      { label: '阈值配置', href: '/settings' },
      { label: '题库管理', href: '/question-bank' },
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

  return NextResponse.json({
    role: 'mentor',
    mentees: (mentees || []).map((m: any) => {
      const t = m.users;
      const plans = (menteePlans || []).filter((p: any) => p.user_id === t.id);
      const completed = plans.filter((p: any) => p.is_completed).length;
      return {
        id: t.id,
        name: t.real_name,
        stage: t.stage,
        planProgress: plans.length > 0 ? Math.round((completed / plans.length) * 100) : 0,
        completedTasks: completed,
        totalTasks: plans.length,
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
