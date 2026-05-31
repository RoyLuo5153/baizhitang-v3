import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/growth-plan - 获取当前用户的成长计划
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: '缺少userId参数' }, { status: 400 });
  }

  // 1. 获取用户信息
  const { data: user } = await client
    .from('users')
    .select('id, real_name, username, role_id, stage')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  // 2. 获取所有成长阶段模板
  const { data: stages } = await client
    .from('growth_stages')
    .select('*')
    .order('stage_index');

  // 3. 判断用户当前阶段
  // 根据闯关进度和业务指标判断
  const { data: levelProgress } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId);

  const passedLevels = (levelProgress || []).filter(p => p.status === 'passed').length;

  // 获取最近4周业务数据判断四象限
  const { data: bizData } = await client
    .from('business_data')
    .select('*')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(4);

  const { data: qcRecords } = await client
    .from('qc_records')
    .select('*')
    .eq('user_id', userId)
    .order('qc_date', { ascending: false })
    .limit(5);

  const { data: thresholds } = await client
    .from('thresholds')
    .select('*');

  const thresholdMap: Record<string, any> = {};
  for (const t of thresholds || []) {
    thresholdMap[t.indicator_key] = t;
  }

  // 简化阶段判断逻辑
  let currentStageKey = 'learning';
  let currentStageIndex = 1;
  
  if (passedLevels >= 7) {
    // 闯关7关全通过 -> 至少进入练习期
    currentStageKey = 'practice';
    currentStageIndex = 2;
    
    // 检查是否连续4周A类 -> 进入熟练期
    // 简化：如果有4条以上业务数据且全部达标，视为熟练期
    if (passedLevels >= 21 && (bizData || []).length >= 4) {
      const allQualified = (bizData || []).every((b: any) => {
        const addRate = b.wechat_add_rate ? parseFloat(b.wechat_add_rate) : 0;
        return addRate >= (thresholdMap['wechatAddRate']?.passing || 60);
      });
      if (allQualified) {
        currentStageKey = 'proficient';
        currentStageIndex = 4;
      } else {
        currentStageKey = 'independent';
        currentStageIndex = 3;
      }
    }
  }

  const currentStage = (stages || []).find((s: any) => s.stage_key === currentStageKey);

  // 4. 计算当前是第几天
  // 从用户入职日期算起，学习期为第1周
  const joinDate = user.stage === 1 ? new Date() : new Date(); // 简化，实际应取join_date
  const now = new Date();
  const diffMs = now.getTime() - joinDate.getTime();
  const dayOffset = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  
  // 学习期限制在1-7天
  const currentDayIndex = currentStageKey === 'learning' ? Math.min(Math.max(dayOffset, 1), 7) : 0;

  // 5. 获取今日任务
  let todayPlans: any[] = [];
  if (currentStageKey === 'learning' && currentDayIndex > 0) {
    const { data: plans } = await client
      .from('daily_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('stage_key', 'learning')
      .eq('day_index', currentDayIndex)
      .order('sort_order');
    todayPlans = plans || [];
    
    // 如果该用户没有今日计划（新用户），复制模板
    if (todayPlans.length === 0) {
      // 查看是否有模板数据（userId=1的模板）
      const { data: templates } = await client
        .from('daily_plans')
        .select('*')
        .eq('user_id', '1')
        .eq('stage_key', 'learning')
        .eq('day_index', currentDayIndex)
        .order('sort_order');
      
      if (templates && templates.length > 0) {
        // 复制模板给当前用户
        const newPlans = templates.map((t: any) => ({
          user_id: userId,
          stage_key: t.stage_key,
          day_index: t.day_index,
          task_type: t.task_type,
          task_title: t.task_title,
          task_description: t.task_description,
          standard: t.standard,
          deadline_type: t.deadline_type,
          deadline_time: t.deadline_time,
          related_level_id: t.related_level_id,
          sort_order: t.sort_order,
          is_completed: false,
          plan_date: now.toISOString().split('T')[0],
        }));
        
        const { data: inserted } = await client
          .from('daily_plans')
          .insert(newPlans)
          .select();
        todayPlans = inserted || [];
      }
    }
  }

  // 6. 获取阶段整体进度（学习期：已完成的任务/总任务）
  const { data: allStagePlans } = await client
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('stage_key', currentStageKey);

  const totalTasks = (allStagePlans || []).length;
  const completedTasks = (allStagePlans || []).filter(p => p.is_completed).length;

  // 7. 获取7天概览（学习期）
  let weekOverview: any[] = [];
  if (currentStageKey === 'learning') {
    for (let d = 1; d <= 7; d++) {
      const dayPlans = (allStagePlans || []).filter(p => p.day_index === d);
      const dayCompleted = dayPlans.filter(p => p.is_completed).length;
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
    user: { id: user.id, name: user.real_name, role: user.role_id },
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
    stageProgress: {
      total: totalTasks,
      completed: completedTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    passedLevels,
    todayPlans: todayPlans.map(p => ({
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

// PUT /api/growth-plan - 标记任务完成/取消完成
export async function PUT(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    const body = await request.json();
    const { planId, isCompleted } = body;

    if (!planId) {
      return NextResponse.json({ error: '缺少planId参数' }, { status: 400 });
    }

    const updateData: any = {
      is_completed: isCompleted !== false,
    };
    if (isCompleted !== false) {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { data, error } = await client
      .from('daily_plans')
      .update(updateData)
      .eq('id', planId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: data });
  } catch (err) {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

// POST /api/growth-plan - 为新用户初始化7天排课
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: '缺少userId参数' }, { status: 400 });
    }

    // 检查是否已有计划
    const { data: existing } = await client
      .from('daily_plans')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: '该用户已有成长计划', count: existing.length });
    }

    // 从模板（userId=1）复制7天排课
    const { data: templates } = await client
      .from('daily_plans')
      .select('*')
      .eq('user_id', '1')
      .eq('stage_key', 'learning')
      .order('day_index, sort_order');

    if (!templates || templates.length === 0) {
      return NextResponse.json({ error: '没有可用的排课模板' }, { status: 404 });
    }

    const newPlans = templates.map((t: any) => ({
      user_id: userId,
      stage_key: t.stage_key,
      day_index: t.day_index,
      task_type: t.task_type,
      task_title: t.task_title,
      task_description: t.task_description,
      standard: t.standard,
      deadline_type: t.deadline_type,
      deadline_time: t.deadline_time,
      related_level_id: t.related_level_id,
      sort_order: t.sort_order,
      is_completed: false,
      plan_date: new Date().toISOString().split('T')[0],
    }));

    const { data: inserted, error } = await client
      .from('daily_plans')
      .insert(newPlans)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: inserted?.length || 0 });
  } catch (err) {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
