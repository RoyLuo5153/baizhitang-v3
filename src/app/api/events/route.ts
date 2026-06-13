import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/events — 查询事件流
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const type = searchParams.get('type');
    const days = searchParams.get('days') || '30';

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_events', {
      user_id_filter: userId || null,
      event_type_filter: type || null,
      days_filter: parseInt(days, 10),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ events: Array.isArray(data) ? data : [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/events — 手动写入事件（也可由其他模块自动触发）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, userId, actorId, sourceTable, sourceId, eventData, happenedAt } = body;

    if (!eventType || !userId || !sourceTable || !sourceId) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('events')
      .insert({
        event_type: eventType,
        user_id: userId,
        actor_id: actorId || null,
        source_table: sourceTable,
        source_id: sourceId,
        event_data: eventData || null,
        happened_at: happenedAt || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, event: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
