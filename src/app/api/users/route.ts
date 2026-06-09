import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles, ROLES } from '@/lib/auth/api-auth';
import bcrypt from 'bcryptjs';

// GET /api/users — 获取用户列表（支持?roleId=2筛选带教老师）
export async function GET(req: NextRequest) {
  try {
    // 鉴权：仅 training_manager/boss 可查看用户列表
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

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

    // 获取阶段和期数信息
    const userIds = (data || []).map((u: { id: string }) => u.id);
    const { data: profiles } = await supabase
      .from('trainee_profiles')
      .select('user_id, stage, cohort')
      .in('user_id', userIds);

    const profileMap: Record<string, { stage: string; cohort: string | null }> = {};
    (profiles || []).forEach((p: { user_id: string; stage: string; cohort: string | null }) => {
      profileMap[p.user_id] = { stage: p.stage, cohort: p.cohort };
    });

    // 获取学员的带教老师信息
    const traineeIds = (data || []).filter((u: { role_id: number }) => u.role_id === 1).map((u: { id: string }) => u.id);
    let mentorMap: Record<string, string> = {};
    if (traineeIds.length > 0) {
      const { data: mentorLinks } = await supabase
        .from('mentor_trainees')
        .select('trainee_id, mentor_id')
        .in('trainee_id', traineeIds)
        .eq('is_active', true);
      
      const mentorIds = [...new Set((mentorLinks || []).map((m: { mentor_id: string }) => m.mentor_id))];
      let mentorNames: Record<string, string> = {};
      if (mentorIds.length > 0) {
        const { data: mentorUsers } = await supabase
          .from('users')
          .select('id, real_name')
          .in('id', mentorIds);
        (mentorUsers || []).forEach((m: { id: string; real_name: string }) => { mentorNames[m.id] = m.real_name; });
      }
      (mentorLinks || []).forEach((m: { trainee_id: string; mentor_id: string }) => {
        mentorMap[m.trainee_id] = mentorNames[m.mentor_id] || '';
      });
    }

    const stageNumberMap: Record<string, number> = { foundation: 1, practice: 2, independent: 3, proficient: 4 };

    const users = (data || []).map((u: { id: string; username: string; real_name: string; role_id: number; is_active: boolean; created_at: string }) => ({
      id: u.id,
      username: u.username,
      realName: u.real_name,
      roleId: u.role_id,
      roleName: roleMap[u.role_id] || '未知',
      stage: profileMap[u.id]?.stage ? (stageNumberMap[profileMap[u.id].stage] || null) : null,
      cohort: profileMap[u.id]?.cohort || null,
      mentorName: mentorMap[u.id] || null,
      status: u.is_active !== false ? 'active' : 'inactive',
      createdAt: u.created_at,
    }));

    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/users — 添加用户
export async function POST(req: NextRequest) {
  try {
    // 鉴权：仅 training_manager/boss 可创建用户
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { username, realName, password, roleId, stage, cohort } = body;

    if (!username || !realName || !roleId) {
      return NextResponse.json({ error: '缺少必填字段: username, realName, roleId' }, { status: 400 });
    }

    // 操作审计
    console.log(`[AUDIT] 用户创建: 操作人=${auth.userId}(${auth.role}), 新用户=${username}, roleId=${roleId}`);

    const supabase = getSupabaseClient();

    // 审计日志（异步不阻塞）
    supabase.from('audit_logs').insert({
      operator_id: Number(auth.userId),
      operator_name: auth.username || auth.userId,
      action: 'create_user',
      target_type: 'user',
      target_id: username,
      details: { realName, roleId, stage, cohort }
    }).then(() => {});

    // 检查用户名是否重复
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    // 插入users表
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username,
        real_name: realName,
        password_hash: password ? await bcrypt.hash(password, 10) : await bcrypt.hash('bt2026', 10),
        role_id: roleId,
        is_active: true,
        stage: stage || 1,
      })
      .select('id, username, real_name, role_id, is_active, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 如果是trainee(role_id=1)，同时创建trainee_profiles记录
    if (roleId === 1) {
      const profileData: Record<string, unknown> = {
        user_id: newUser.id,
        stage: stage || 1,
        process_status: 'not_started',
        result_status: 'not_started',
        profile_status: 'training',
        hire_date: new Date().toISOString().split('T')[0],
      };
      if (cohort) profileData.cohort = cohort;

      const { error: profileError } = await supabase
        .from('trainee_profiles')
        .insert(profileData);

      if (profileError) {
        console.error('创建trainee_profile失败:', profileError.message);
      }
    }

    return NextResponse.json({ success: true, user: { id: newUser.id, username: newUser.username } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/users — 更新用户信息
export async function PUT(req: NextRequest) {
  try {
    // 鉴权：仅 training_manager/boss 可修改用户
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { userId, realName, roleId, stage, status, cohort, password, resetPassword } = body;
    if (!userId) return NextResponse.json({ error: '缺少userId' }, { status: 400 });

    // 禁止修改自己的角色（防止提权/降权）
    if (String(userId) === String(auth.userId) && roleId !== undefined) {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 403 });
    }

    // 操作审计：记录谁修改了谁
    console.log(`[AUDIT] 用户修改: 操作人=${auth.userId}(${auth.role}), 目标用户=${userId}, 变更字段=${Object.keys(body).filter(k => k !== 'userId').join(',')}`);
    const supabase = getSupabaseClient();
    await supabase.from('audit_logs').insert({
      operator_id: Number(auth.userId),
      operator_name: auth.username || auth.userId,
      action: 'update_user',
      target_type: 'user',
      target_id: String(userId),
      details: { changedFields: Object.keys(body).filter(k => k !== 'userId') }
    }).then(() => {});

    // 更新users表
    const updateData: Record<string, unknown> = {};
    if (realName !== undefined) updateData.real_name = realName;
    if (roleId !== undefined) updateData.role_id = roleId;
    if (status !== undefined) updateData.is_active = status === 'active';
    // 密码重置（管理员操作）：用bt:前缀标记，强制用户下次登录改密
    // 普通密码修改走 /api/auth/change-password（bcrypt格式）
    if (resetPassword && password) {
      updateData.password_hash = `bt:${password}`;
    } else if (password !== undefined) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('users').update(updateData).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 更新阶段和期数（trainee_profiles表）
    const profileUpdate: Record<string, unknown> = {};
    if (stage !== undefined) {
      const stageMap: Record<number, string> = { 1: 'foundation', 2: 'practice', 3: 'independent', 4: 'proficient' };
      profileUpdate.stage = typeof stage === 'number' ? (stageMap[stage] || 'foundation') : stage;
    }
    if (cohort !== undefined) profileUpdate.cohort = cohort;

    if (Object.keys(profileUpdate).length > 0) {
      const { data: existing } = await supabase
        .from('trainee_profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('trainee_profiles').update(profileUpdate).eq('user_id', userId);
      } else {
        await supabase.from('trainee_profiles').insert({ user_id: userId, ...profileUpdate });
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
