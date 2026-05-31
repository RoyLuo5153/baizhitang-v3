import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const planId = searchParams.get('planId');
    const status = searchParams.get('status');

    let query = supabase
      .from('empower_executions')
      .select('*, empower_plans(name, description, indicator_key, estimated_hours)')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('trainee_id', userId);
    if (planId) query = query.eq('plan_id', planId);
    if (status) query = query.eq('status', status);

    const { data: executions, error } = await query;

    if (error) throw error;

    return NextResponse.json({ executions: executions || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { planId, traineeId, assignedBy } = body;

    if (!planId || !traineeId) {
      return NextResponse.json({ error: 'Missing planId or traineeId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('empower_executions')
      .insert({
        plan_id: planId,
        trainee_id: traineeId,
        assigned_by: assignedBy || null,
        status: 'assigned',
        progress: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

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
    const { executionId, status, progress, verifiedResult } = body;

    if (!executionId) {
      return NextResponse.json({ error: 'Missing executionId' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (progress !== undefined) updateData.progress = progress;
    if (verifiedResult) updateData.verified_result = verifiedResult;
    if (status === 'completed') updateData.completed_at = new Date().toISOString();
    if (status === 'verified') updateData.verified_at = new Date().toISOString();

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
