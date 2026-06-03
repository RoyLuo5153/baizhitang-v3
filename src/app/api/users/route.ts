import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/users — 获取用户列表（支持?roleId=2筛选带教老师）
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const roleIdFilter = url.searchParams.get('roleId');

    let query = supabase
      .from('users')
      .select('id, username, real_name, role_id, is_active, created_at')
      .order('id');

    if (roleIdFilter) {
      query = query.eq('role_id', Number(roleIdFilter));
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 获取角色名映射
    const { data: roles } = await supabase.from('roles').select('id, name');
    const roleMap: Record<number, string> = {};
    (roles || []).forEach((r: { id: number; name: string }) => { roleMap[r.id] = r.name; });

    // 获取阶段信息
    const userIds = (data || []).map((u: { id: string }) => u.id);
    const { data: profiles } = await supabase
      .from('trainee_profiles')
      .select('user_id, current_stage')
      .in('user_id', userIds);

    const stageMap: Record<string, number> = {};
    (profiles || []).forEach((p: { user_id: string; current_stage: number }) => {
      stageMap[p.user_id] = p.current_stage;
    });

    const users = (data || []).map((u: { id: string; username: string; real_name: string; role_id: number; is_active: boolean; created_at: string }) => ({
      id: u.id,
      username: u.username,
      realName: u.real_name,
      roleId: u.role_id,
      roleName: roleMap[u.role_id] || '未知',
      stage: stageMap[u.id] || null,
      status: u.is_active !== false ? 'active' : 'inactive',
      createdAt: u.created_at,
    }));

    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/users — 更新用户信息
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, realName, roleId, stage, status } = body;
    if (!userId) return NextResponse.json({ error: '缺少userId' }, { status: 400 });

    const supabase = getSupabaseClient();

    // 更新users表
    const updateData: Record<string, unknown> = {};
    if (realName !== undefined) updateData.real_name = realName;
    if (roleId !== undefined) updateData.role_id = roleId;
    if (status !== undefined) updateData.is_active = status === 'active';

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('users').update(updateData).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 更新阶段（trainee_profiles表）
    if (stage !== undefined) {
      const { data: existing } = await supabase
        .from('trainee_profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('trainee_profiles').update({ current_stage: stage }).eq('user_id', userId);
      } else {
        await supabase.from('trainee_profiles').insert({ user_id: userId, current_stage: stage });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/users — 删除用户
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    if (!userId) return NextResponse.json({ error: '缺少id参数' }, { status: 400 });

    const supabase = getSupabaseClient();

    // 先删除关联表
    await supabase.from('trainee_profiles').delete().eq('user_id', userId);
    await supabase.from('daily_plans').delete().eq('user_id', userId);
    await supabase.from('practice_tasks').delete().eq('assigned_to', userId);

    // 删除用户
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
