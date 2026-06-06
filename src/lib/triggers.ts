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
  | 'module_passed'      // 模块通关通过
  | 'module_failed'      // 模块通关未通过
  | 'process_flagged'    // 过程线预警
  | 'process_recovered'  // 过程线恢复
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

/**
 * 检查同阶段所有模块是否全部通过
 */
async function checkAllModulesPassed(traineeId: string, stage: string): Promise<boolean> {
  const client = getSupabaseClient();

  // 获取该阶段所有模块
  const { data: stageModules } = await client
    .from('assessment_modules')
    .select('code')
    .eq('stage', stage)
    .eq('is_active', true);

  if (!stageModules || stageModules.length === 0) return false;

  // 获取用户该阶段所有模块的进度
  const moduleCodes = stageModules.map((m: { code: string }) => m.code);
  const { data: progressList } = await client
    .from('module_progress')
    .select('module_code, status')
    .eq('user_id', traineeId)
    .in('module_code', moduleCodes);

  // 检查每个模块是否都已通过
  const passedCodes = new Set(
    (progressList || [])
      .filter((p: { status: string }) => p.status === 'passed')
      .map((p: { module_code: string }) => p.module_code)
  );

  return moduleCodes.every(code => passedCodes.has(code));
}

/**
 * 更新新人阶段和双线状态
 */
async function updateTraineeStage(
  traineeId: string,
  stage: string,
  processStatus: string,
  resultStatus: string
): Promise<void> {
  const client = getSupabaseClient();

  // 更新trainee_profiles
  await client
    .from('trainee_profiles')
    .update({
      stage,
      process_status: processStatus,
      result_status: resultStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', traineeId);

  // 同步更新users.stage（向后兼容）
  const stageMap: Record<string, number> = { foundation: 1, practice: 2, qualified: 3 };
  await client
    .from('users')
    .update({ stage: stageMap[stage] || 1, updated_at: new Date().toISOString() })
    .eq('id', traineeId);
}

/**
 * 模块通关通过联动
 * 通过模块 → 检查同阶段所有模块是否通过 → 触发阶段转换 + 双线状态更新
 */
export async function onModulePassed(
  traineeId: string,
  traineeName: string,
  moduleCode: string,
  stage: string
): Promise<void> {
  // 1. 检查同阶段所有模块是否全部通过
  const allModulesPassed = await checkAllModulesPassed(traineeId, stage);

  if (allModulesPassed) {
    if (stage === 'foundation') {
      // 基础通关全部通过 → 进入实操阶段
      await updateTraineeStage(traineeId, 'practice', 'monitoring', 'insufficient_data');
      await onStageTransition(traineeId, traineeName, '基础通关', '实操通关');
    } else if (stage === 'practice') {
      // 实操通关全部通过 → 进入合格阶段
      await updateTraineeStage(traineeId, 'qualified', 'passed', 'passed');
      await onStageTransition(traineeId, traineeName, '实操通关', '独立达标');
    }
  }

  // 通知带教老师该模块已通过
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'module_passed',
      title: `${traineeName}模块通关通过`,
      message: `${traineeName}已完成模块「${moduleCode}」通关考核`,
      relatedUserId: traineeId,
      priority: 'low',
    });
  }
}

/**
 * 模块通关未通过联动
 * 未通过 → 推送复习通知；连续3次未通过 → 通知带教老师+培训负责人
 */
export async function onModuleFailed(
  traineeId: string,
  traineeName: string,
  moduleCode: string,
  moduleName: string,
  failCount: number,
  wrongQuestionIds: number[]
): Promise<void> {
  // 1. 推送复习通知给新人
  const client = getSupabaseClient();

  // 查找错题关联的知识库文章
  let knowledgeHint = '';
  if (wrongQuestionIds.length > 0) {
    const { data: knowledgeItems } = await client
      .from('knowledge_base')
      .select('title')
      .limit(3);
    if (knowledgeItems && knowledgeItems.length > 0) {
      knowledgeHint = `，建议复习：${knowledgeItems.map((k: { title: string }) => k.title).join('、')}`;
    }
  }

  await sendNotification({
    userId: traineeId,
    type: 'module_failed',
    title: `${moduleName}未通过`,
    message: `本次考核未达到通过分数线，建议复习相关知识点后重新挑战${knowledgeHint}`,
    priority: 'medium',
  });

  // 2. 连续3次未通过 → 通知带教老师+培训负责人
  if (failCount >= 3 && failCount % 3 === 0) {
    const mentorId = await getMentorId(traineeId);
    const managerIds = await getTrainingManagerIds();

    const title = `${traineeName}模块多次未通过`;
    const message = `${traineeName}在「${moduleName}」模块已失败${failCount}次，需要辅导支持`;

    if (mentorId) {
      await sendNotification({
        userId: mentorId,
        type: 'module_failed',
        title,
        message,
        relatedUserId: traineeId,
        priority: 'high',
      });
    }

    for (const mgrId of managerIds) {
      await sendNotification({
        userId: mgrId,
        type: 'module_failed',
        title,
        message,
        relatedUserId: traineeId,
        priority: 'medium',
      });
    }
  }
}

/**
 * 质检完成后更新过程线状态
 * 任一维度连续低分 → process_status = flagged
 */
export async function onQcCompletedUpdateProcessStatus(
  traineeId: string,
  qcScores: {
    communication: number;
    professional: number;
    service: number;
    compliance: number;
  }
): Promise<void> {
  const client = getSupabaseClient();

  // 1. 获取当前process_status
  const { data: profile } = await client
    .from('trainee_profiles')
    .select('process_status, stage')
    .eq('user_id', traineeId)
    .single();

  if (!profile || profile.stage !== 'practice') return; // 只在实操阶段生效

  const currentStatus = profile.process_status;

  // 2. 检查4维度是否任一低于合格线（70分）
  const PASS_LINE = 70;
  const lowDimensions: string[] = [];
  const dimLabels: Record<string, string> = {
    communication: '沟通能力',
    professional: '专业能力',
    service: '服务态度',
    compliance: '合规执行',
  };

  for (const [dim, score] of Object.entries(qcScores)) {
    if (score < PASS_LINE) {
      lowDimensions.push(dimLabels[dim] || dim);
    }
  }

  // 3. 状态转换逻辑
  if (lowDimensions.length > 0 && currentStatus === 'monitoring') {
    // monitoring → flagged：有维度低于合格线
    await client
      .from('trainee_profiles')
      .update({
        process_status: 'flagged',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', traineeId);

    // 通知带教老师
    const mentorId = await getMentorId(traineeId);
    if (mentorId) {
      await sendNotification({
        userId: mentorId,
        type: 'process_flagged',
        title: '过程线异常预警',
        message: `学员过程线被标记为flagged，低分维度：${lowDimensions.join('、')}，请及时安排赋能`,
        relatedUserId: traineeId,
        priority: 'high',
      });
    }
  } else if (lowDimensions.length === 0 && currentStatus === 'flagged') {
    // flagged → monitoring：所有维度都达标，恢复监控
    await client
      .from('trainee_profiles')
      .update({
        process_status: 'monitoring',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', traineeId);

    const mentorId = await getMentorId(traineeId);
    if (mentorId) {
      await sendNotification({
        userId: mentorId,
        type: 'process_recovered',
        title: '过程线恢复正常',
        message: '学员所有质检维度已达标，过程线从flagged恢复为monitoring',
        relatedUserId: traineeId,
        priority: 'low',
      });
    }
  }
}
