import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles, ROLES } from '@/lib/auth/api-auth';
import { onTraineeRegistered } from '@/lib/triggers';
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
    const roleNameFilter = url.searchParams.get('role'); // e.g. ?role=mentor

    // 如果按角色名查询，先查角色ID
    let resolvedRoleId = roleIdFilter ? Number(roleIdFilter) : null;
    if (roleNameFilter && !resolvedRoleId) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleNameFilter)
        .maybeSingle();
      if (roleData) resolvedRoleId = roleData.id;
    }

    let query = supabase
      .from('users')
      .select('id, username, real_name, role_id, is_active, is_super_admin, created_at, mentor_id, mentor_status')
      .order('id');

    if (resolvedRoleId) {
      query = query.eq('role_id', resolvedRoleId);
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

    const users = (data || []).map((u: { id: string; username: string; real_name: string; role_id: number; is_active: boolean; is_super_admin: boolean; created_at: string }) => ({
      id: u.id,
      username: u.username,
      realName: u.real_name,
      roleId: u.role_id,
      roleName: roleMap[u.role_id] || '未知',
      isSuperAdmin: u.is_super_admin || false,
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

      // 通知带教老师 + 培训负责人
      try {
        // 尝试查找学员的导师
        const { data: mentorLink } = await supabase
          .from('mentor_trainees')
          .select('mentor_id')
          .eq('trainee_id', newUser.id)
          .maybeSingle();
        await onTraineeRegistered(newUser.id, realName, mentorLink?.mentor_id || undefined);
      } catch {
        // 通知失败不影响主流程
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
    const { userId, realName, roleId, stage, status, cohort, password, resetPassword, mentorId } = body;
    if (!userId) return NextResponse.json({ error: '缺少userId' }, { status: 400 });

    // 禁止修改自己的角色（防止提权/降权）
    if (String(userId) === String(auth.userId) && roleId !== undefined) {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 403 });
    }

    // 超级管理员保护：非超管不能修改超管的角色/状态/密码
    if (!auth.isSuperAdmin) {
      const supabase = getSupabaseClient();
      const { data: targetUser } = await supabase
        .from('users')
        .select('is_super_admin')
        .eq('id', userId)
        .maybeSingle();
      if (targetUser?.is_super_admin) {
        return NextResponse.json({ error: '无权修改超级管理员账号' }, { status: 403 });
      }
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

    // 更新带教老师分配
    if (mentorId !== undefined) {
      updateData.mentor_id = mentorId || null;
      updateData.mentor_status = mentorId ? 'assigned' : null;
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('users').update(updateData).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 分配带教老师后，同步更新mentor_trainees表 + 发送通知
    if (mentorId !== undefined && mentorId) {
      // upsert mentor_trainees
      const { data: existingMt } = await supabase
        .from('mentor_trainees')
        .select('id')
        .eq('mentor_id', mentorId)
        .eq('trainee_id', userId)
        .maybeSingle();
      if (!existingMt) {
        await supabase.from('mentor_trainees').insert({
          mentor_id: mentorId,
          trainee_id: userId,
          status: 'active',
        });
      }
      // 通知带教老师
      try {
        const { sendNotification } = await import('@/lib/triggers');
        // 获取新人姓名
        const { data: traineeUser } = await supabase
          .from('users')
          .select('real_name')
          .eq('id', userId)
          .single();
        await sendNotification({
          userId: mentorId,
          type: 'mentor_assigned',
          title: '新分配的带教学员',
          message: `${traineeUser?.real_name || '新人'}已分配给您作为带教学员，请关注其成长进度`,
        });
      } catch (notifErr) {
        console.error('[L2] 通知发送失败:', notifErr);
      }
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
    // 鉴权：仅 training_manager/boss 可删除用户
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    if (!userId) return NextResponse.json({ error: '缺少id参数' }, { status: 400 });

    const supabase = getSupabaseClient();

    // 超级管理员保护：禁止删除超管账号
    const { data: targetUser } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', userId)
      .maybeSingle();
    if (targetUser?.is_super_admin && !auth.isSuperAdmin) {
      return NextResponse.json({ error: '无权删除超级管理员账号' }, { status: 403 });
    }

    // 先删除关联表（按外键依赖顺序，先删子表再删父表）
    // 带user_id/trainee_id/mentor_id等外键引用users.id的表
    const relatedDeletions = [
      // 学习相关
      { table: 'module_progress', column: 'user_id' },
      { table: 'level_progress', column: 'user_id' },
      { table: 'quiz_attempts', column: 'user_id' },
      // 业务数据
      { table: 'business_data', column: 'user_id' },
      { table: 'trainee_monthly_data', column: 'user_id' },
      // 质检相关
      { table: 'qc_records', column: 'user_id' },
      // 赋能相关
      { table: 'empower_executions', column: 'user_id' },
      // 诊断
      { table: 'quadrant_snapshots', column: 'user_id' },
      // 评估
      { table: 'assessment_targets', column: 'user_id' },
      { table: 'daily_assessments', column: 'trainee_id' },
      // 知识库
      { table: 'knowledge_bookmarks', column: 'user_id' },
      // 资源
      { table: 'resource_views', column: 'user_id' },
      // 通知
      { table: 'notifications', column: 'user_id' },
      // 成长计划
      { table: 'daily_plans', column: 'user_id' },
      // 核心动作评分(通过qc_records关联)
      // action_scores无user_id列，通过record_id→qc_records.user_id级联删除
      // 演练任务
      { table: 'practice_tasks', column: 'assigned_to' },
      // 阶段申请
      { table: 'stage_applications', column: 'trainee_id' },
      // 课程考勤
      { table: 'course_attendance', column: 'user_id' },
      // 课程交付
      { table: 'course_deliveries', column: 'user_id' },
      // 培训批次学员
      { table: 'batch_trainees', column: 'user_id' },
      // 日程变更日志
      { table: 'schedule_change_logs', column: 'changed_by' },
      // 带教关系
      { table: 'mentor_trainees', column: 'trainee_id' },
      // 学员档案（放在最后，其他表可能还引用它）
      { table: 'trainee_profiles', column: 'user_id' },
    ];

    for (const { table, column } of relatedDeletions) {
      await supabase.from(table).delete().eq(column, userId);
    }

    // 第二轮：清理以该用户为mentor/teacher/reviewer等角色的关联记录
    const mentorDeletions = [
      { table: 'mentor_trainees', column: 'mentor_id' },
      { table: 'coaching_records', column: 'mentor_id' },
      { table: 'course_deliveries', column: 'mentor_id' },
      { table: 'batch_trainees', column: 'mentor_id' },
      { table: 'plan_stage_courses', column: 'teacher_id' },
      { table: 'course_deliveries', column: 'teacher_id' },
    ];
    for (const { table, column } of mentorDeletions) {
      await supabase.from(table).delete().eq(column, userId);
    }

    // 第三轮：清理created_by/assessor/reviewer等操作者关联（置空而非删除，保留业务记录）
    const nullifyColumns = [
      { table: 'assessments', column: 'created_by' },
      { table: 'resources', column: 'uploaded_by' },
      { table: 'training_plans', column: 'manager_id' },
      { table: 'training_batches', column: 'created_by' },
    ];
    for (const { table, column } of nullifyColumns) {
      await supabase.from(table).update({ [column]: null }).eq(column, userId);
    }

    // 知识库文章：将author_id置空而非删除，保留文章内容
    await supabase.from('knowledge_articles').update({ author_id: null }).eq('author_id', userId);

    // QC记录中的reviewer_id置空
    await supabase.from('qc_records').update({ reviewer_id: null }).eq('reviewer_id', userId);

    // 日常考核中的assessor_id置空
    await supabase.from('daily_assessments').update({ assessor_id: null }).eq('assessor_id', userId);

    // 阶段申请中的reviewer_id置空
    await supabase.from('stage_applications').update({ reviewer_id: null }).eq('reviewer_id', userId);

    // 辅导记录中的trainee_id置空
    await supabase.from('coaching_records').update({ trainee_id: null }).eq('trainee_id', userId);

    // 删除用户
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
