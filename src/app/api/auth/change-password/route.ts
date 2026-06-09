import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyJWT, signJWT } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '请输入旧密码和新密码' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码至少6位' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取当前用户的密码hash
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, password_hash, real_name, role_id, is_active, is_super_admin, stage')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 验证旧密码
    let oldPasswordValid = false;
    if (user.password_hash.startsWith('bt:')) {
      // 旧格式：bt:前缀 + 明文比对
      const plainPassword = user.password_hash.slice(3);
      oldPasswordValid = oldPassword === plainPassword;
    } else {
      // 新格式：bcrypt比对
      oldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
    }

    if (!oldPasswordValid) {
      return NextResponse.json({ error: '旧密码不正确' }, { status: 400 });
    }

    if (oldPassword === newPassword) {
      return NextResponse.json({ error: '新密码不能与旧密码相同' }, { status: 400 });
    }

    // 用bcrypt哈希新密码
    const newHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: '密码更新失败' }, { status: 500 });
    }

    // 重新签发JWT（清除forceChangePassword标记）
    const { data: roleData } = await supabase
      .from('roles')
      .select('name')
      .eq('id', user.role_id)
      .single();

    const roleName = roleData?.name || 'trainee';

    // 获取权限列表（与login路由一致的两步查询）
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', user.role_id);

    const permIds = (rolePerms || []).map((rp: { permission_id: number }) => rp.permission_id);

    let permissions: string[] = [];
    if (permIds.length > 0) {
      const { data: permData } = await supabase
        .from('permissions')
        .select('code')
        .in('id', permIds);
      permissions = (permData || []).map((p: { code: string }) => p.code);
    }

    const newToken = await signJWT({
      userId: user.id,
      username: user.username,
      realName: user.real_name,
      role: roleName,
      stage: String(user.stage ?? 'foundation'),
      permissions,
      isSuperAdmin: user.is_super_admin || false,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set('auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('[auth/change-password] error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
