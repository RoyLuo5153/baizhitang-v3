import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';
import { checkGraduation, executeGraduation } from '@/lib/graduation-engine';

/**
 * GET /api/graduation/check?userId=xxx — 检查出师条件
 * GET /api/graduation/list — 查询已出师新人列表
 * POST /api/graduation/confirm — 确认出师 { userId, confirmedBy }
 */

export async function GET(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'check';
  const targetUserId = searchParams.get('userId');

  if (action === 'list') {
    return handleList();
  }

  // check
  if (!targetUserId) {
    return NextResponse.json({ error: '缺少 userId 参数' }, { status: 400 });
  }

  const result = await checkGraduation(targetUserId);
  return NextResponse.json(result);
}

async function handleList() {
  const supabase = getSupabaseClient();

  const { data: graduated, error } = await supabase
    .from('users')
    .select(`
      id, username, real_name, department, stage, graduation_date, graduation_confirmed_by,
      mentor_trainees!trainee_id(mentor_id, users!mentor_id(real_name))
    `)
    .eq('role_id', 1)
    .not('graduation_date', 'is', null)
    .order('graduation_date', { ascending: false });

  if (error) {
    console.error('[graduation] list error:', error);
    return NextResponse.json({ error: '查询已出师列表失败' }, { status: 500 });
  }

  const list = (graduated || []).map(u => ({
    userId: u.id,
    username: u.username,
    realName: u.real_name,
    department: u.department,
    stage: u.stage,
    graduationDate: u.graduation_date,
    confirmedBy: u.graduation_confirmed_by,
  }));

  return NextResponse.json({ graduated: list, total: list.length });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 仅 training_manager 和 boss 可确认出师
  if (auth.role !== 'training_manager' && auth.role !== 'boss') {
    return NextResponse.json({ error: '仅培训负责人和老板可确认出师' }, { status: 403 });
  }

  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
  }

  const result = await executeGraduation(userId, auth.userId);
  return NextResponse.json(result);
}
