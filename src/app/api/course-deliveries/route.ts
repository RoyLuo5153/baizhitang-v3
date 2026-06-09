import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, type AuthInfo } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/course-deliveries - 获取课程交付记录
export async function GET(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getAuthFromHeaders(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view'); // mentor | trainee
  const batchId = searchParams.get('batchId');
  const stageId = searchParams.get('stageId');
  const courseId = searchParams.get('courseId');
  const userId = searchParams.get('userId');
  const teacherId = searchParams.get('teacherId');
  const mentorId = searchParams.get('mentorId');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

  // mentor视图：返回按学员分组的数据
  if (view === 'mentor' && user.role === 'mentor') {
    return getMentorView(client, user);
  }

  // trainee视图：返回新人个人学习数据
  if (view === 'trainee' && user.role === 'trainee') {
    return getTraineeView(client, user);
  }

  let query = client
    .from('course_deliveries')
    .select('*, courses(name, category), plan_stages(stage_name, schedule_mode)', { count: 'exact' });

  if (batchId) query = query.eq('batch_id', batchId);
  if (stageId) query = query.eq('stage_id', stageId);
  if (courseId) query = query.eq('course_id', courseId);
  if (userId) query = query.eq('user_id', userId);
  if (teacherId) query = query.eq('teacher_id', teacherId);
  if (mentorId) query = query.eq('mentor_id', mentorId);
  if (status) query = query.eq('status', status);

  // 角色过滤
  if (user.role === 'trainee') {
    query = query.eq('user_id', String(user.id));
  } else if (user.role === 'teacher') {
    query = query.eq('teacher_id', String(user.id));
  } else if (user.role === 'mentor') {
    query = query.eq('mentor_id', String(user.id));
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('scheduled_date', { ascending: true, nullsFirst: true });

  const { data: deliveries, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 获取关联的用户名
  const userIds = [...new Set((deliveries || []).map((d: Record<string, unknown>) => d.user_id as string).filter(Boolean))];
  const teacherIds = [...new Set((deliveries || []).map((d: Record<string, unknown>) => d.teacher_id as string).filter(Boolean))];
  const allIds = [...new Set([...userIds, ...teacherIds])];

  let userMap: Record<string, string> = {};
  if (allIds.length > 0) {
    const { data: users } = await client
      .from('users')
      .select('id, real_name')
      .in('id', allIds);
    (users || []).forEach((u: Record<string, unknown>) => {
      userMap[String(u.id)] = String(u.real_name);
    });
  }

  const enriched = (deliveries || []).map((d: Record<string, unknown>) => ({
    ...d,
    traineeName: userMap[String(d.user_id)] || '未知',
    teacherName: userMap[String(d.teacher_id)] || '未知',
  }));

  return NextResponse.json({ deliveries: enriched, total: count || 0 });
}

// mentor视图：按学员分组
async function getMentorView(client: ReturnType<typeof getSupabaseClient>, user: AuthInfo) {
  // 获取该mentor的批次学员
  const { data: batchTrainees } = await client
    .from('batch_trainees')
    .select('*, training_batches(batch_name)')
    .eq('mentor_id', String(user.id));

  if (!batchTrainees || batchTrainees.length === 0) {
    return NextResponse.json({ trainees: [] });
  }

  const userIds = batchTrainees.map((bt: Record<string, unknown>) => bt.user_id as string);
  const { data: users } = await client.from('users').select('id, real_name, username').in('id', userIds);
  const userMap: Record<string, Record<string, string>> = {};
  (users || []).forEach((u: Record<string, unknown>) => {
    userMap[String(u.id)] = { realName: String(u.real_name), username: String(u.username) };
  });

  // 获取交付记录
  const { data: deliveries } = await client
    .from('course_deliveries')
    .select('*, courses(name), plan_stages(stage_name, schedule_mode)')
    .in('user_id', userIds);

  const trainees = batchTrainees.map((bt: Record<string, unknown>) => {
    const btDeliveries = (deliveries || []).filter((d: Record<string, unknown>) => d.user_id === bt.user_id);
    const completed = btDeliveries.filter((d: Record<string, unknown>) => d.status === 'completed').length;
    const total = btDeliveries.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      id: bt.id,
      user_id: bt.user_id,
      batch_id: bt.batch_id,
      current_stage: bt.current_stage,
      overall_status: bt.overall_status,
      mentor_id: bt.mentor_id,
      realName: userMap[String(bt.user_id)]?.realName || '未知',
      username: userMap[String(bt.user_id)]?.username || '',
      batchName: (bt.training_batches as Record<string, unknown>)?.batch_name || '',
      progress,
      deliveries: btDeliveries.map((d: Record<string, unknown>) => ({
        id: d.id,
        course_id: d.course_id,
        courseName: (d.courses as Record<string, unknown>)?.name || '未知课程',
        status: d.status,
        scheduled_date: d.scheduled_date,
        assignment_score: d.assignment_score,
        assignment_feedback: d.assignment_feedback,
      })),
    };
  });

  return NextResponse.json({ trainees });
}

// trainee视图：个人学习数据
async function getTraineeView(client: ReturnType<typeof getSupabaseClient>, user: AuthInfo) {
  const userId = String(user.id);

  // 获取学员的批次信息
  const { data: bt } = await client
    .from('batch_trainees')
    .select('*, training_batches(batch_name, plan_id)')
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!bt) {
    return NextResponse.json(null);
  }

  const batchInfo = bt.training_batches as Record<string, unknown>;
  const planId = batchInfo?.plan_id;

  // 获取阶段信息
  const { data: stages } = await client
    .from('plan_stages')
    .select('*')
    .eq('plan_id', planId)
    .order('stage_number');

  // 获取交付记录
  const { data: deliveries } = await client
    .from('course_deliveries')
    .select('*, courses(name, category), plan_stages(stage_name, schedule_mode)')
    .eq('user_id', userId)
    .eq('batch_id', bt.batch_id);

  const stageName = (stages || []).find((s: Record<string, unknown>) => s.stage_number === bt.current_stage)?.stage_name || '';

  const stageInfos = (stages || []).map((s: Record<string, unknown>) => {
    const stageDeliveries = (deliveries || []).filter((d: Record<string, unknown>) => d.stage_id === s.id);
    const completed = stageDeliveries.filter((d: Record<string, unknown>) => d.status === 'completed').length;
    return {
      stageNumber: s.stage_number,
      stageName: s.stage_name,
      scheduleMode: s.schedule_mode,
      totalCourses: stageDeliveries.length,
      completedCourses: completed,
      status: Number(s.stage_number) === bt.current_stage ? 'current' as const : Number(s.stage_number) < bt.current_stage ? 'completed' as const : 'upcoming' as const,
    };
  });

  // 获取老师名字
  const teacherIds = [...new Set((deliveries || []).map((d: Record<string, unknown>) => d.teacher_id as string).filter(Boolean))];
  let teacherMap: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: teachers } = await client.from('users').select('id, real_name').in('id', teacherIds);
    (teachers || []).forEach((t: Record<string, unknown>) => {
      teacherMap[String(t.id)] = String(t.real_name);
    });
  }

  const upcomingCourses = (deliveries || [])
    .filter((d: Record<string, unknown>) => d.status === 'scheduled' || d.status === 'in_progress' || d.status === 'completed')
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const da = a.scheduled_date as string || '';
      const db = b.scheduled_date as string || '';
      return da.localeCompare(db);
    })
    .map((d: Record<string, unknown>) => ({
      id: d.id,
      courseName: (d.courses as Record<string, unknown>)?.name || '未知',
      teacherName: teacherMap[String(d.teacher_id)] || '未知',
      scheduledDate: d.scheduled_date || '',
      scheduledTime: '',
      location: '',
      status: d.status,
      attendanceStatus: d.attendance_status || '',
    }));

  // 待完成作业（有作业要求但未提交或已提交未点评）
  const pendingAssignments = (deliveries || [])
    .filter((d: Record<string, unknown>) => d.assignment_content && !d.assignment_score)
    .map((d: Record<string, unknown>) => ({
      id: d.id,
      courseName: (d.courses as Record<string, unknown>)?.name || '',
      title: '课后作业',
      dueDate: '',
      status: d.assignment_content ? 'submitted' : 'pending',
      score: 0,
      feedback: '',
      feedbackExpanded: false,
    }));

  // 已点评作业
  const reviewedAssignments = (deliveries || [])
    .filter((d: Record<string, unknown>) => d.assignment_score)
    .map((d: Record<string, unknown>) => ({
      id: d.id,
      courseName: (d.courses as Record<string, unknown>)?.name || '',
      title: '课后作业',
      dueDate: '',
      status: 'reviewed',
      score: d.assignment_score as number,
      feedback: (d.assignment_feedback as string) || '',
      feedbackExpanded: false,
    }));

  return NextResponse.json({
    batchName: batchInfo?.batch_name || '',
    currentStage: bt.current_stage,
    stageName,
    stages: stageInfos,
    upcomingCourses,
    pendingAssignments,
    reviewedAssignments,
  });
}

// POST /api/course-deliveries - 创建交付记录（排课）
export async function POST(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getAuthFromHeaders(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const { batchId, stageId, courseId, userId: traineeId, teacherId, mentorId, scheduleMode, scheduledDate } = body;

  // teacher 可以排课（batch模式批量排课或给指定新人排课）
  // mentor 可以排课（individual模式为学员安排进度）
  if (user.role !== 'teacher' && user.role !== 'mentor' && user.role !== 'training_manager') {
    return NextResponse.json({ error: '无权排课' }, { status: 403 });
  }

  if (!courseId || !stageId) {
    return NextResponse.json({ error: '缺少课程ID或阶段ID' }, { status: 400 });
  }

  // batch模式：给该批次所有新人在该阶段该课程创建交付记录
  if (scheduleMode === 'batch' && batchId && !traineeId) {
    const { data: batchTrainees } = await client
      .from('batch_trainees')
      .select('user_id')
      .eq('batch_id', batchId);

    if (!batchTrainees || batchTrainees.length === 0) {
      return NextResponse.json({ error: '该批次无新人' }, { status: 400 });
    }

    const inserts = batchTrainees.map((bt: Record<string, unknown>) => ({
      batch_id: batchId,
      stage_id: stageId,
      course_id: courseId,
      user_id: bt.user_id,
      teacher_id: teacherId || String(user.id),
      mentor_id: mentorId || null,
      schedule_mode: 'batch',
      status: scheduledDate ? 'scheduled' : 'pending',
      scheduled_date: scheduledDate || null,
    }));

    const { data, error } = await client.from('course_deliveries').insert(inserts).select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deliveries: data, count: data?.length || 0 }, { status: 201 });
  }

  // individual模式：给指定新人创建交付记录
  if (!traineeId) {
    return NextResponse.json({ error: '缺少新人ID' }, { status: 400 });
  }

  const { data: delivery, error } = await client
    .from('course_deliveries')
    .insert({
      batch_id: batchId || null,
      stage_id: stageId,
      course_id: courseId,
      user_id: traineeId,
      teacher_id: teacherId || null,
      mentor_id: mentorId || String(user.id),
      schedule_mode: scheduleMode || 'individual',
      status: scheduledDate ? 'scheduled' : 'pending',
      scheduled_date: scheduledDate || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ delivery }, { status: 201 });
}

// PATCH /api/course-deliveries - 更新交付记录（排课/签到/作业）
export async function PATCH(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getAuthFromHeaders(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ids, scheduledDate, status, attendanceStatus, assignmentScore, assignmentFeedback, assignmentContent, oldDate, oldTime, newTime, reason } = body;

  if (!id && !ids) {
    return NextResponse.json({ error: '缺少交付记录ID' }, { status: 400 });
  }

  const targetIds = ids || [id];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (scheduledDate !== undefined) updates.scheduled_date = scheduledDate;
  if (status !== undefined) updates.status = status;
  if (attendanceStatus !== undefined) updates.attendance_status = attendanceStatus;
  if (assignmentScore !== undefined) updates.assignment_score = assignmentScore;
  if (assignmentFeedback !== undefined) updates.assignment_feedback = assignmentFeedback;
  if (assignmentContent !== undefined) {
    updates.assignment_content = assignmentContent;
    updates.assignment_submitted_at = new Date().toISOString();
  }
  if (status === 'completed' && !updates.completed_date) {
    updates.completed_date = new Date().toISOString().split('T')[0];
  }

  // 排课变更日志
  if (oldDate && scheduledDate && oldDate !== scheduledDate) {
    for (const deliveryId of targetIds) {
      await client.from('schedule_change_logs').insert({
        delivery_id: deliveryId,
        changed_by: String(user.id),
        old_date: oldDate,
        new_date: scheduledDate,
        old_time: oldTime || null,
        new_time: newTime || null,
        reason: reason || null,
        notify_status: 'pending',
      });
    }
  }

  const { error } = await client
    .from('course_deliveries')
    .update(updates)
    .in('id', targetIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
