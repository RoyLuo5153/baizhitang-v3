import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/thresholds - 获取阈值配置
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { data, error } = await client
    .from('thresholds')
    .select('*')
    .order('track', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map to frontend-friendly format
  const mapped = (data || []).map((t: any) => ({
    id: t.id,
    metric_key: t.indicator_key,
    metric_name: t.indicator_name,
    category: t.track,
    qualified_value: t.passing,
    good_value: t.good,
    excellent_value: t.excellent,
    unit: t.unit,
    description: t.description,
  }));

  return NextResponse.json({ data: mapped });
}

// PUT /api/thresholds - 更新阈值
export async function PUT(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const { id, qualified_value, good_value, excellent_value } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { data, error } = await client
    .from('thresholds')
    .update({
      passing: qualified_value,
      good: good_value,
      excellent: excellent_value,
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
