import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ============================================================
// POST /api/practice/tasks — 创建临时演练任务
//   body: { assignedTo, title, description, taskTag, deadline, assignedBy }
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.assignedTo || !body.title || !body.assignedBy) {
      return NextResponse.json({ error: '缺少必填字段(assignedTo/title/assignedBy)' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('practice_tasks')
      .insert({
        task_type: 'temp_task',
        title: body.title,
        description: body.description || '',
        task_tag: body.taskTag || '',
        linked_course: null,
        linked_stage: null,
        linked_day_index: null,
        assigned_to: body.assignedTo,
        assigned_by: body.assignedBy,
        deadline: body.deadline || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // 写入通知：告知新人有新任务
    try {
      const { data: assignerData } = await supabase
        .from('users')
        .select('real_name')
        .eq('id', body.assignedBy)
        .maybeSingle();
      const assignerName = (assignerData as Record<string, unknown>)?.real_name || '培训负责人';
      await supabase.from('notifications').insert({
        user_id: body.assignedTo,
        type: 'new_task',
        title: '新演练任务',
        message: `${assignerName} 给你布置了新的演练任务：${body.title}`,
        related_type: 'practice_task',
        related_id: Number((data as Record<string, unknown>).id),
        is_read: false,
      });
    } catch (nErr) {
      console.error('Notification error:', nErr);
    }

    return NextResponse.json({ success: true, task: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ============================================================
// GET /api/practice/tasks — 查询某个新人的演练任务
//   ?assignedTo=xxx
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const taskType = searchParams.get('taskType');

    let query = supabase
      .from('practice_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (taskType) query = query.eq('task_type', taskType);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tasks: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
