import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

function getUserFromCookie(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    return decoded as { id: number; username: string; realName: string; role: string };
  } catch {
    return null;
  }
}

// GET /api/training-plans - 获取培训计划列表（含阶段和课程）
export async function GET(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('id');

  if (planId) {
    // 获取单个计划详情（含阶段和课程）
    const { data: plan, error: planError } = await client
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: '计划不存在' }, { status: 404 });
    }

    const { data: stages } = await client
      .from('plan_stages')
      .select('*')
      .eq('plan_id', planId)
      .order('sort_order');

    const stagesWithCourses = await Promise.all(
      (stages || []).map(async (stage: Record<string, unknown>) => {
        const { data: stageCourses } = await client
          .from('plan_stage_courses')
          .select('id, course_id, teacher_id, is_required, sort_order, suggested_hours, courses(id, name, description, category, duration_hours)')
          .eq('stage_id', stage.id)
          .order('sort_order');

        return { ...stage, courses: stageCourses || [] };
      })
    );

    return NextResponse.json({ plan, stages: stagesWithCourses });
  }

  // 获取所有计划列表
  const { data: plans, error } = await client
    .from('training_plans')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 获取每个计划关联的批次统计
  const plansWithStats = await Promise.all(
    (plans || []).map(async (plan: Record<string, unknown>) => {
      const { count: batchCount } = await client
        .from('training_batches')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', plan.id);

      const { data: stages } = await client
        .from('plan_stages')
        .select('id, stage_number, stage_name, schedule_mode')
        .eq('plan_id', plan.id)
        .order('sort_order');

      return { ...plan, batchCount: batchCount || 0, stages: stages || [] };
    })
  );

  return NextResponse.json({ plans: plansWithStats });
}

// POST /api/training-plans - 创建培训计划模板
export async function POST(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (user.role !== 'training_manager' && user.role !== 'boss') {
    return NextResponse.json({ error: '仅培训负责人可创建计划' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, stages } = body;

  if (!name) {
    return NextResponse.json({ error: '计划名称不能为空' }, { status: 400 });
  }

  // 创建计划
  const { data: plan, error: planError } = await client
    .from('training_plans')
    .insert({
      name,
      description: description || '',
      manager_id: String(user.id),
      version: 1,
      status: 'template',
    })
    .select()
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: planError?.message || '创建失败' }, { status: 500 });
  }

  // 创建阶段和课程关联
  if (stages && Array.isArray(stages)) {
    for (const stage of stages) {
      const { data: stageData, error: stageError } = await client
        .from('plan_stages')
        .insert({
          plan_id: plan.id,
          stage_number: stage.stageNumber,
          stage_name: stage.stageName,
          schedule_mode: stage.scheduleMode || 'batch',
          sort_order: stage.sortOrder || stage.stageNumber,
          description: stage.description || '',
        })
        .select()
        .single();

      if (stageError || !stageData) continue;

      if (stage.courses && Array.isArray(stage.courses)) {
        const courseInserts = stage.courses.map((c: Record<string, unknown>, idx: number) => ({
          stage_id: stageData.id,
          course_id: c.courseId,
          teacher_id: c.teacherId || null,
          is_required: c.isRequired !== false,
          sort_order: idx + 1,
          suggested_hours: c.suggestedHours || null,
        }));

        await client.from('plan_stage_courses').insert(courseInserts);
      }
    }
  }

  return NextResponse.json({ plan }, { status: 201 });
}

// PATCH /api/training-plans - 更新培训计划
export async function PATCH(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (user.role !== 'training_manager' && user.role !== 'boss') {
    return NextResponse.json({ error: '仅培训负责人可修改计划' }, { status: 403 });
  }

  const body = await request.json();
  const { id, name, description, status, stages } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少计划ID' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;

  const { error: updateError } = await client
    .from('training_plans')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 如果传了stages，全量更新阶段和课程
  if (stages && Array.isArray(stages)) {
    // 删除旧的阶段（cascade会删除关联课程）
    await client.from('plan_stages').delete().eq('plan_id', id);

    for (const stage of stages) {
      const { data: stageData } = await client
        .from('plan_stages')
        .insert({
          plan_id: id,
          stage_number: stage.stageNumber,
          stage_name: stage.stageName,
          schedule_mode: stage.scheduleMode || 'batch',
          sort_order: stage.sortOrder || stage.stageNumber,
          description: stage.description || '',
        })
        .select()
        .single();

      if (stageData && stage.courses && Array.isArray(stage.courses)) {
        const courseInserts = stage.courses.map((c: Record<string, unknown>, idx: number) => ({
          stage_id: stageData.id,
          course_id: c.courseId,
          teacher_id: c.teacherId || null,
          is_required: c.isRequired !== false,
          sort_order: idx + 1,
          suggested_hours: c.suggestedHours || null,
        }));

        await client.from('plan_stage_courses').insert(courseInserts);
      }
    }
  }

  return NextResponse.json({ success: true });
}
