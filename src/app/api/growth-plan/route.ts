import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/growth-plan - 获取成长计划
// 支持 dayIndex 参数：指定查看某天的任务（不传则返回当天）
// 支持 viewRole 参数：管理视角查看（training_manager/mentor/teacher）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const dayIndexParam = searchParams.get('dayIndex');
  const viewRole = searchParams.get('viewRole'); // 培训负责人/导师/老师查看

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
  const { data: levelProgress } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId);

  const passedLevels = (levelProgress || []).filter((p: Record<string, unknown>) => p.status === 'passed').length;

  const { data: bizData } = await client
    .from('business_data')
    .select('*')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(4);

  const { data: thresholds } = await client
    .from('thresholds')
    .select('*');

  const thresholdMap: Record<string, Record<string, unknown>> = {};
  for (const t of thresholds || []) {
    thresholdMap[t.indicator_key as string] = t;
  }

  let currentStageKey = 'learning';
  let currentStageIndex = 1;

  if (passedLevels >= 7) {
    currentStageKey = 'practice';
    currentStageIndex = 2;

    if (passedLevels >= 21 && (bizData || []).length >= 4) {
      const allQualified = (bizData || []).every((b: Record<string, unknown>) => {
        const addRate = b.wechat_add_rate ? parseFloat(b.wechat_add_rate as string) : 0;
        return addRate >= ((thresholdMap['wechatAddRate']?.passing as number) || 60);
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

  const currentStage = (stages || []).find((s: Record<string, unknown>) => s.stage_key === currentStageKey);

  // 4. 计算当前是第几天
  const joinDate = new Date();
  const now = new Date();
  const diffMs = now.getTime() - joinDate.getTime();
  const dayOffset = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  const currentDayIndex = currentStageKey === 'learning' ? Math.min(Math.max(dayOffset, 1), 7) : 0;

  // 5. 获取指定天的任务（支持dayIndex参数）
  const targetDay = dayIndexParam ? parseInt(dayIndexParam) : currentDayIndex;

  // 获取该用户所有学习期计划（用于计算解锁状态和7天概览）
  const { data: allStagePlans } = await client
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('stage_key', 'learning');

  // 确保有数据，如果为空则从模板初始化
  if (!allStagePlans || allStagePlans.length === 0) {
    const { data: templates } = await client
      .from('daily_plans')
      .select('*')
      .eq('user_id', '1')
      .eq('stage_key', 'learning')
      .order('day_index, sort_order');

    if (templates && templates.length > 0) {
      const newPlans = templates.map((t: Record<string, unknown>) => ({
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
        is_unlocked: Number(t.day_index) <= 1, // 只有Day1解锁
        review_status: 'approved',
        is_suggested: false,
      }));

      const { data: inserted } = await client
        .from('daily_plans')
        .insert(newPlans)
        .select();

      if (inserted) {
        // 自动创建practice_tasks
        const practiceItems = inserted.filter((p: Record<string, unknown>) => p.task_type === 'practice');
        if (practiceItems.length > 0) {
          try {
            const practiceTaskInserts = practiceItems.map((p: Record<string, unknown>) => ({
              task_type: 'system_task',
              title: String(p.task_title || ''),
              description: String(p.task_description || ''),
              task_tag: deriveTaskTag(String(p.task_title || '')),
              linked_course: p.related_level_id ? `闯关第${p.related_level_id}关` : null,
              linked_stage: String(p.stage_key || ''),
              linked_day_index: Number(p.day_index) || null,
              assigned_to: userId,
              assigned_by: null,
              deadline: null,
              status: 'pending',
            }));
            await client.from('practice_tasks').insert(practiceTaskInserts);
          } catch (ptErr) {
            console.error('Auto-create practice_tasks error:', ptErr);
          }
        }
        // 重新获取
        const { data: refetched } = await client
          .from('daily_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('stage_key', 'learning');
        return buildGrowthPlanResponse(refetched || [], currentStage, currentStageKey, currentStageIndex, currentDayIndex, targetDay, passedLevels, stages || [], userId, viewRole);
      }
    }
  }

  return buildGrowthPlanResponse(allStagePlans || [], currentStage, currentStageKey, currentStageIndex, currentDayIndex, targetDay, passedLevels, stages || [], userId, viewRole);
}

function buildGrowthPlanResponse(
  allStagePlans: Record<string, unknown>[],
  currentStage: Record<string, unknown> | null,
  currentStageKey: string,
  currentStageIndex: number,
  currentDayIndex: number,
  targetDay: number,
  passedLevels: number,
  stages: Record<string, unknown>[],
  userId: string,
  viewRole: string | null,
) {
  const client = getSupabaseClient();
  
  // 计算每天完成情况，确定解锁状态
  // 解锁规则：Day1始终解锁，DayN需要DayN-1的所有任务完成才解锁
  const dayCompletionMap: Record<number, boolean> = {};
  for (let d = 1; d <= 7; d++) {
    const dayPlans = allStagePlans.filter(p => Number(p.day_index) === d);
    const allDone = dayPlans.length > 0 && dayPlans.every(p => p.is_completed);
    dayCompletionMap[d] = allDone;
  }

  // 计算每天的解锁状态
  const dayUnlockMap: Record<number, boolean> = {};
  for (let d = 1; d <= 7; d++) {
    if (d === 1) {
      dayUnlockMap[d] = true; // Day1始终解锁
    } else {
      // DayN需要DayN-1全部完成才解锁
      dayUnlockMap[d] = dayCompletionMap[d - 1];
    }
  }

  // 获取目标天的任务
  const targetDayPlans = allStagePlans
    .filter(p => Number(p.day_index) === targetDay)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

  const isTargetDayUnlocked = dayUnlockMap[targetDay];

  // 7天概览
  const weekOverview = [];
  for (let d = 1; d <= 7; d++) {
    const dayPlans = allStagePlans.filter(p => Number(p.day_index) === d);
    const dayCompleted = dayPlans.filter(p => p.is_completed).length;
    weekOverview.push({
      day: d,
      total: dayPlans.length,
      completed: dayCompleted,
      isToday: d === currentDayIndex,
      isFuture: d > currentDayIndex,
      isUnlocked: dayUnlockMap[d],
    });
  }

  // 阶段整体进度
  const totalTasks = allStagePlans.length;
  const completedTasks = allStagePlans.filter(p => p.is_completed).length;

  // 管理视角额外信息：待审核的建议
  let pendingSuggestions: Record<string, unknown>[] = [];
  if (viewRole === 'training_manager') {
    const suggestions = allStagePlans.filter(p => p.review_status === 'pending');
    pendingSuggestions = suggestions.map(s => ({
      id: s.id,
      dayIndex: s.day_index,
      taskTitle: s.task_title,
      suggestedBy: s.suggested_by,
      reviewStatus: s.review_status,
    }));
  }

  return NextResponse.json({
    user: { id: userId },
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
    targetDay,
    isTargetDayUnlocked,
    stageProgress: {
      total: totalTasks,
      completed: completedTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    passedLevels,
    dayPlans: targetDayPlans.map(p => ({
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
      isUnlocked: isTargetDayUnlocked,
      isSuggested: p.is_suggested,
      suggestedBy: p.suggested_by,
      reviewStatus: p.review_status,
      reviewComment: p.review_comment,
    })),
    weekOverview,
    stages: stages.map((s: Record<string, unknown>) => ({
      key: s.stage_key,
      name: s.stage_name,
      index: s.stage_index,
      description: s.description,
      isActive: s.stage_key === currentStageKey,
      isCompleted: Number(s.stage_index) < currentStageIndex,
    })),
    pendingSuggestions,
  });
}

// PUT /api/growth-plan - 标记任务完成/更新任务/审核建议
export async function PUT(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    const body = await request.json();
    const { action } = body;

    // action: 'complete' | 'update_task' | 'review_suggestion'
    if (action === 'complete') {
      const { planId, isCompleted } = body;
      if (!planId) return NextResponse.json({ error: '缺少planId' }, { status: 400 });

      const updateData: Record<string, unknown> = { is_completed: isCompleted !== false };
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

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 检查该天所有任务是否完成，如果完成则解锁下一天
      if (data && isCompleted !== false) {
        const { data: dayPlans } = await client
          .from('daily_plans')
          .select('is_completed')
          .eq('user_id', data.user_id)
          .eq('stage_key', data.stage_key)
          .eq('day_index', data.day_index);

        const allDone = dayPlans && dayPlans.length > 0 && dayPlans.every((p: Record<string, unknown>) => p.is_completed);
        if (allDone) {
          const nextDay = Number(data.day_index) + 1;
          if (nextDay <= 7) {
            await client
              .from('daily_plans')
              .update({ is_unlocked: true })
              .eq('user_id', data.user_id)
              .eq('stage_key', data.stage_key)
              .eq('day_index', nextDay);
          }
        }
      }

      return NextResponse.json({ success: true, plan: data });
    }

    // 培训负责人：更新任务内容
    if (action === 'update_task') {
      const { planId, taskTitle, taskDescription, standard, deadlineTime } = body;
      if (!planId) return NextResponse.json({ error: '缺少planId' }, { status: 400 });

      const updateData: Record<string, unknown> = {};
      if (taskTitle !== undefined) updateData.task_title = taskTitle;
      if (taskDescription !== undefined) updateData.task_description = taskDescription;
      if (standard !== undefined) updateData.standard = standard;
      if (deadlineTime !== undefined) updateData.deadline_time = deadlineTime;

      const { data, error } = await client
        .from('daily_plans')
        .update(updateData)
        .eq('id', planId)
        .select()
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, plan: data });
    }

    // 培训负责人：审核建议（通过/驳回）
    if (action === 'review_suggestion') {
      const { planId, reviewStatus, reviewComment } = body;
      if (!planId || !reviewStatus) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

      const updateData: Record<string, unknown> = {
        review_status: reviewStatus, // 'approved' | 'rejected'
      };
      if (reviewComment) updateData.review_comment = reviewComment;

      // 如果驳回，恢复原始内容（可选）
      if (reviewStatus === 'rejected') {
        // 保留建议内容但标记驳回，培训负责人可以自行编辑
      }

      const { data, error } = await client
        .from('daily_plans')
        .update(updateData)
        .eq('id', planId)
        .select()
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, plan: data });
    }

    return NextResponse.json({ error: '未知的action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

// POST /api/growth-plan - 新增任务/建议任务
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    const body = await request.json();
    const { action } = body;

    // action: 'init' | 'add_task' | 'suggest_task'
    if (action === 'init') {
      // 初始化新用户7天排课
      const { userId } = body;
      if (!userId) return NextResponse.json({ error: '缺少userId' }, { status: 400 });

      const { data: existing } = await client
        .from('daily_plans')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ message: '该用户已有成长计划', count: existing.length });
      }

      const { data: templates } = await client
        .from('daily_plans')
        .select('*')
        .eq('user_id', '1')
        .eq('stage_key', 'learning')
        .order('day_index, sort_order');

      if (!templates || templates.length === 0) {
        return NextResponse.json({ error: '没有可用的排课模板' }, { status: 404 });
      }

      const newPlans = templates.map((t: Record<string, unknown>) => ({
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
        is_unlocked: Number(t.day_index) <= 1,
        review_status: 'approved',
        is_suggested: false,
      }));

      const { data: inserted, error } = await client
        .from('daily_plans')
        .insert(newPlans)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 自动创建practice_tasks
      const practiceItems = (inserted || []).filter((p: Record<string, unknown>) => p.task_type === 'practice');
      if (practiceItems.length > 0) {
        try {
          const practiceTaskInserts = practiceItems.map((p: Record<string, unknown>) => ({
            task_type: 'system_task',
            title: String(p.task_title || ''),
            description: String(p.task_description || ''),
            task_tag: deriveTaskTag(String(p.task_title || '')),
            linked_course: p.related_level_id ? `闯关第${p.related_level_id}关` : null,
            linked_stage: String(p.stage_key || ''),
            linked_day_index: Number(p.day_index) || null,
            assigned_to: userId,
            assigned_by: null,
            deadline: null,
            status: 'pending',
          }));
          await client.from('practice_tasks').insert(practiceTaskInserts);
        } catch (ptErr) {
          console.error('Auto-create practice_tasks error:', ptErr);
        }
      }

      return NextResponse.json({ success: true, count: inserted?.length || 0 });
    }

    // 培训负责人：直接新增任务
    if (action === 'add_task') {
      const { userId, stageKey, dayIndex, taskType, taskTitle, taskDescription, standard, deadlineTime, sortOrder } = body;
      if (!userId || !taskTitle || !dayIndex) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const { data, error } = await client
        .from('daily_plans')
        .insert({
          user_id: userId,
          stage_key: stageKey || 'learning',
          day_index: dayIndex,
          task_type: taskType || 'study',
          task_title: taskTitle,
          task_description: taskDescription || '',
          standard: standard || '',
          deadline_type: 'time',
          deadline_time: deadlineTime || '17:00',
          sort_order: sortOrder || 99,
          is_completed: false,
          is_unlocked: true,
          review_status: 'approved',
          is_suggested: false,
        })
        .select()
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, plan: data });
    }

    // 带教老师/培训老师：建议新增任务（需培训负责人审核）
    if (action === 'suggest_task') {
      const { userId, stageKey, dayIndex, taskType, taskTitle, taskDescription, standard, deadlineTime, suggestedBy } = body;
      if (!userId || !taskTitle || !dayIndex || !suggestedBy) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const { data, error } = await client
        .from('daily_plans')
        .insert({
          user_id: userId,
          stage_key: stageKey || 'learning',
          day_index: dayIndex,
          task_type: taskType || 'study',
          task_title: taskTitle,
          task_description: taskDescription || '',
          standard: standard || '',
          deadline_type: 'time',
          deadline_time: deadlineTime || '17:00',
          sort_order: 99,
          is_completed: false,
          is_unlocked: true,
          review_status: 'pending',
          is_suggested: true,
          suggested_by: suggestedBy,
        })
        .select()
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, plan: data, message: '任务建议已提交，待培训负责人审核' });
    }

    return NextResponse.json({ error: '未知的action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

// DELETE /api/growth-plan - 删除任务
export async function DELETE(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    if (!planId) {
      return NextResponse.json({ error: '缺少planId参数' }, { status: 400 });
    }

    const { error } = await client
      .from('daily_plans')
      .delete()
      .eq('id', planId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

function deriveTaskTag(title: string): string {
  if (title.includes('首通')) return '首通电话';
  if (title.includes('回访')) return '第三天回访';
  if (title.includes('预约')) return '第五天预约';
  if (title.includes('面诊')) return '面诊当天';
  if (title.includes('综合') || title.includes('全流程')) return '综合演练';
  if (title.includes('特殊')) return '特殊情况处理';
  if (title.includes('顾虑') || title.includes('异议')) return '顾虑消除';
  return '通用';
}
