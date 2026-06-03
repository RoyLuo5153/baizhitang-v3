import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 联动通知触发器
 * 在关键业务事件发生时，自动向相关人员发送通知
 */

// 通知类型定义
export type NotificationType =
  | 'quiz_failed'        // 闯关多次失败
  | 'task_overdue'       // 任务逾期
  | 'qc_low_score'       // 质检低分
  | 'stage_transition'   // 阶段转换
  | 'empower_auto'       // 自动赋能
  | 'practice_submitted' // 演练提交待点评
  | 'level_passed'       // 闯关通过
  | 'general';           // 通用通知

interface NotificationPayload {
  userId: string;          // 接收通知的用户ID
  type: NotificationType;
  title: string;
  message: string;
  relatedUserId?: string;  // 关联的用户ID（如新人的ID）
  relatedId?: number;      // 关联的业务ID
  priority?: 'low' | 'medium' | 'high';
}

/**
 * 发送通知
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const client = getSupabaseClient();

  await client.from('notifications').insert({
    user_id: payload.userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    related_id: payload.relatedUserId || (payload.relatedId ? String(payload.relatedId) : null),
    related_type: payload.relatedUserId ? 'user' : (payload.relatedId ? 'business' : null),
    priority: payload.priority || 'medium',
    is_read: false,
  });
}

/**
 * 获取新人的带教老师ID
 */
async function getMentorId(traineeId: string): Promise<string | null> {
  const client = getSupabaseClient();
  const { data } = await client
    .from('mentor_trainees')
    .select('mentor_id')
    .eq('trainee_id', traineeId)
    .maybeSingle();
  return data?.mentor_id || null;
}

/**
 * 获取培训负责人ID列表
 */
async function getTrainingManagerIds(): Promise<string[]> {
  const client = getSupabaseClient();
  const { data } = await client
    .from('users')
    .select('id')
    .eq('role_id', 4)
    .eq('is_active', true);
  return (data || []).map((u: any) => u.id);
}

/**
 * 闯关失败联动
 * 同一关卡失败3次 → 通知带教老师 + 培训负责人
 */
export async function onQuizFailed(
  traineeId: string,
  traineeName: string,
  levelId: number,
  levelName: string,
  failCount: number
): Promise<void> {
  if (failCount >= 3 && failCount % 3 === 0) {
    const mentorId = await getMentorId(traineeId);
    const managerIds = await getTrainingManagerIds();

    const title = `${traineeName}闯关多次未通过`;
    const message = `${traineeName}在第${levelId}关「${levelName}」已失败${failCount}次，需要辅导支持`;

    // 通知带教老师
    if (mentorId) {
      await sendNotification({
        userId: mentorId,
        type: 'quiz_failed',
        title,
        message,
        relatedUserId: traineeId,
        relatedId: levelId,
        priority: 'high',
      });
    }

    // 通知培训负责人
    for (const mgrId of managerIds) {
      await sendNotification({
        userId: mgrId,
        type: 'quiz_failed',
        title,
        message,
        relatedUserId: traineeId,
        relatedId: levelId,
        priority: 'medium',
      });
    }
  }
}

/**
 * 演练低分联动
 * 演练评分≤2分 → 通知带教老师安排辅导 + 可创建临时演练任务
 */
export async function onPracticeLowScore(
  traineeId: string,
  traineeName: string,
  submissionId: number,
  taskTitle: string,
  score: number
): Promise<void> {
  if (score <= 2) {
    const mentorId = await getMentorId(traineeId);

    if (mentorId) {
      await sendNotification({
        userId: mentorId,
        type: 'practice_submitted',
        title: `${traineeName}演练评分不达标`,
        message: `${traineeName}在「${taskTitle}」的演练评分仅${score}分（≤2分），建议安排针对性辅导或创建临时演练任务`,
        relatedUserId: traineeId,
        relatedId: submissionId,
        priority: 'high',
      });
    }

    // 通知培训负责人
    const managerIds = await getTrainingManagerIds();
    for (const mgrId of managerIds) {
      await sendNotification({
        userId: mgrId,
        type: 'practice_submitted',
        title: `${traineeName}演练评分不达标`,
        message: `${traineeName}在「${taskTitle}」的演练评分仅${score}分，带教老师：${mentorId || '未分配'}`,
        relatedUserId: traineeId,
        relatedId: submissionId,
        priority: 'medium',
      });
    }
  }
}

/**
 * 闯关通过联动
 * 通过关卡 → 检查是否触发阶段转换
 */
export async function onQuizPassed(
  traineeId: string,
  traineeName: string,
  levelId: number,
  totalPassed: number
): Promise<void> {
  const mentorId = await getMentorId(traineeId);

  // 闯关7关全通过 → 进入练习期
  if (totalPassed === 7) {
    await onStageTransition(traineeId, traineeName, 'learning', 'practice');
  }
}

/**
 * 阶段转换联动
 */
export async function onStageTransition(
  traineeId: string,
  traineeName: string,
  fromStage: string,
  toStage: string
): Promise<void> {
  const stageNames: Record<string, string> = {
    learning: '学习期', practice: '练习期', independent: '独立期', proficient: '熟练期',
  };

  const title = `${traineeName}进入${stageNames[toStage]}`;
  const message = `${traineeName}已完成${stageNames[fromStage]}，正式进入${stageNames[toStage]}`;

  // 通知带教老师
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'stage_transition',
      title,
      message,
      relatedUserId: traineeId,
      priority: 'high',
    });
  }

  // 通知培训负责人
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'stage_transition',
      title,
      message,
      relatedUserId: traineeId,
      priority: 'medium',
    });
  }
}

/**
 * 质检低分联动
 * 评分≤2分 → 自动创建赋能方案 + 通知
 */
export async function onQcLowScore(
  traineeId: string,
  traineeName: string,
  qcRecordId: number,
  avgScore: number
): Promise<void> {
  if (avgScore <= 2) {
    const client = getSupabaseClient();

    // 自动创建赋能方案
    const { data: existingPlan } = await client
      .from('empower_plans')
      .select('id')
      .eq('user_id', traineeId)
      .eq('status', 'active')
      .maybeSingle();

    if (!existingPlan) {
      await client.from('empower_plans').insert({
        user_id: traineeId,
        plan_type: 'qc_low_score',
        title: `质检低分赋能 - ${traineeName}`,
        description: `质检平均分${avgScore}分（≤2分），自动触发赋能方案`,
        status: 'active',
        source: 'auto',
        source_id: qcRecordId,
      });
    }

    // 通知带教老师
    const mentorId = await getMentorId(traineeId);
    if (mentorId) {
      await sendNotification({
        userId: mentorId,
        type: 'qc_low_score',
        title: `${traineeName}质检低分需关注`,
        message: `${traineeName}质检平均分仅${avgScore}分，已自动创建赋能方案`,
        relatedUserId: traineeId,
        relatedId: qcRecordId,
        priority: 'high',
      });
    }
  }
}

/**
 * 演练提交联动
 * 新人提交录音 → 通知带教老师点评
 */
export async function onPracticeSubmitted(
  traineeId: string,
  traineeName: string,
  submissionId: number,
  taskTitle: string
): Promise<void> {
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'practice_submitted',
      title: `${traineeName}提交了录音演练`,
      message: `${traineeName}提交了「${taskTitle}」的录音演练，请及时点评`,
      relatedUserId: traineeId,
      relatedId: submissionId,
      priority: 'medium',
    });
  }
}

/**
 * 任务逾期联动
 * 任务逾期未完成 → 通知带教老师 + 培训负责人
 */
export async function onTaskOverdue(
  traineeId: string,
  traineeName: string,
  planId: number,
  taskTitle: string,
  daysOverdue: number
): Promise<void> {
  const mentorId = await getMentorId(traineeId);

  const title = `${traineeName}任务逾期${daysOverdue}天`;
  const message = `${traineeName}的任务「${taskTitle}」已逾期${daysOverdue}天未完成`;

  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'task_overdue',
      title,
      message,
      relatedUserId: traineeId,
      relatedId: planId,
      priority: 'high',
    });
  }

  // 逾期3天以上通知培训负责人
  if (daysOverdue >= 3) {
    const managerIds = await getTrainingManagerIds();
    for (const mgrId of managerIds) {
      await sendNotification({
        userId: mgrId,
        type: 'task_overdue',
        title,
        message,
        relatedUserId: traineeId,
        relatedId: planId,
        priority: 'high',
      });
    }
  }
}
