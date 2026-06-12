/**
 * 学习路径引擎
 * 为新用户自动生成D1-D7每日学习计划
 */

import { pgQuery } from '@/storage/database/pg-client';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getNthWorkday } from '@/lib/workday-utils';
import { sendNotification } from '@/lib/triggers';

export interface LearningPlan {
  id: number;
  user_id: string;
  day_number: number;
  title: string;
  purpose: string;
  problem_solved: string | null;
  learning_form: string | null;
  verification_standard: string | null;
  scheduled_date: string;
  deadline: string;
  status: 'pending' | 'completed' | 'overdue' | 'skipped';
  completed_at: string | null;
  sort_order: number;
  source_template_id: number | null;
}

interface PathTemplate {
  id: number;
  stage: number;
  day_number: number;
  title: string;
  purpose: string;
  problem_solved: string | null;
  learning_form: string | null;
  verification_standard: string | null;
  sort_order: number;
}

/**
 * 为新用户自动生成学习计划
 */
export async function generateLearningPlan(userId: string): Promise<LearningPlan[]> {
  const supabase = getSupabaseClient();

  // 1. 查询用户入职日期
  const user = await pgQuery<{ created_at: string; real_name: string }>(
    `SELECT created_at, real_name FROM users WHERE id = $1`,
    [userId]
  );
  if (user.length === 0) {
    throw new Error(`用户 ${userId} 不存在`);
  }

  const startDate = new Date(user[0].created_at);

  // 2. 查询模板
  const templates = await pgQuery<Record<string, unknown>>(
    `SELECT id, stage, day_number, title, purpose, problem_solved, learning_form, verification_standard, sort_order
     FROM learning_path_templates
     WHERE stage = 1 AND is_active = true
     ORDER BY day_number`
  );

  if (templates.length === 0) {
    throw new Error('没有可用的学习路径模板');
  }

  // 3. 检查是否已存在计划
  const existing = await pgQuery<{ id: number }>(
    `SELECT id FROM learning_plans WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (existing.length > 0) {
    throw new Error('该用户已有学习计划，请勿重复生成');
  }

  // 4. 为每个模板生成计划（使用 Supabase 客户端执行 INSERT）
  const plans: LearningPlan[] = [];
  for (const tpl of templates) {
    const scheduledDate = await getNthWorkday(startDate, Number(tpl.day_number));
    const dateStr = scheduledDate.toISOString().split('T')[0];
    const deadline = new Date(scheduledDate);
    deadline.setHours(18, 0, 0, 0);

    const { data, error } = await supabase
      .from('learning_plans')
      .insert({
        user_id: userId,
        day_number: Number(tpl.day_number),
        title: tpl.title,
        purpose: tpl.purpose,
        problem_solved: tpl.problem_solved || null,
        learning_form: tpl.learning_form || null,
        verification_standard: tpl.verification_standard || null,
        scheduled_date: dateStr,
        deadline: deadline.toISOString(),
        status: 'pending',
        sort_order: Number(tpl.sort_order),
        source_template_id: Number(tpl.id),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建学习计划失败: ${error.message}`);
    }
    plans.push(data as unknown as LearningPlan);
  }

  // 5. 发送欢迎通知
  const userName = user[0].real_name || '新人';
  await sendNotification({
    userId,
    type: 'learning_plan_generated',
    title: '学习计划已生成',
    message: `${userName}，您的D1-D7每日学习计划已生成，请登录查看今日任务。`,
    priority: 'high',
  });

  return plans;
}

/**
 * 检查用户的D7综合考核是否完成
 */
export async function isD7Completed(userId: string): Promise<boolean> {
  const result = await pgQuery<{ count: string }>(
    `SELECT COUNT(*) as count FROM learning_plans
     WHERE user_id = $1 AND day_number = 7 AND status = 'completed'`,
    [userId]
  );
  return parseInt(result[0].count, 10) > 0;
}

/**
 * 批量重排日期：以新的起始日重新计算D1-D7的scheduled_date
 */
export async function reschedulePlans(
  userId: string,
  newStartDate: Date,
  editedBy: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const plans = await pgQuery<{ id: number; day_number: number }>(
    `SELECT id, day_number FROM learning_plans WHERE user_id = $1 ORDER BY day_number`,
    [userId]
  );

  for (const plan of plans) {
    const newDate = await getNthWorkday(newStartDate, Number(plan.day_number));
    const dateStr = newDate.toISOString().split('T')[0];
    const deadline = new Date(newDate);
    deadline.setHours(18, 0, 0, 0);

    await supabase
      .from('learning_plans')
      .update({
        scheduled_date: dateStr,
        deadline: deadline.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id);

    // 记录编辑日志
    await supabase.from('learning_plan_edit_logs').insert({
      plan_id: plan.id,
      edited_by: editedBy,
      action: 'reschedule',
      after_snapshot: { scheduled_date: dateStr, deadline: deadline.toISOString() },
    });
  }
}
