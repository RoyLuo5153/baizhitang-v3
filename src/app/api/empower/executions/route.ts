import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';
import { onEmpowerAssigned } from '@/lib/triggers';

export async function GET(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const planId = searchParams.get('planId');
    const status = searchParams.get('status');

    let query = supabase
      .from('empower_executions')
      .select('*, empower_plans(name, description, indicator_key, estimated_hours, content, target_indicators)')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (planId) query = query.eq('plan_id', planId);
    if (status) query = query.eq('status', status);

    const { data: executions, error } = await query;

    if (error) throw error;

    // Collect unique user_ids for batch lookup
    const userIds = [...new Set((executions || []).map((e: Record<string, unknown>) => String(e.user_id)))];

    // Batch fetch user info (trainee names)
    let userMap: Record<string, { real_name: string; role_id: number }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, real_name, role_id')
        .in('id', userIds);
      (users || []).forEach((u: Record<string, unknown>) => {
        userMap[String(u.id)] = { real_name: String(u.real_name || ''), role_id: Number(u.role_id || 0) };
      });
    }

    // Batch fetch latest QC records for each trainee (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    let qcMap: Record<string, { avg_score: number; latest_date: string }> = {};
    if (userIds.length > 0) {
      const { data: qcRecords } = await supabase
        .from('qc_records')
        .select('user_id, score, created_at')
        .in('user_id', userIds)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      // Group by user_id, compute avg score of latest 5
      const grouped: Record<string, number[]> = {};
      (qcRecords || []).forEach((qc: Record<string, unknown>) => {
        const uid = String(qc.user_id);
        if (!grouped[uid]) grouped[uid] = [];
        if (grouped[uid].length < 5) grouped[uid].push(Number(qc.score || 0));
      });
      for (const [uid, scores] of Object.entries(grouped)) {
        const latest = qcRecords?.find((qc: Record<string, unknown>) => String(qc.user_id) === uid);
        qcMap[uid] = {
          avg_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0,
          latest_date: latest ? String(latest.created_at) : '',
        };
      }
    }

    // Batch fetch coaching record counts per execution
    const executionIds = (executions || []).map((e: Record<string, unknown>) => Number(e.id));
    let coachingCountMap: Record<number, number> = {};
    if (executionIds.length > 0) {
      const { data: coachingCounts } = await supabase
        .from('coaching_records')
        .select('execution_id')
        .in('execution_id', executionIds);
      (coachingCounts || []).forEach((cr: Record<string, unknown>) => {
        const eid = Number(cr.execution_id);
        coachingCountMap[eid] = (coachingCountMap[eid] || 0) + 1;
      });
    }

    // Enrich executions with user info, QC data, prescription content
    const enriched = (executions || []).map((exec: Record<string, unknown>) => {
      const plan = exec.empower_plans as Record<string, unknown> | null;
      // If execution doesn't have prescription_content, use plan's content
      if (!exec.prescription_content && plan?.content) {
        exec.prescription_content = plan.content;
      }
      // Attach trainee info
      const userInfo = userMap[String(exec.user_id)];
      exec.trainee_name = userInfo?.real_name || '未知学员';
      exec.trainee_role_id = userInfo?.role_id || 0;
      // Attach QC info
      const qcInfo = qcMap[String(exec.user_id)];
      exec.latest_qc_avg = qcInfo?.avg_score || 0;
      exec.latest_qc_date = qcInfo?.latest_date || '';
      // Attach coaching record count
      exec.coaching_count = coachingCountMap[Number(exec.id)] || 0;
      return exec;
    });

    return NextResponse.json({ executions: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[empower/executions POST] Error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { planId, traineeId, assignedBy, prescriptionContent, triggeredBy } = body;

    if (!planId || !traineeId) {
      return NextResponse.json({ error: 'Missing planId or traineeId' }, { status: 400 });
    }

    const numericPlanId = Number(planId);
    if (isNaN(numericPlanId)) {
      return NextResponse.json({ error: 'Invalid planId: must be a number' }, { status: 400 });
    }

    // Get plan content for prescription snapshot
    const { data: plan } = await supabase
      .from('empower_plans')
      .select('content')
      .eq('id', numericPlanId)
      .single();

    const { data, error } = await supabase
      .from('empower_executions')
      .insert({
        user_id: traineeId,
        plan_id: numericPlanId,
        assigned_by: assignedBy || null,
        triggered_by: triggeredBy || 'manual',
        status: 'assigned',
        progress: 0,
        started_at: new Date().toISOString(),
        prescription_content: prescriptionContent || plan?.content || null,
        completed_steps: [],
      })
      .select()
      .single();

    if (error) throw error;

    // DT-3: 同步事件流
    try {
      await supabase.from('events').insert({
        event_type: 'empowerment',
        user_id: traineeId,
        actor_id: assignedBy || null,
        source_table: 'empower_executions',
        source_id: (data as any)?.id || 0,
        event_data: { plan_id: numericPlanId, triggered_by: triggeredBy || 'manual' },
        happened_at: new Date().toISOString(),
      });
    } catch { /* 事件同步失败不影响主流程 */ }

    // 联动通知：通知新人 + 培训负责人 + 带教老师
    try {
      const { data: planInfo } = await supabase
        .from('empower_plans')
        .select('name')
        .eq('id', numericPlanId)
        .single();

      const { data: traineeInfo } = await supabase
        .from('users')
        .select('real_name')
        .eq('id', traineeId)
        .maybeSingle();

      await onEmpowerAssigned(
        traineeId,
        traineeInfo?.real_name || '未知学员',
        planInfo?.name || '未命名方案',
        numericPlanId,
        assignedBy || ''
      );
    } catch {
      // 通知失败不影响主流程
    }

    return NextResponse.json({ success: true, execution: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { executionId, status, progress, completedSteps, mentorNotes, improvementPct, afterQuadrant } = body;

    if (!executionId) {
      return NextResponse.json({ error: 'Missing executionId' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (progress !== undefined) updateData.progress = progress;
    if (completedSteps !== undefined) updateData.completed_steps = completedSteps;
    if (mentorNotes !== undefined) updateData.mentor_notes = mentorNotes;
    if (afterQuadrant !== undefined) updateData.after_quadrant = afterQuadrant;
    if (improvementPct !== undefined) updateData.improvement_pct = improvementPct;
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.progress = 100;
    }
    if (status === 'verified') updateData.verified_at = new Date().toISOString();
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('empower_executions')
      .update(updateData)
      .eq('id', executionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, execution: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
