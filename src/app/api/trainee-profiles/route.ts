import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Get all trainees with their profiles and monthly data
    const { data: profiles, error: profileError } = await supabase
      .from('trainee_profiles')
      .select('*, users:user_id(real_name, username, is_active, mentor_id)');

    if (profileError) {
      console.error('[trainee-profiles] GET profiles error:', profileError);
      return NextResponse.json({ error: '获取新人档案失败' }, { status: 500 });
    }

    // Get mentor names
    const mentorIds = [...new Set(
      (profiles || [])
        .map((p: Record<string, unknown>) => (p.users as Record<string, unknown>)?.mentor_id as string)
        .filter(Boolean)
    )];

    let mentorMap: Record<string, string> = {};
    if (mentorIds.length > 0) {
      const { data: mentors } = await supabase
        .from('users')
        .select('id, real_name')
        .in('id', mentorIds);
      (mentors || []).forEach((m: { id: string; real_name: string }) => {
        mentorMap[m.id] = m.real_name;
      });
    }

    // Get monthly data for all trainees
    const userIds = (profiles || []).map((p: Record<string, unknown>) => p.user_id as string);
    let monthlyDataMap: Record<string, Record<string, unknown>> = {};

    if (userIds.length > 0) {
      const { data: monthlyData } = await supabase
        .from('trainee_monthly_data')
        .select('*')
        .in('user_id', userIds);

      (monthlyData || []).forEach((md: Record<string, unknown>) => {
        const uid = md.user_id as string;
        if (!monthlyDataMap[uid]) monthlyDataMap[uid] = {};
        monthlyDataMap[uid][md.month_index as number] = {
          month_key: md.month_key,
          resource_count: md.resource_count,
          reception_rate: md.reception_rate,
          avg_price: md.avg_price,
          is_qualified: md.is_qualified,
          data_type: md.data_type,
        };
      });
    }

    // Get level progress for each trainee
    let levelProgressMap: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: levelProgress } = await supabase
        .from('level_progress')
        .select('user_id, status')
        .in('user_id', userIds)
        .eq('status', 'passed');

      (levelProgress || []).forEach((lp: Record<string, unknown>) => {
        const uid = lp.user_id as string;
        levelProgressMap[uid] = (levelProgressMap[uid] || 0) + 1;
      });
    }

    // Compose response
    const result = (profiles || []).map((p: Record<string, unknown>) => {
      const userInfo = p.users as Record<string, unknown> | null;
      const mentorId = userInfo?.mentor_id as string | null;
      return {
        user_id: p.user_id,
        real_name: userInfo?.real_name || '',
        username: userInfo?.username || '',
        hire_date: p.hire_date || '',
        expected_group_date: p.expected_group_date || '',
        group_date: p.group_date || null,
        department: p.department || '',
        position: p.position || '',
        phone: p.phone || '',
        mentor_id: mentorId || null,
        mentor_name: mentorId ? (mentorMap[mentorId] || null) : null,
        profile_status: p.profile_status || 'training',
        remark: p.remark || '',
        passed_levels: levelProgressMap[p.user_id as string] || 0,
        completed_tasks: p.completed_tasks || 0,
        open_weaknesses: p.open_weaknesses || 0,
        monthly_data: monthlyDataMap[p.user_id as string] || {},
        user_status: userInfo?.is_active ? 'active' : 'inactive',
        created_at: p.created_at,
      };
    });

    return NextResponse.json({ profiles: result, success: true });
  } catch (error: unknown) {
    console.error('[trainee-profiles] GET error:', error);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, field, value } = body;

    if (!userId || !field) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Mentor is stored on users table, not trainee_profiles
    if (field === 'mentor_id') {
      const { error } = await supabase
        .from('users')
        .update({ mentor_id: value || null })
        .eq('id', userId);

      if (error) {
        console.error('[trainee-profiles] PUT mentor update error:', error);
        return NextResponse.json({ error: '更新带教老师失败' }, { status: 500 });
      }
      return NextResponse.json({ message: '更新成功', success: true });
    }

    // Map frontend field names to DB columns
    const fieldMap: Record<string, string> = {
      hire_date: 'hire_date',
      expected_group_date: 'expected_group_date',
      group_date: 'group_date',
      department: 'department',
      position: 'position',
      phone: 'phone',
      status: 'profile_status',
      remark: 'remark',
    };

    const dbField = fieldMap[field];
    if (!dbField) {
      return NextResponse.json({ error: '无效字段' }, { status: 400 });
    }

    // Update or insert profile
    const { data: existing } = await supabase
      .from('trainee_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('trainee_profiles')
        .update({ [dbField]: value || null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.error('[trainee-profiles] PUT update error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from('trainee_profiles')
        .insert({ user_id: userId, [dbField]: value || null });

      if (error) {
        console.error('[trainee-profiles] PUT insert error:', error);
        return NextResponse.json({ error: '创建档案失败' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: '更新成功', success: true });
  } catch (error: unknown) {
    console.error('[trainee-profiles] PUT error:', error);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
