import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/capability — 查询能力评分
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_capability_scores', {
      user_id_filter: userId || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const scores = Array.isArray(data) ? data : [];

    // 雷达图格式：按维度聚合最新评分
    const radarData: Record<string, number> = {};
    const seen = new Set<string>();
    for (const s of scores) {
      if (!seen.has(s.dimension)) {
        radarData[s.dimension] = s.score;
        seen.add(s.dimension);
      }
    }

    return NextResponse.json({
      scores,
      radar: Object.entries(radarData).map(([dim, score]) => ({ dimension: dim, score })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/capability — 录入评分
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, dimension, score, level, sourceType, sourceId, scoredBy, scoredAt } = body;

    if (!userId || !dimension || score === undefined || !sourceType) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('capability_scores')
      .insert({
        user_id: userId,
        dimension,
        score,
        level: level || null,
        source_type: sourceType,
        source_id: sourceId || null,
        scored_by: scoredBy || null,
        scored_at: scoredAt || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, score: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
