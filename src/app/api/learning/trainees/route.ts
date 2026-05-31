import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const mentorId = request.nextUrl.searchParams.get('mentorId');

    if (!mentorId) {
      return NextResponse.json({ error: 'mentorId is required' }, { status: 400 });
    }

    // Get trainees assigned to this mentor
    const { data: mentorTrainees, error: mtError } = await supabase
      .from('mentor_trainees')
      .select('trainee_id')
      .eq('mentor_id', mentorId);

    if (mtError) throw mtError;

    if (!mentorTrainees || mentorTrainees.length === 0) {
      return NextResponse.json({ trainees: [] });
    }

    const traineeIds = mentorTrainees.map((mt: { trainee_id: string }) => mt.trainee_id);
    if (traineeIds.length === 0) {
      return NextResponse.json({ trainees: [] });
    }

    // Get trainee user info
    const { data: traineeUsers, error: usersError } = await supabase
      .from('users')
      .select('id, real_name, stage')
      .in('id', traineeIds)
      .eq('is_active', true);

    if (usersError) throw usersError;

    // Get level progress for each trainee
    const { data: allProgress, error: progressError } = await supabase
      .from('level_progress')
      .select('user_id, level_id, status, best_score')
      .in('user_id', traineeIds);

    if (progressError) throw progressError;

    // Build trainee progress list
    const trainees = (traineeUsers || []).map((u: { id: string; real_name: string; stage: number }) => {
      const userProgress = (allProgress || []).filter(
        (p: { user_id: string }) => p.user_id === u.id
      );
      const passedCount = userProgress.filter(
        (p: { status: string }) => p.status === 'passed'
      ).length;
      const currentLevel = userProgress
        .filter((p: { status: string }) => p.status === 'in_progress' || p.status === 'active')
        .sort((a: { level_id: number }, b: { level_id: number }) => a.level_id - b.level_id)[0]?.level_id || passedCount + 1;

      return {
        userId: u.id,
        realName: u.real_name,
        stage: u.stage || 1,
        passedLevels: passedCount,
        totalLevels: 21,
        currentLevel,
        lastAttempt: null as string | null,
      };
    });

    return NextResponse.json({ trainees });
  } catch (err) {
    console.error('learning/trainees error:', JSON.stringify(err, null, 2));
    const message = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
