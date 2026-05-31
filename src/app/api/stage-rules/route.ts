import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('stage_rules')
    .select('*')
    .order('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by rule_type
  const promotion = data.filter((r: Record<string, unknown>) => r.rule_type === 'promotion');
  const warning = data.filter((r: Record<string, unknown>) => r.rule_type === 'warning');
  const demotion = data.filter((r: Record<string, unknown>) => r.rule_type === 'demotion');

  return NextResponse.json({ promotion, warning, demotion, all: data });
}

export async function PUT(request: NextRequest) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { id, rule_config, description, is_active } = body as {
    id: number;
    rule_config?: Record<string, unknown>;
    description?: string;
    is_active?: boolean;
  };

  if (!id) {
    return NextResponse.json({ error: '缺少规则ID' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (rule_config !== undefined) updateData.rule_config = rule_config;
  if (description !== undefined) updateData.description = description;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data, error } = await supabase
    .from('stage_rules')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rule: data });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { from_stage, to_stage, rule_type, rule_config, description } = body as {
    from_stage: number;
    to_stage: number;
    rule_type: string;
    rule_config: Record<string, unknown>;
    description: string;
  };

  if (!rule_type || !rule_config || !description) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('stage_rules')
    .insert({ from_stage, to_stage, rule_type, rule_config, description, is_active: true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rule: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少规则ID' }, { status: 400 });
  }

  const { error } = await supabase.from('stage_rules').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
