import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles } from '@/lib/auth/api-auth';
import { onQualificationOverdue } from '@/lib/triggers';

/**
 * POST /api/trainee-profiles/check-qualification
 * 检查所有新人的资格期状态，对超期的新人触发通知
 * 可由 cron 或手动调用
 */
export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 只有培训负责人和超管可以触发检查
  const roleCheck = requireRoles(auth, 'training_manager', 'boss');
  if (roleCheck) return roleCheck;

  try {
    const supabase = getSupabaseClient();

    // 查询所有未转正且已超期的新人
    const { data: overdueProfiles, error } = await supabase
      .from('trainee_profiles')
      .select('user_id, qualification_deadline, qualification_period_days, profile_status')
      .neq('profile_status', 'qualified')
      .lt('qualification_deadline', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('[check-qualification] query error:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    if (!overdueProfiles || overdueProfiles.length === 0) {
      return NextResponse.json({ message: '无超期新人', overdueCount: 0 });
    }

    // 获取用户名
    const userIds = overdueProfiles.map((p: { user_id: string }) => p.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, real_name')
      .in('id', userIds);

    const userNameMap: Record<string, string> = {};
    for (const u of (users || [])) {
      userNameMap[String(u.id)] = u.real_name;
    }

    // 对每个超期新人发送通知
    const results: Array<{ userId: string; name: string; overdueDays: number }> = [];
    const today = new Date().toISOString().split('T')[0];

    // 检查今天是否已发送过资格期通知
    const { data: todayNotifications } = await supabase
      .from('notifications')
      .select('related_user_id')
      .eq('type', 'qualification_overdue')
      .gte('created_at', today);

    const alreadyNotified = new Set(
      (todayNotifications || []).map((n: { related_user_id: string }) => n.related_user_id)
    );

    for (const profile of overdueProfiles) {
      const overdueDays = Math.ceil(
        (Date.now() - new Date(profile.qualification_deadline).getTime()) / (1000 * 60 * 60 * 24)
      );
      const name = userNameMap[profile.user_id] || profile.user_id;

      // 通知规则：超期当天(1天) → 通知培训负责人 / 超期15天 → 额外通知总经理
      // 每人每天只通知一次
      if (!alreadyNotified.has(profile.user_id) && (overdueDays === 1 || overdueDays >= 15)) {
        await onQualificationOverdue(profile.user_id, name, overdueDays);
        results.push({ userId: profile.user_id, name, overdueDays });
      }
    }

    return NextResponse.json({
      message: `检查完成，${overdueProfiles.length}人已超期，${results.length}人触发通知`,
      overdueCount: overdueProfiles.length,
      notified: results,
    });
  } catch (error: unknown) {
    console.error('[check-qualification] error:', error);
    return NextResponse.json({ error: '检查失败' }, { status: 500 });
  }
}
