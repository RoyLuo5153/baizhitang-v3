import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('stage_applications')
      .select('*, trainee:users!stage_applications_trainee_id_fkey(real_name, username, stage), reviewer:users!stage_applications_reviewer_id_fkey(real_name)')
      .order('applied_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ applications: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('stage_applications')
      .insert({
        trainee_id: body.traineeId,
        from_stage: body.fromStage,
        to_stage: body.toStage,
        reason: body.reason || '',
        evidence: body.evidence || {},
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.applicationId) {
      return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
      reviewed_at: new Date().toISOString(),
    };
    if (body.reviewerId) updateData.reviewer_id = body.reviewerId;
    if (body.reviewComment) updateData.review_comment = body.reviewComment;

    const { data, error } = await supabase
      .from('stage_applications')
      .update(updateData)
      .eq('id', body.applicationId)
      .select()
      .single();

    if (error) throw error;

    // If approved, update user's stage
    if (body.status === 'approved' && data) {
      await supabase
        .from('users')
        .update({ stage: data.to_stage })
        .eq('id', data.trainee_id);
    }

    return NextResponse.json({ application: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
