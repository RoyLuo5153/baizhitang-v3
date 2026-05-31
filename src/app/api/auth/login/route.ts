import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 查询用户
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, username, real_name, role_id, stage, is_active')
      .eq('username', username)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '账号已停用' }, { status: 403 });
    }

    // V1: 简单密码验证（所有测试账号密码为 bt2026）
    if (password !== 'bt2026') {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 获取角色信息
    const { data: role } = await client
      .from('roles')
      .select('id, name, description')
      .eq('id', user.role_id)
      .maybeSingle();

    const roleName = role?.name || 'trainee';

    // 获取权限列表
    const { data: rolePerms } = await client
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', user.role_id);

    const permIds = (rolePerms || []).map((rp: { permission_id: number }) => rp.permission_id);

    let permissions: string[] = [];
    if (permIds.length > 0) {
      const { data: perms } = await client
        .from('permissions')
        .select('code')
        .in('id', permIds);
      permissions = (perms || []).map((p: { code: string }) => p.code);
    }

    // 简单token (V1先用base64, 后续改JWT)
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      realName: user.real_name,
      role: roleName,
      stage: user.stage,
      permissions,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    // 更新最后登录时间
    await client
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: roleName,
        primaryRole: roleName,
        stage: user.stage,
        permissions,
      },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登录失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
