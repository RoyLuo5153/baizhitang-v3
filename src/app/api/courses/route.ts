import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const targetStage = searchParams.get('stage');

    let query = supabase
      .from('courses')
      .select('*, sessions:course_sessions(*, attendance:course_attendance(*))')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (targetStage) query = query.eq('target_stage', targetStage);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ courses: data || [] });
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
      .from('courses')
      .insert({
        name: body.name,
        description: body.description || '',
        category: body.category || '',
        instructor: body.instructor || '',
        duration_hours: body.durationHours || 0,
        target_stage: body.targetStage || 1,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ course: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
