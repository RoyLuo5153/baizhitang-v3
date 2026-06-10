import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles } from '@/lib/auth/api-auth';
import { onEmpowerDueSoon } from '@/lib/triggers';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const roleCheck = requireRoles(auth, 'training_manager', 'boss');
    if (roleCheck) return roleCheck;

    const supabase = getSupabaseClient();

    // 查找3天内到期的赋能方案
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const todayStr = new Date().toISOString().split('T')[0];
    const laterStr = threeDaysLater.toISOString().split('T')[0];

    const { data: dueSoonExecutions, error } = await supabase
      .from('empower_executions')
      .select('id, user_id, plan_id, deadline, status')
      .in('status', ['assigned', 'in_progress'])
      .lte('deadline', laterStr)
      .gte('deadline', todayStr);

    if (error) {
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    let notifiedCount = 0;
    for (const exec of (dueSoonExecutions || [])) {
      try {
        // 查询方案名
        const { data: plan } = await supabase
          .from('empower_plans')
          .select('name')
          .eq('id', exec.plan_id)
          .single();
        const planName = plan?.name || '未命名方案';

        // 计算剩余天数
        const daysLeft = Math.ceil((new Date(exec.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        // 查找学员姓名
        const { data: trainee } = await supabase
          .from('users')
          .select('real_name')
          .eq('id', exec.user_id)
          .single();

        const traineeName = trainee?.real_name || '学员';
        await onEmpowerDueSoon(exec.user_id, traineeName, planName, Number(exec.plan_id), daysLeft);
        notifiedCount++;
      } catch {
        // 单条通知失败不影响其他
      }
    }

    return NextResponse.json({
      message: notifiedCount > 0 ? `已通知${notifiedCount}个即将到期赋能方案` : '无即将到期的赋能方案',
      notifiedCount,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
