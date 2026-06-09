import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { signJWT } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 查询用户（含 password_hash）
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, username, real_name, role_id, stage, is_active, is_super_admin, password_hash')
      .eq('username', username)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '账号已停用' }, { status: 403 });
    }

    // 密码验证：兼容旧格式(bt:)和新格式(bcrypt)
    let passwordValid = false;
    let forceChangePassword = false;

    if (user.password_hash?.startsWith('bt:')) {
      // 旧格式：提取 bt: 后面的部分做比对
      const oldPassword = user.password_hash.slice(3);
      if (password !== oldPassword) {
        return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
      }
      passwordValid = true;
      forceChangePassword = true; // 旧格式密码登录后强制改密码
    } else {
      // 新格式：bcrypt 比对
      const valid = await bcrypt.compare(password, user.password_hash || '');
      if (!valid) {
        return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
      }
      passwordValid = true;
    }

    if (!passwordValid) {
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

    // 签发 JWT
    const token = await signJWT({
      userId: user.id,
      username: user.username,
      realName: user.real_name,
      role: roleName,
      stage: String(user.stage ?? 'foundation'),
      permissions,
      isSuperAdmin: user.is_super_admin || false,
    });

    // 更新最后登录时间
    await client
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const response = NextResponse.json({
      success: true,
      token,
      forceChangePassword,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: roleName,
        primaryRole: roleName,
        stage: user.stage,
        permissions,
        isSuperAdmin: user.is_super_admin || false,
      },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
