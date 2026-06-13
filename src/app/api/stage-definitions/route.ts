import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles, ROLES } from '@/lib/auth/api-auth';

// GET /api/stage-definitions — 查询阶段定义
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_stage_definitions');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ stages: Array.isArray(data) ? data : [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/stage-definitions — 更新阶段定义
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { stageName, durationDays, exitCriteria, autoTriggerRules, warningThresholds } = body;

    if (!stageName) return NextResponse.json({ error: '缺少stageName' }, { status: 400 });

    const supabase = getSupabaseClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (durationDays !== undefined) updateData.duration_days = durationDays;
    if (exitCriteria !== undefined) updateData.exit_criteria = exitCriteria;
    if (autoTriggerRules !== undefined) updateData.auto_trigger_rules = autoTriggerRules;
    if (warningThresholds !== undefined) updateData.warning_thresholds = warningThresholds;

    const { data, error } = await supabase
      .from('stage_definitions')
      .update(updateData)
      .eq('stage_name', stageName)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, stage: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
