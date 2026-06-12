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

    // Enrich executions with prescription content
    const enriched = (executions || []).map((exec: Record<string, unknown>) => {
      const plan = exec.empower_plans as Record<string, unknown> | null;
      // If execution doesn't have prescription_content, use plan's content
      if (!exec.prescription_content && plan?.content) {
        exec.prescription_content = plan.content;
      }
      return exec;
    });

    return NextResponse.json({ executions: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
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

    // Get plan content for prescription snapshot
    const { data: plan } = await supabase
      .from('empower_plans')
      .select('content')
      .eq('id', planId)
      .single();

    const { data, error } = await supabase
      .from('empower_executions')
      .insert({
        user_id: traineeId,
        plan_id: planId,
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

    // 联动通知：通知新人 + 培训负责人 + 带教老师
    try {
      const { data: planInfo } = await supabase
        .from('empower_plans')
        .select('name')
        .eq('id', planId)
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
        planId,
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
