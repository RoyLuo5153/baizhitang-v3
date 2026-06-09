import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

const supabase = getSupabaseClient();

// GET /api/assessment - 获取考核任务/记录
export async function GET(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未授权' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const view = searchParams.get('view') || 'own';

    // 获取考核记录，关联用户名
    const { data: assessments, error } = await supabase
      .from('daily_assessments')
      .select('*, trainee:users!daily_assessments_trainee_id_fkey(id, real_name, username), assessor:users!daily_assessments_assessor_id_fkey(id, real_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[assessment] GET error:', error);
      return NextResponse.json({ assessments: [], error: error.message }, { status: 500 });
    }

    // 转换数据
    const records = (assessments || []).map((a: Record<string, unknown>) => {
      const trainee = a.trainee as Record<string, unknown> | null;
      const assessor = a.assessor as Record<string, unknown> | null;
      const scores = (a.scores as Record<string, number>) || {};

      const overallScore = Object.keys(scores).length > 0
        ? Math.round(Object.values(scores).reduce((sum: number, v: number) => sum + v, 0) / Object.keys(scores).length)
        : 0;

      return {
        id: String(a.id),
        traineeId: a.trainee_id as string,
        traineeName: trainee?.real_name || '未知',
        assessorName: assessor?.real_name || '未知',
        assessmentTitle: a.title as string,
        type: a.assessment_type as string,
        date: a.assessment_date ? String(a.assessment_date).split('T')[0] : '',
        dueDate: a.due_date ? String(a.due_date).split('T')[0] : '',
        scores,
        overallScore,
        comment: a.comment || '',
        status: a.status as string,
      };
    });

    // 如果是个人视图，只返回自己的
    if (view === 'own' && userId) {
      const ownRecords = records.filter((r: Record<string, unknown>) => r.traineeId === userId);
      return NextResponse.json({ assessments: ownRecords });
    }

    // 聚合任务视图：按标题分组
    const taskMap = new Map<string, {
      id: string;
      title: string;
      type: string;
      dueDate: string;
      traineeNames: string[];
      totalTrainees: number;
      completedTrainees: number;
      completionRate: number;
    }>();

    for (const r of records) {
      const key = r.assessmentTitle as string;
      if (!taskMap.has(key)) {
        taskMap.set(key, {
          id: `task-${r.id as string}`,
          title: r.assessmentTitle as string,
          type: r.type as string,
          dueDate: r.dueDate as string,
          traineeNames: [] as string[],
          totalTrainees: 0,
          completedTrainees: 0,
          completionRate: 0,
        });
      }
      const task = taskMap.get(key)!;
      const traineeName = r.traineeName as string;
      if (!task.traineeNames.includes(traineeName)) {
        task.traineeNames.push(traineeName);
        task.totalTrainees++;
        if ((r.status as string) === 'completed') {
          task.completedTrainees++;
        }
      }
    }

    const tasks = Array.from(taskMap.values()).map(t => ({
      ...t,
      completionRate: t.totalTrainees > 0 ? Math.round((t.completedTrainees / t.totalTrainees) * 100) : 0,
    }));

    return NextResponse.json({ assessments: records, tasks });
  } catch (err) {
    console.error('[assessment] GET error:', err);
    return NextResponse.json({ assessments: [], tasks: [], error: 'Unknown error' }, { status: 500 });
  }
}

// POST /api/assessment - 发布考核（仅teacher/training_manager/mentor）
export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未授权' }, { status: 401 });
  if (!['teacher', 'training_manager', 'mentor'].includes(auth.role)) {
    return NextResponse.json({ error: '无权创建考核' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { traineeId, type, title, dueDate, scores, comment, dimensions } = body;
    // Use auth user as assessor
    const assessorId = auth.userId;

    if (!traineeId || !title) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('daily_assessments')
      .insert({
        trainee_id: traineeId,
        assessor_id: assessorId || null,
        assessment_type: type || 'daily',
        title,
        scores: scores || {},
        comment: comment || '',
        due_date: dueDate || null,
        assessment_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[assessment] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assessment: data });
  } catch (err) {
    console.error('[assessment] POST error:', err);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}

// PUT /api/assessment - 更新考核（评分）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, scores, comment, status } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少考核ID' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (scores) updateData.scores = scores;
    if (comment !== undefined) updateData.comment = comment;
    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.assessment_date = new Date().toISOString().split('T')[0];
      }
    }

    const { data, error } = await supabase
      .from('daily_assessments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[assessment] PUT error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assessment: data });
  } catch (err) {
    console.error('[assessment] PUT error:', err);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
