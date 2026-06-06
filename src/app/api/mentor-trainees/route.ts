import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/mentor-trainees - 查询带教关系
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const mentorId = searchParams.get('mentorId');
    const traineeId = searchParams.get('traineeId');

    let query = supabase
      .from('mentor_trainees')
      .select(`
        id,
        mentor_id,
        trainee_id,
        start_date,
        end_date,
        is_active,
        created_at,
        mentor:users!mentor_trainees_mentor_id_fkey(id, real_name, username),
        trainee:users!mentor_trainees_trainee_id_fkey(id, real_name, username)
      `)
      .eq('is_active', true);

    if (mentorId) {
      query = query.eq('mentor_id', mentorId);
    }
    if (traineeId) {
      query = query.eq('trainee_id', traineeId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ relations: data });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/mentor-trainees - 分配带教关系
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { mentorId, traineeIds } = body;

    if (!mentorId || !traineeIds || !Array.isArray(traineeIds) || traineeIds.length === 0) {
      return NextResponse.json({ error: '缺少必要参数：mentorId 和 traineeIds' }, { status: 400 });
    }

    // 验证mentor存在且是mentor角色
    const { data: mentor } = await supabase
      .from('users')
      .select('id, role_id')
      .eq('id', mentorId)
      .single();

    if (!mentor || mentor.role_id !== 2) {
      return NextResponse.json({ error: '指定用户不是带教老师角色' }, { status: 400 });
    }

    // 验证所有trainee存在且是trainee角色
    const { data: trainees } = await supabase
      .from('users')
      .select('id, role_id')
      .in('id', traineeIds);

    const validTraineeIds = (trainees || [])
      .filter((t: { id: string; role_id: number }) => t.role_id === 1)
      .map((t: { id: string }) => t.id);

    if (validTraineeIds.length === 0) {
      return NextResponse.json({ error: '没有有效的学员可以分配' }, { status: 400 });
    }

    // 先把这些人之前的有效分配设为不活跃（换导师）
    const { error: deactivateError } = await supabase
      .from('mentor_trainees')
      .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
      .in('trainee_id', validTraineeIds)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('停用旧关系失败:', deactivateError);
    }

    // 批量插入新关系
    const inserts = validTraineeIds.map((tid: string) => ({
      mentor_id: mentorId,
      trainee_id: tid,
      start_date: new Date().toISOString().split('T')[0],
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('mentor_trainees')
      .insert(inserts)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assigned: data?.length || 0,
      skipped: traineeIds.length - validTraineeIds.length,
    });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/mentor-trainees - 解除带教关系
export async function DELETE(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const relationId = searchParams.get('id');

    if (!relationId) {
      return NextResponse.json({ error: '缺少关系ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('mentor_trainees')
      .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
      .eq('id', relationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
