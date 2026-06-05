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

// GET /api/training-batches - 获取培训批次列表
export async function GET(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('id');
  const planId = searchParams.get('planId');

  if (batchId) {
    // 获取单个批次详情（含学员和交付记录统计）
    const { data: batch, error } = await client
      .from('training_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error || !batch) {
      return NextResponse.json({ error: '批次不存在' }, { status: 404 });
    }

    // 获取学员列表
    const { data: trainees } = await client
      .from('batch_trainees')
      .select('id, user_id, current_stage, overall_status, mentor_id, enrolled_at, users!batch_trainees_user_id_fkey(real_name, username)')
      .eq('batch_id', batchId);

    // 获取阶段列表
    const { data: stages } = await client
      .from('plan_stages')
      .select('*')
      .eq('plan_id', batch.plan_id)
      .order('sort_order');

    // 获取每阶段的交付统计
    const stagesWithStats = await Promise.all(
      (stages || []).map(async (stage: Record<string, unknown>) => {
        const { count: totalDeliveries } = await client
          .from('course_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .eq('stage_id', stage.id);

        const { count: completedDeliveries } = await client
          .from('course_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .eq('stage_id', stage.id)
          .eq('status', 'completed');

        const { count: presentCount } = await client
          .from('course_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .eq('stage_id', stage.id)
          .in('attendance_status', ['present', 'late']);

        // 获取该阶段的课程列表
        const { data: stageCourses } = await client
          .from('plan_stage_courses')
          .select('id, course_id, is_required, suggested_hours, courses(id, name)')
          .eq('stage_id', stage.id)
          .order('sort_order');

        return {
          ...stage,
          totalDeliveries: totalDeliveries || 0,
          completedDeliveries: completedDeliveries || 0,
          attendanceRate: totalDeliveries ? Math.round(((presentCount || 0) / totalDeliveries) * 100) : 0,
          courses: stageCourses || [],
        };
      })
    );

    return NextResponse.json({ batch, trainees: trainees || [], stages: stagesWithStats });
  }

  // 获取批次列表
  let query = client
    .from('training_batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (planId) {
    query = query.eq('plan_id', planId);
  }

  const { data: batches, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 添加每个批次的学员数统计
  const batchesWithStats = await Promise.all(
    (batches || []).map(async (batch: Record<string, unknown>) => {
      const { count: traineeCount } = await client
        .from('batch_trainees')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batch.id);

      const { count: completedCount } = await client
        .from('batch_trainees')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batch.id)
        .eq('overall_status', 'completed');

      return { ...batch, traineeCount: traineeCount || 0, completedCount: completedCount || 0 };
    })
  );

  return NextResponse.json({ batches: batchesWithStats });
}

// POST /api/training-batches - 从模板创建培训实例
export async function POST(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (user.role !== 'training_manager' && user.role !== 'boss') {
    return NextResponse.json({ error: '仅培训负责人可创建培训期' }, { status: 403 });
  }

  const body = await request.json();
  const { planId, batchName, startDate, endDate, traineeIds } = body;

  if (!planId || !batchName) {
    return NextResponse.json({ error: '缺少计划ID或期数名称' }, { status: 400 });
  }

  // 获取计划模板的阶段信息
  const { data: stages } = await client
    .from('plan_stages')
    .select('id, stage_number, schedule_mode')
    .eq('plan_id', planId)
    .order('sort_order');

  // 创建批次
  const { data: batch, error: batchError } = await client
    .from('training_batches')
    .insert({
      plan_id: planId,
      batch_name: batchName,
      start_date: startDate || null,
      end_date: endDate || null,
      status: 'preparing',
      created_by: String(user.id),
    })
    .select()
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message || '创建失败' }, { status: 500 });
  }

  // 添加学员到批次
  if (traineeIds && Array.isArray(traineeIds) && traineeIds.length > 0) {
    const traineeInserts = traineeIds.map((uid: string) => ({
      batch_id: batch.id,
      user_id: uid,
      current_stage: 1,
      overall_status: 'in_progress',
      mentor_id: null,
    }));

    await client.from('batch_trainees').insert(traineeInserts);

    // 为阶段一（batch模式）创建交付记录
    const batchStages = (stages || []).filter((s: Record<string, unknown>) => s.schedule_mode === 'batch');
    if (batchStages.length > 0) {
      const { data: stageCourses } = await client
        .from('plan_stage_courses')
        .select('id, course_id, stage_id, teacher_id')
        .in('stage_id', batchStages.map((s: Record<string, unknown>) => s.id));

      if (stageCourses && stageCourses.length > 0) {
        const deliveryInserts: Record<string, unknown>[] = [];
        for (const uid of traineeIds) {
          for (const sc of stageCourses) {
            deliveryInserts.push({
              batch_id: batch.id,
              stage_id: sc.stage_id,
              course_id: sc.course_id,
              user_id: uid,
              teacher_id: sc.teacher_id,
              schedule_mode: 'batch',
              status: 'pending',
            });
          }
        }
        await client.from('course_deliveries').insert(deliveryInserts);
      }
    }
  }

  // 更新批次状态为进行中
  if (traineeIds && traineeIds.length > 0) {
    await client
      .from('training_batches')
      .update({ status: 'in_progress' })
      .eq('id', batch.id);
  }

  return NextResponse.json({ batch }, { status: 201 });
}

// PATCH /api/training-batches - 更新批次信息
export async function PATCH(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (user.role !== 'training_manager' && user.role !== 'boss') {
    return NextResponse.json({ error: '仅培训负责人可修改批次' }, { status: 403 });
  }

  const body = await request.json();
  const { id, batchName, startDate, endDate, status, addTrainees, removeTrainees } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少批次ID' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (batchName !== undefined) updates.batch_name = batchName;
  if (startDate !== undefined) updates.start_date = startDate;
  if (endDate !== undefined) updates.end_date = endDate;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length > 1) {
    await client.from('training_batches').update(updates).eq('id', id);
  }

  // 添加学员
  if (addTrainees && Array.isArray(addTrainees) && addTrainees.length > 0) {
    const inserts = addTrainees.map((uid: string) => ({
      batch_id: id,
      user_id: uid,
      current_stage: 1,
      overall_status: 'in_progress',
    }));
    await client.from('batch_trainees').insert(inserts);
  }

  // 移除学员
  if (removeTrainees && Array.isArray(removeTrainees) && removeTrainees.length > 0) {
    await client
      .from('batch_trainees')
      .delete()
      .eq('batch_id', id)
      .in('user_id', removeTrainees);
  }

  return NextResponse.json({ success: true });
}
