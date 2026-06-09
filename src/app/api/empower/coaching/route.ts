import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const traineeId = searchParams.get('traineeId');
    const mentorId = searchParams.get('mentorId');
    const executionId = searchParams.get('executionId');

    let query = supabase
      .from('coaching_records')
      .select('*, mentor:users!coaching_records_mentor_id_fkey(real_name), trainee:users!coaching_records_trainee_id_fkey(real_name)')
      .order('session_date', { ascending: false });

    if (traineeId) query = query.eq('trainee_id', traineeId);
    if (mentorId) query = query.eq('mentor_id', mentorId);
    if (executionId) query = query.eq('execution_id', executionId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ records: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未授权' }, { status: 401 });
  // 只有 mentor/training_manager 可创建辅导记录
  if (auth.role !== 'mentor' && auth.role !== 'training_manager' && auth.role !== 'boss') {
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
  }
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('coaching_records')
      .insert({
        execution_id: body.executionId || null,
        mentor_id: body.mentorId,
        trainee_id: body.traineeId,
        session_date: body.sessionDate || new Date().toISOString().split('T')[0],
        duration_minutes: body.durationMinutes || 30,
        content: body.content || '',
        mentor_comment: body.mentorComment || '',
        trainee_feedback: body.traineeFeedback || '',
        next_steps: body.nextSteps || '',
        status: body.status || 'completed',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
