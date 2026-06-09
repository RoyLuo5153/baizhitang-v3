import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/learning/heatmap - 学员闯关热力图数据
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 获取所有活跃关卡
    const { data: levels, error: levelsError } = await supabase
      .from('learning_levels')
      .select('level_id, name, stage, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (levelsError) throw levelsError;

    // 获取所有活跃学员
    const { data: trainees, error: traineesError } = await supabase
      .from('users')
      .select('id, real_name')
      .eq('is_active', true)
      .eq('role_id', 1); // trainee only

    if (traineesError) throw traineesError;

    if (!levels || levels.length === 0 || !trainees || trainees.length === 0) {
      return NextResponse.json({ levels: [], trainees: [] });
    }

    const traineeIds = trainees.map((t: { id: string }) => t.id);

    // 获取所有学员的关卡进度
    const { data: progress, error: progressError } = await supabase
      .from('level_progress')
      .select('user_id, level_id, status, best_score')
      .in('user_id', traineeIds);

    if (progressError) throw progressError;

    // 构建热力图数据
    const progressMap = new Map<string, { status: string; best_score: number | null }>();
    for (const p of (progress || [])) {
      progressMap.set(`${p.user_id}:${p.level_id}`, {
        status: p.status,
        best_score: p.best_score,
      });
    }

    const traineeData = trainees.map((t: { id: string; real_name: string }) => ({
      id: t.id,
      name: t.real_name,
      levels: levels.map((l: { level_id: number }) => {
        const entry = progressMap.get(`${t.id}:${l.level_id}`);
        const status: number = entry?.status === 'passed' ? 2 : entry?.status === 'in_progress' ? 1 : 0;
        return status;
      }),
      scores: levels.map((l: { level_id: number }) => {
        const entry = progressMap.get(`${t.id}:${l.level_id}`);
        return entry?.best_score ?? null;
      }),
    }));

    return NextResponse.json({
      levels: levels.map((l: { level_id: number; name: string; stage: number }) => ({
        id: l.level_id,
        name: l.name,
        stage: l.stage,
      })),
      trainees: traineeData,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
