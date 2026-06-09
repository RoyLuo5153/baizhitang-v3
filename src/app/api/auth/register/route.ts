import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, real_name, password, role, roleId, department, position, mentor_id } = await request.json();

    if (!username || !real_name || !password) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    // Resolve roleId: prefer explicit roleId, fallback to role name lookup
    let resolvedRoleId = roleId;
    if (!resolvedRoleId) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', role || 'trainee')
        .maybeSingle();
      resolvedRoleId = roleData?.id || 1;
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error: createError } = await supabase
      .from('users')
      .insert({
        username,
        real_name,
        password_hash: passwordHash,
        role_id: resolvedRoleId,
        stage: 1,
        is_active: true,
        department: department || null,
        mentor_id: mentor_id || null,
      })
      .select('id, username, real_name')
      .single();

    if (createError || !user) {
      console.error('[auth/register] create user error:', createError);
      return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
    }

    // Create trainee profile
    await supabase
      .from('trainee_profiles')
      .insert({
        user_id: user.id,
        department: department || '',
        position: position || '',
        profile_status: 'training',
        hire_date: new Date().toISOString().split('T')[0],
      });

    return NextResponse.json({ message: '创建成功', user, success: true });
  } catch (error: unknown) {
    console.error('[auth/register] error:', error);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
