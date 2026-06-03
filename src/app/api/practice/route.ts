import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onPracticeSubmitted, onPracticeLowScore } from '@/lib/triggers';

// ============================================================
// GET /api/practice — 按角色分化返回演练数据
//   ?userId=xxx &role=trainee|mentor|training_manager
//   trainee: 我的待完成演练任务 + 历史提交和审核反馈
//   mentor/training_manager: 待审核列表 + 已审核历史
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') || 'trainee';

    if (!userId) {
      return NextResponse.json({ error: '缺少userId' }, { status: 400 });
    }

    if (role === 'trainee') {
      // ── 新人视角：待完成演练任务 + 历史提交 ──
      const { data: pendingTasks } = await supabase
        .from('practice_tasks')
        .select('*')
        .eq('assigned_to', userId)
        .in('status', ['pending', 'submitted'])
        .order('deadline', { ascending: true, nullsFirst: false });

      const { data: historyTasks } = await supabase
        .from('practice_tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('status', 'reviewed')
        .order('created_at', { ascending: false })
        .limit(20);

      // 查询对应的submissions获取评分和反馈
      const taskIds = (historyTasks || []).map((t: Record<string, unknown>) => t.submission_id).filter(Boolean);
      let submissions: Record<string, unknown>[] = [];
      if (taskIds.length > 0) {
        const { data: subData } = await supabase
          .from('practice_submissions')
          .select('*')
          .in('id', taskIds);
        submissions = (subData || []) as Record<string, unknown>[];
      }

      const submissionMap = new Map(submissions.map((s: Record<string, unknown>) => [String(s.id), s]));

      // 给历史任务附上评审信息
      const historyWithFeedback = (historyTasks || []).map((task: Record<string, unknown>) => {
        const sub = task.submission_id ? submissionMap.get(String(task.submission_id)) : null;
        return { ...task, review: sub ? { score: sub.review_score, comment: sub.review_comment, reviewer_id: sub.reviewer_id, reviewed_at: sub.reviewed_at } : null };
      });

      // 统计
      const pendingCount = (pendingTasks || []).filter((t: Record<string, unknown>) => t.status === 'pending').length;
      const submittedCount = (pendingTasks || []).filter((t: Record<string, unknown>) => t.status === 'submitted').length;
      const reviewedCount = (historyTasks || []).length;

      return NextResponse.json({
        role: 'trainee',
        pendingTasks: pendingTasks || [],
        history: historyWithFeedback,
        stats: { pending: pendingCount, submitted: submittedCount, reviewed: reviewedCount },
      });
    } else {
      // ── 带教老师/培训负责人视角：待审核 + 已审核 ──
      // 待审核：status=submitted的practice_tasks，关联trainee信息
      const { data: pendingReview } = await supabase
        .from('practice_tasks')
        .select('*')
        .eq('status', 'submitted')
        .order('created_at', { ascending: true });

      // 获取对应的submissions和trainee信息
      const pendingIds = (pendingReview || []).map((t: Record<string, unknown>) => t.submission_id).filter(Boolean);
      let pendingSubs: Record<string, unknown>[] = [];
      if (pendingIds.length > 0) {
        const { data: subData } = await supabase
          .from('practice_submissions')
          .select('*')
          .in('id', pendingIds);
        pendingSubs = (subData || []) as Record<string, unknown>[];
      }
      const subMap = new Map(pendingSubs.map((s: Record<string, unknown>) => [String(s.id), s]));

      // 获取trainee名字
      const traineeIds = [...new Set((pendingReview || []).map((t: Record<string, unknown>) => t.assigned_to).filter(Boolean))] as string[];
      let traineeMap = new Map<string, string>();
      if (traineeIds.length > 0) {
        const { data: trainees } = await supabase
          .from('users')
          .select('id, real_name')
          .in('id', traineeIds);
        (trainees || []).forEach((u: Record<string, unknown>) => {
          traineeMap.set(String(u.id), String(u.real_name));
        });
      }

      const pendingWithDetails = (pendingReview || []).map((task: Record<string, unknown>) => {
        const sub = task.submission_id ? subMap.get(String(task.submission_id)) : null;
        return {
          ...task,
          trainee_name: traineeMap.get(String(task.assigned_to)) || '未知',
          submission: sub ? { id: sub.id, file_url: sub.file_url, submitted_at: sub.submitted_at, description: sub.description } : null,
        };
      });

      // 已审核历史
      const { data: reviewedHistory } = await supabase
        .from('practice_tasks')
        .select('*')
        .eq('status', 'reviewed')
        .order('created_at', { ascending: false })
        .limit(30);

      const reviewedIds = (reviewedHistory || []).map((t: Record<string, unknown>) => t.submission_id).filter(Boolean);
      let reviewedSubs: Record<string, unknown>[] = [];
      if (reviewedIds.length > 0) {
        const { data: subData } = await supabase
          .from('practice_submissions')
          .select('*')
          .in('id', reviewedIds);
        reviewedSubs = (subData || []) as Record<string, unknown>[];
      }
      const reviewedSubMap = new Map(reviewedSubs.map((s: Record<string, unknown>) => [String(s.id), s]));

      // 获取reviewed的trainee名字
      const reviewedTraineeIds = [...new Set((reviewedHistory || []).map((t: Record<string, unknown>) => t.assigned_to).filter(Boolean))] as string[];
      if (reviewedTraineeIds.length > 0) {
        const { data: trainees } = await supabase
          .from('users')
          .select('id, real_name')
          .in('id', reviewedTraineeIds);
        (trainees || []).forEach((u: Record<string, unknown>) => {
          traineeMap.set(String(u.id), String(u.real_name));
        });
      }

      const reviewedWithDetails = (reviewedHistory || []).map((task: Record<string, unknown>) => {
        const sub = task.submission_id ? reviewedSubMap.get(String(task.submission_id)) : null;
        return {
          ...task,
          trainee_name: traineeMap.get(String(task.assigned_to)) || '未知',
          review: sub ? { score: sub.review_score, comment: sub.review_comment, reviewer_id: sub.reviewer_id, reviewed_at: sub.reviewed_at } : null,
        };
      });

      // 获取核心动作列表（用于评分）
      const { data: coreActions } = await supabase
        .from('core_actions')
        .select('id, node_key, node_name, action_index, action_name, scoring_5, scoring_4, scoring_3, scoring_2, scoring_0')
        .order('node_key', { ascending: true })
        .order('action_index', { ascending: true });

      return NextResponse.json({
        role: 'reviewer',
        pendingReview: pendingWithDetails,
        reviewedHistory: reviewedWithDetails,
        coreActions: coreActions || [],
        stats: {
          pendingReview: (pendingReview || []).length,
          reviewed: (reviewedHistory || []).length,
        },
      });
    }
  } catch (error: unknown) {
    console.error('[practice] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ============================================================
// POST /api/practice — 新人提交演练录音
//   body: { taskId, fileUrl, description }
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.taskId || !body.traineeId) {
      return NextResponse.json({ error: '缺少taskId或traineeId' }, { status: 400 });
    }

    // 获取task信息
    const { data: task } = await supabase
      .from('practice_tasks')
      .select('*')
      .eq('id', body.taskId)
      .eq('assigned_to', body.traineeId)
      .maybeSingle();

    if (!task) {
      return NextResponse.json({ error: '任务不存在或不属于该新人' }, { status: 404 });
    }

    // 创建submission
    const { data: submission, error: subErr } = await supabase
      .from('practice_submissions')
      .insert({
        trainee_id: body.traineeId,
        task_id: body.taskId,
        task_type: (task as Record<string, unknown>).task_type || 'system_task',
        task_tag: (task as Record<string, unknown>).task_tag,
        linked_course: (task as Record<string, unknown>).linked_course,
        assigned_by: (task as Record<string, unknown>).assigned_by,
        submission_type: body.submissionType || 'recording',
        title: (task as Record<string, unknown>).title || body.title || '录音演练',
        description: body.description || '',
        file_url: body.fileUrl || '',
        status: 'submitted',
      })
      .select()
      .single();

    if (subErr) throw subErr;

    // 更新task状态和关联submission
    await supabase
      .from('practice_tasks')
      .update({
        status: 'submitted',
        submission_id: (submission as Record<string, unknown>).id,
      })
      .eq('id', body.taskId);

    // 联动触发：通知带教老师点评
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('real_name')
        .eq('id', body.traineeId)
        .maybeSingle();
      const traineeName = (userData as Record<string, unknown>)?.real_name || body.traineeId;
      await onPracticeSubmitted(
        body.traineeId,
        String(traineeName),
        Number((submission as Record<string, unknown>).id) || 0,
        String((task as Record<string, unknown>).title) || '录音演练'
      );
    } catch (triggerErr) {
      console.error('Practice trigger error:', triggerErr);
    }

    // 系统盯人：演练提交自动触发质检任务
    try {
      const qcType = body.submissionType === 'screenshot' ? 'wechat' : 'recording';
      await supabase.from('qc_records').insert({
        user_id: body.traineeId,
        qc_type: qcType,
        qc_date: new Date().toISOString().split('T')[0],
        audio_url: body.fileUrl || null,
        source_type: 'practice_submission',
        source_id: Number((submission as Record<string, unknown>).id) || null,
        status: 'pending',
      });
    } catch (qcErr) {
      console.error('Auto QC creation error:', qcErr);
    }

    return NextResponse.json({ success: true, submission });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/practice — 带教老师审核评分
//   body: { submissionId, reviewScore(0-5), reviewComment, reviewDetail, pass }
// ============================================================
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    // 验证5级评分
    const validScores = [0, 2, 3, 4, 5];
    if (body.reviewScore !== undefined && !validScores.includes(body.reviewScore)) {
      return NextResponse.json({ error: '评分必须为0/2/3/4/5' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
    };
    if (body.reviewerId) updateData.reviewer_id = body.reviewerId;
    if (body.reviewScore !== undefined) updateData.review_score = body.reviewScore;
    if (body.reviewComment !== undefined) updateData.review_comment = body.reviewComment;

    const { data, error } = await supabase
      .from('practice_submissions')
      .update(updateData)
      .eq('id', body.submissionId)
      .select()
      .single();

    if (error) throw error;

    // 更新关联的practice_task状态
    if ((data as Record<string, unknown>)?.task_id) {
      const newStatus = body.pass === false ? 'pending' : 'reviewed';
      const taskUpdate: Record<string, unknown> = { status: newStatus };
      // 如果不通过，清除submission_id让新人重新提交
      if (body.pass === false) {
        taskUpdate.submission_id = null;
      }
      await supabase
        .from('practice_tasks')
        .update(taskUpdate)
        .eq('submission_id', body.submissionId);
    }

    // 联动触发：低分(≤2分)自动通知
    if (body.reviewScore !== undefined && body.reviewScore <= 2 && (data as Record<string, unknown>)?.trainee_id) {
      try {
        const traineeId = String((data as Record<string, unknown>).trainee_id);
        const { data: userData } = await supabase
          .from('users')
          .select('real_name')
          .eq('id', traineeId)
          .maybeSingle();
        const traineeName = (userData as Record<string, unknown>)?.real_name || traineeId;
        await onPracticeLowScore(traineeId, String(traineeName), Number((data as Record<string, unknown>).id), String((data as Record<string, unknown>).title) || '录音演练', body.reviewScore);
      } catch (triggerErr) {
        console.error('Practice low score trigger error:', triggerErr);
      }
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
