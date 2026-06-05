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

// 生成6位随机签到码
function generateCheckInCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// GET /api/course-attendance - 获取签到记录
export async function GET(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const deliveryId = searchParams.get('deliveryId');
  const batchId = searchParams.get('batchId');
  const courseId = searchParams.get('courseId');

  if (sessionId) {
    // 按场次获取签到列表
    const { data: records, error } = await client
      .from('course_attendance')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ records: records || [] });
  }

  // 按交付记录获取签到状态
  if (deliveryId) {
    const { data: deliveries, error } = await client
      .from('course_deliveries')
      .select('id, user_id, attendance_status, scheduled_date, courses(name)')
      .eq('batch_id', batchId || '')
      .eq('course_id', courseId || '');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deliveries: deliveries || [] });
  }

  return NextResponse.json({ error: '缺少查询参数' }, { status: 400 });
}

// POST /api/course-attendance - 生成签到码 / 签到
export async function POST(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const { action, sessionId, deliveryIds, checkInCode } = body;

  if (action === 'generateCode') {
    // 培训老师生成签到码
    if (user.role !== 'teacher' && user.role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训老师可生成签到码' }, { status: 403 });
    }

    const code = generateCheckInCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5分钟有效

    // 将签到码写入对应场次的签到记录
    if (deliveryIds && Array.isArray(deliveryIds)) {
      // 创建签到记录
      const attendanceRecords = deliveryIds.map((did: number) => ({
        session_id: sessionId || null,
        user_id: String(user.id),
        status: 'pending',
        check_in_code: code,
        check_in_method: 'code',
        created_at: new Date().toISOString(),
      }));

      const { error } = await client.from('course_attendance').insert(attendanceRecords);
      if (error) {
        // 如果插入失败，至少返回签到码
        console.error('Insert attendance error:', error);
      }
    }

    return NextResponse.json({ code, expiresAt });
  }

  if (action === 'checkIn') {
    // 新人签到
    if (user.role !== 'trainee') {
      return NextResponse.json({ error: '仅新人可签到' }, { status: 403 });
    }

    if (!checkInCode) {
      return NextResponse.json({ error: '请输入签到码' }, { status: 400 });
    }

    // 查找有效签到码
    const { data: records, error } = await client
      .from('course_attendance')
      .select('*')
      .eq('check_in_code', checkInCode)
      .eq('status', 'pending');

    if (error || !records || records.length === 0) {
      return NextResponse.json({ error: '签到码无效或已过期' }, { status: 400 });
    }

    // 更新签到状态
    await client
      .from('course_attendance')
      .update({ status: 'present', check_in_method: 'code' })
      .eq('check_in_code', checkInCode)
      .eq('user_id', String(user.id));

    return NextResponse.json({ success: true, message: '签到成功' });
  }

  if (action === 'manualCheckIn') {
    // 手动签到（培训老师帮新人标记）
    if (user.role !== 'teacher' && user.role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训老师可手动签到' }, { status: 403 });
    }

    const { deliveryId, attendanceStatus } = body;
    if (!deliveryId || !attendanceStatus) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    await client
      .from('course_deliveries')
      .update({
        attendance_status: attendanceStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

// PATCH /api/course-attendance - 批量更新签到状态
export async function PATCH(request: NextRequest) {
  const client = getSupabaseClient();
  const user = getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (user.role !== 'teacher' && user.role !== 'training_manager') {
    return NextResponse.json({ error: '仅培训老师可修改签到' }, { status: 403 });
  }

  const body = await request.json();
  const { deliveryId, attendanceStatus } = body;

  if (!deliveryId || !attendanceStatus) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  await client
    .from('course_deliveries')
    .update({
      attendance_status: attendanceStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryId);

  return NextResponse.json({ success: true });
}
