import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles, ROLES } from '@/lib/auth/api-auth';

// GET /api/user-profiles — 查询用户画像列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');

    const supabase = getSupabaseClient();

    // 单个用户画像
    if (userId) {
      const { data, error } = await supabase.rpc('get_user_profiles', {
        role_filter: null,
        status_filter: null,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const profiles = Array.isArray(data) ? data : [];
      const profile = profiles.find((p: { user_id: string }) => p.user_id === userId);
      if (!profile) return NextResponse.json({ error: '用户画像不存在' }, { status: 404 });

      return NextResponse.json({ profile });
    }

    const { data, error } = await supabase.rpc('get_user_profiles', {
      role_filter: role || null,
      status_filter: status || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ profiles: Array.isArray(data) ? data : [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/user-profiles — 创建用户画像
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { userId, hireDate, mentorId, traineeGroup, trainingStatus } = body;

    if (!userId) return NextResponse.json({ error: '缺少userId' }, { status: 400 });

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trainee_profiles')
      .insert({
        user_id: userId,
        hire_date: hireDate || null,
        mentor_id: mentorId || null,
        trainee_group: traineeGroup || null,
        training_status: trainingStatus || '在培',
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, profile: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/user-profiles — 更新用户画像
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { userId, hireDate, currentStage, mentorId, traineeGroup, trainingStatus } = body;

    if (!userId) return NextResponse.json({ error: '缺少userId' }, { status: 400 });

    const supabase = getSupabaseClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (hireDate !== undefined) updateData.hire_date = hireDate;
    if (currentStage !== undefined) updateData.current_stage = currentStage;
    if (mentorId !== undefined) updateData.mentor_id = mentorId;
    if (traineeGroup !== undefined) updateData.trainee_group = traineeGroup;
    if (trainingStatus !== undefined) updateData.training_status = trainingStatus;

    const { data, error } = await supabase
      .from('trainee_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, profile: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
