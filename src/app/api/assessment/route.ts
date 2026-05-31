import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const view = searchParams.get('view') || 'own';

    if (view === 'team') {
      // Team view: get all assessments with user info
      const { data: assessments, error } = await supabase
        .from('daily_assessments')
        .select('*, users:assessor_id(real_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ assessments: assessments || [] });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get assessments for this user
    const { data: assessments, error } = await supabase
      .from('daily_assessments')
      .select('*')
      .eq('trainee_id', userId)
      .order('assessment_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ assessments: assessments || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { traineeId, type, title, scores, comment, assessorId, dueDate } = body;

    if (!traineeId || !type || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('daily_assessments')
      .insert({
        trainee_id: traineeId,
        assessor_id: assessorId || null,
        assessment_type: type,
        title,
        scores: scores || {},
        comment: comment || '',
        assessment_date: new Date().toISOString().split('T')[0],
        due_date: dueDate || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assessment: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
