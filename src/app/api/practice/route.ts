import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const traineeId = searchParams.get('traineeId');
    const status = searchParams.get('status');

    let query = supabase
      .from('practice_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (traineeId) query = query.eq('trainee_id', traineeId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    // Stats
    const total = (data || []).length;
    const submitted = (data || []).filter((s: Record<string, unknown>) => s.status === 'submitted').length;
    const reviewed = (data || []).filter((s: Record<string, unknown>) => s.status === 'reviewed').length;

    return NextResponse.json({
      submissions: data || [],
      stats: { total, submitted, reviewed, pendingReview: submitted },
    });
  } catch (error: unknown) {
    console.error('[practice] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('practice_submissions')
      .insert({
        trainee_id: body.traineeId,
        level_id: body.levelId,
        submission_type: body.submissionType || 'recording',
        title: body.title,
        description: body.description || '',
        file_url: body.fileUrl || '',
        status: 'submitted',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ submission: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: body.status || 'reviewed',
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
    return NextResponse.json({ submission: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
