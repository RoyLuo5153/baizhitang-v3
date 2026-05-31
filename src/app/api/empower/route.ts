import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/empower - 获取赋能方案列表
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const category = searchParams.get('category');

  let query = client
    .from('empower_plans')
    .select('*')
    .eq('is_active', true);

  if (category) {
    query = query.contains('target_indicators', [category]);
  }

  const { data: plans, error } = await query.order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 如果指定了userId，获取该用户的赋能执行记录
  let executions: any[] = [];
  if (userId) {
    const { data: execs } = await client
      .from('empower_executions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    executions = execs || [];
  }

  // Map plans to frontend format
  const mappedPlans = (plans || []).map((p: any) => ({
    ...p,
    target_metrics: p.target_indicators,
    duration_days: p.estimated_hours ? Math.ceil(p.estimated_hours / 8) : 7,
    plan_type: p.indicator_key,
  }));

  return NextResponse.json({
    plans: mappedPlans,
    executions,
  });
}

// POST /api/empower - 创建赋能方案 / 推送赋能方案
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();

  // 如果是创建新方案
  if (body.name) {
    const { data, error } = await client
      .from('empower_plans')
      .insert({
        name: body.name,
        description: body.description,
        indicator_key: body.planType || body.targetMetrics?.[0] || 'general',
        target_indicators: body.targetMetrics || [],
        estimated_hours: (body.durationDays || 7) * 8,
        content: body.content || {},
        is_active: true,
      })
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // 如果是推送方案给用户
  const { planId, userIds, assignedBy } = body;
  if (!planId || !userIds || !Array.isArray(userIds)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const results = [];
  for (const uid of userIds) {
    const { data, error } = await client
      .from('empower_executions')
      .insert({
        plan_id: planId,
        user_id: uid,
        triggered_by: assignedBy || 'manual',
        status: 'assigned',
        started_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (error) {
      results.push({ userId: uid, error: error.message });
    } else {
      results.push({ userId: uid, success: true, execution: data });
    }
  }

  return NextResponse.json({ results });
}
