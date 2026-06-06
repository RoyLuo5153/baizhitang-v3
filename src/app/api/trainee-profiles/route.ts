import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 从请求cookie中解析auth_token获取用户身份
 * 统一身份校验：不依赖前端传参，从服务端cookie取
 */
function getAuthFromRequest(request: NextRequest): { userId: string; role: string } | null {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.userId && parsed.role) {
      return { userId: parsed.userId, role: parsed.role };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/trainee-profiles
 * 按角色过滤：
 * - mentor: 只返回 mentor_trainees 表中关联的新人
 * - training_manager/boss/teacher: 返回全部新人
 * - trainee: 返回自己
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 从cookie取身份，不依赖前端传参
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { userId, role } = auth;

    // 获取所有新人基本信息（role_id=1）
    const { data: allTrainees, error: usersError } = await supabase
      .from('users')
      .select('id, username, real_name, role_id, mentor_id, department, join_date, is_active')
      .eq('role_id', 1)
      .eq('is_active', true)
      .order('id');

    if (usersError) {
      console.error('[trainee-profiles] GET users error:', usersError);
      return NextResponse.json({ error: '查询用户失败' }, { status: 500 });
    }

    // 获取档案信息
    const { data: profiles, error: profilesError } = await supabase
      .from('trainee_profiles')
      .select('*');

    if (profilesError) {
      console.error('[trainee-profiles] GET profiles error:', profilesError);
      return NextResponse.json({ error: '查询档案失败' }, { status: 500 });
    }

    // 统一从 mentor_trainees 表获取带教关系
    const { data: mentorRelations, error: mentorError } = await supabase
      .from('mentor_trainees')
      .select('mentor_id, trainee_id');

    if (mentorError) {
      console.error('[trainee-profiles] GET mentor_trainees error:', mentorError);
      return NextResponse.json({ error: '查询带教关系失败' }, { status: 500 });
    }

    // 构建 mentor_trainees 映射：trainee_id -> mentor_id
    const traineeMentorMap: Record<string, string> = {};
    for (const rel of (mentorRelations || [])) {
      traineeMentorMap[rel.trainee_id] = rel.mentor_id;
    }

    // 获取所有导师信息（用于显示导师姓名）
    const { data: mentors } = await supabase
      .from('users')
      .select('id, real_name')
      .eq('role_id', 2)
      .eq('is_active', true);

    const mentorNameMap: Record<string, string> = {};
    for (const m of (mentors || [])) {
      mentorNameMap[m.id] = m.real_name;
    }

    // 按角色过滤新人列表
    let filteredTrainees = allTrainees || [];

    if (role === 'trainee') {
      // trainee 只看自己
      filteredTrainees = filteredTrainees.filter(t => String(t.id) === String(userId));
    } else if (role === 'mentor') {
      // mentor 只看 mentor_trainees 表中关联的新人
      const myTraineeIds = (mentorRelations || [])
        .filter(rel => String(rel.mentor_id) === String(userId))
        .map(rel => String(rel.trainee_id));
      filteredTrainees = filteredTrainees.filter(t => myTraineeIds.includes(String(t.id)));
    }
    // training_manager / boss / teacher 看全部

    // 组装返回数据
    const result = filteredTrainees.map(trainee => {
      const profile = (profiles || []).find(p => String(p.user_id) === String(trainee.id)) || {};
      const actualMentorId = traineeMentorMap[String(trainee.id)] || trainee.mentor_id;
      const mentorName = mentorNameMap[String(actualMentorId)] || '';

      return {
        id: trainee.id,
        username: trainee.username,
        realName: trainee.real_name,
        department: profile.department || trainee.department || '',
        position: profile.position || '',
        hireDate: profile.hire_date || trainee.join_date || '',
        mentorId: actualMentorId ? String(actualMentorId) : '',
        mentorName,
        profileStatus: profile.profile_status || '在培训',
        expectedGroupDate: profile.expected_group_date || '',
        groupDate: profile.group_date || '',
        cohort: profile.cohort || '',
        remarks: profile.remarks || '',
        profileId: profile.id || null,
        stage: profile.stage || 'foundation',
        processStatus: profile.process_status || 'not_started',
        resultStatus: profile.result_status || 'not_started',
      };
    });

    return NextResponse.json({
      trainees: result,
      currentUserId: userId,
      currentRole: role,
    });
  } catch (error: unknown) {
    console.error('[trainee-profiles] GET error:', error);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}

/**
 * PATCH /api/trainee-profiles
 * 更新新人档案字段
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { userId, field, value } = body;

    if (!userId || !field) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 字段映射
    const fieldMap: Record<string, string> = {
      department: 'department',
      position: 'position',
      hireDate: 'hire_date',
      mentorId: 'mentor_id',
      expectedGroupDate: 'expected_group_date',
      groupDate: 'group_date',
      profileStatus: 'profile_status',
      cohort: 'cohort',
      remarks: 'remarks',
    };

    const dbField = fieldMap[field];
    if (!dbField) {
      return NextResponse.json({ error: '无效字段' }, { status: 400 });
    }

    // 如果是更新带教老师，同步更新 mentor_trainees 表
    if (field === 'mentorId' && value) {
      // 先删除旧关系
      await supabase
        .from('mentor_trainees')
        .delete()
        .eq('trainee_id', userId);

      // 再插入新关系
      const { error: mentorError } = await supabase
        .from('mentor_trainees')
        .insert({ mentor_id: value, trainee_id: userId });

      if (mentorError) {
        console.error('[trainee-profiles] PATCH mentor_trainees error:', mentorError);
        return NextResponse.json({ error: '更新带教关系失败' }, { status: 500 });
      }

      // 同时更新 users.mentor_id 保持兼容
      await supabase
        .from('users')
        .update({ mentor_id: value })
        .eq('id', userId);
    }

    // 更新 trainee_profiles 表
    const { data: existingProfile } = await supabase
      .from('trainee_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      const { error } = await supabase
        .from('trainee_profiles')
        .update({ [dbField]: value || null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.error('[trainee-profiles] PATCH update error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from('trainee_profiles')
        .insert({ user_id: userId, [dbField]: value || null });

      if (error) {
        console.error('[trainee-profiles] PATCH insert error:', error);
        return NextResponse.json({ error: '创建档案失败' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: '更新成功', success: true });
  } catch (error: unknown) {
    console.error('[trainee-profiles] PATCH error:', error);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
