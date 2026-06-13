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
  | 'learning_plan_generated' // 学习计划生成
  | 'learning_plan_overdue'   // 学习任务逾期
  | 'process_recovered'  // 过程线恢复
  | 'qualification_overdue'  // 资格期超期
  | 'empower_assigned'      // 赋能方案已分配
  | 'empower_due_soon'      // 赋能方案即将到期
  | 'trainee_registered'    // 新人注册完成
  | 'mentor_signoff_done'   // 带教签收完成
  | 'mentor_assigned'       // 带教老师被分配新人
  | 'alert_triggered'       // 预警触发
  | 'graduation'           // 出师通知
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
 * 获取总经理(boss)ID列表
 */
async function getBossIds(): Promise<string[]> {
  const client = getSupabaseClient();
  const { data } = await client
    .from('users')
    .select('id')
    .eq('role_id', 5)
    .eq('is_active', true);
  return (data || []).map((u: { id: string }) => u.id);
}

/**
 * 资格期超期通知
 * 超期当天 → 通知培训负责人
 * 超期15天以上 → 通知总经理
 */
export async function onQualificationOverdue(
  traineeId: string,
  traineeName: string,
  overdueDays: number
): Promise<void> {
  // 通知培训负责人
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'qualification_overdue',
      title: `${traineeName}资格期已超期`,
      message: `${traineeName}已超期${overdueDays}天，请及时处理（转出或延期）`,
      relatedUserId: traineeId,
      priority: overdueDays >= 15 ? 'high' : 'medium',
    });
  }

  // 超期15天以上 → 通知总经理
  if (overdueDays >= 15) {
    const bossIds = await getBossIds();
    for (const bossId of bossIds) {
      await sendNotification({
        userId: bossId,
        type: 'qualification_overdue',
        title: `${traineeName}资格期严重超期`,
        message: `${traineeName}已超期${overdueDays}天，需要关注处理`,
        relatedUserId: traineeId,
        priority: 'high',
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
  // 阶段转换已由 stage-engine.ts 自动处理，此处不再硬编码
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
    foundation: '首通电话', practice: '三天回访', independent: '五天预约', proficient: '面诊当天',
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
  const stageMap: Record<string, number> = { foundation: 1, practice: 2, independent: 3, proficient: 4 };
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
      // 首通电话全部通过 → 进入三天回访阶段
      await updateTraineeStage(traineeId, 'practice', 'monitoring', 'insufficient_data');

      // 记录阶段转换
      const client = getSupabaseClient();
      await client.from('stage_transitions').insert({
        user_id: traineeId,
        from_stage: 'foundation',
        to_stage: 'practice',
        reason: '基础通关4个模块全部通过',
        triggered_by: 'module_pass',
      });

      // 通知新人阶段升级
      await sendNotification({
        userId: traineeId,
        type: 'stage_transition',
        title: '恭喜进入实操阶段',
        message: '基础通关全部通过，已进入实操通关阶段，请继续完成实操模块考核。',
        priority: 'high',
      });

      // 通知培训负责人
      const managerIds = await getTrainingManagerIds();
      for (const mgrId of managerIds) {
        await sendNotification({
          userId: mgrId,
          type: 'stage_transition',
          title: `${traineeName}进入实操阶段`,
          message: `${traineeName}已完成基础通关全部模块，进入实操阶段。`,
          relatedUserId: traineeId,
          priority: 'medium',
        });
      }
    } else if (stage === 'practice') {
      // 实操通关全部通过 → 进入五天预约阶段
      await updateTraineeStage(traineeId, 'independent', 'passed', 'passed');

      const client = getSupabaseClient();
      await client.from('stage_transitions').insert({
        user_id: traineeId,
        from_stage: 'practice',
        to_stage: 'independent',
        reason: '实操通关4个模块全部通过',
        triggered_by: 'module_pass',
      });

      // 通知新人
      await sendNotification({
        userId: traineeId,
        type: 'stage_transition',
        title: '恭喜进入五天预约阶段',
        message: '实操通关全部通过，已进入五天预约阶段！',
        priority: 'high',
      });

      // 通知培训负责人
      const managerIds = await getTrainingManagerIds();
      for (const mgrId of managerIds) {
        await sendNotification({
          userId: mgrId,
          type: 'stage_transition',
          title: `${traineeName}进入五天预约阶段`,
          message: `${traineeName}已完成实操通关全部模块，进入五天预约阶段。`,
          relatedUserId: traineeId,
          priority: 'medium',
        });
      }
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

/**
 * 赋能方案推送联动
 * 推送赋能方案给新人 → 通知新人 + 通知培训负责人
 */
export async function onEmpowerAssigned(
  traineeId: string,
  traineeName: string,
  planName: string,
  planId: number,
  assignedBy: string
): Promise<void> {
  // 1. 通知新人
  await sendNotification({
    userId: traineeId,
    type: 'empower_assigned',
    title: '新的赋能任务',
    message: `您被分配了赋能方案「${planName}」，请及时完成`,
    relatedUserId: assignedBy,
    relatedId: planId,
    priority: 'medium',
  });

  // 2. 通知培训负责人
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'empower_assigned',
      title: '新人赋能方案已推送',
      message: `学员${traineeName}被分配了赋能方案「${planName}」`,
      relatedUserId: traineeId,
      relatedId: planId,
      priority: 'low',
    });
  }

  // 3. 通知带教老师
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'empower_assigned',
      title: `学员${traineeName}被分配赋能方案`,
      message: `学员${traineeName}被分配了赋能方案「${planName}」，请关注执行进度`,
      relatedUserId: traineeId,
      relatedId: planId,
      priority: 'medium',
    });
  }
}

/**
 * 赋能方案即将到期联动
 * 距截止日3天 → 通知新人 + 带教老师
 */
export async function onEmpowerDueSoon(
  traineeId: string,
  traineeName: string,
  planName: string,
  planId: number,
  daysRemaining: number
): Promise<void> {
  // 通知新人
  await sendNotification({
    userId: traineeId,
    type: 'empower_due_soon',
    title: '赋能方案即将到期',
    message: `您的赋能方案「${planName}」将在${daysRemaining}天后到期，请尽快完成`,
    relatedId: planId,
    priority: 'high',
  });

  // 通知带教老师
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'empower_due_soon',
      title: `学员${traineeName}赋能方案即将到期`,
      message: `学员${traineeName}的赋能方案「${planName}」将在${daysRemaining}天后到期`,
      relatedUserId: traineeId,
      relatedId: planId,
      priority: 'medium',
    });
  }
}

/**
 * 新人注册完成联动
 * 创建账号后 → 通知带教老师
 */
export async function onTraineeRegistered(
  traineeId: string,
  traineeName: string,
  mentorId?: string
): Promise<void> {
  // 通知带教老师
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'trainee_registered',
      title: '您的学员已注册',
      message: `您的学员${traineeName}已完成注册，请关注其学习进度`,
      relatedUserId: traineeId,
      priority: 'medium',
    });
  }

  // 通知培训负责人
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'trainee_registered',
      title: '新人注册完成',
      message: `新人${traineeName}已注册，带教老师：${mentorId ? '已分配' : '未分配'}`,
      relatedUserId: traineeId,
      priority: 'low',
    });
  }
}

/**
 * 带教签收完成联动
 * 所有关键动作签收完成 → 通知培训负责人
 */
export async function onMentorSignoffComplete(
  traineeId: string,
  traineeName: string
): Promise<void> {
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'mentor_signoff_done',
      title: `${traineeName}已完成所有核心动作签收`,
      message: `学员${traineeName}已完成所有核心动作的带教签收，请关注后续进展`,
      relatedUserId: traineeId,
      priority: 'medium',
    });
  }

  // 也通知带教老师
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'mentor_signoff_done',
      title: `${traineeName}签收全部完成`,
      message: `学员${traineeName}的所有核心动作签收已完成`,
      relatedUserId: traineeId,
      priority: 'low',
    });
  }
}

/**
 * 预警触发联动
 * 指标低于预警线 → 通知带教老师 + 培训负责人
 */
export async function onAlertTriggered(
  traineeId: string,
  traineeName: string,
  alertType: string,
  alertDetail: string
): Promise<void> {
  const stageNames: Record<string, string> = {
    wechat_add_rate: '加V率',
    consultation_rate: '面诊率',
    reception_rate: '接诊率',
    delivery_rate: '签收率',
    medication_rate: '用药率',
    appointment_rate: '挂号率',
  };
  const label = stageNames[alertType] || alertType;

  // 通知带教老师
  const mentorId = await getMentorId(traineeId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'alert_triggered',
      title: `${traineeName}${label}低于预警线`,
      message: `${traineeName}的${label}${alertDetail}，请及时安排辅导`,
      relatedUserId: traineeId,
      priority: 'high',
    });
  }

  // 通知培训负责人
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'alert_triggered',
      title: `${traineeName}${label}低于预警线`,
      message: `学员${traineeName}的${label}${alertDetail}，带教老师：${mentorId ? '已通知' : '未分配'}`,
      relatedUserId: traineeId,
      priority: 'medium',
    });
  }
}

/**
 * 四象限变化触发赋能方案推送
 * 当用户落入C/D象限时，自动匹配赋能方案并创建执行记录 + 通知三方
 */
export async function onQuadrantChange(
  userId: string,
  oldQuadrant: string,
  newQuadrant: string,
  unqualifiedItems: string[] = []
): Promise<void> {
  // 仅 C/D 类触发
  if (!['C', 'D'].includes(newQuadrant)) return;

  const client = getSupabaseClient();

  // 1. 获取用户姓名
  const { data: user } = await client
    .from('users')
    .select('real_name, username')
    .eq('id', userId)
    .maybeSingle();
  const userName = user?.real_name || user?.username || '未知学员';

  // 2. 获取活跃赋能方案
  const { data: plans } = await client
    .from('empower_plans')
    .select('*')
    .eq('is_active', true);

  if (!plans || plans.length === 0) return;

  // 3. 根据不合格指标匹配方案
  const matchedPlans: { id: number; name: string; indicatorKey: string }[] = [];
  const matchedIds = new Set<number>();

  // C类=过程线不达标 → 匹配过程线相关指标
  // D类=全不达标 → 匹配所有不合格指标 + 综合
  for (const itemKey of unqualifiedItems) {
    // 精确匹配 indicator_key
    const exact = plans.find(p => p.indicator_key === itemKey);
    if (exact && !matchedIds.has(exact.id)) {
      matchedIds.add(exact.id);
      matchedPlans.push({ id: exact.id, name: exact.name, indicatorKey: exact.indicator_key });
    }

    // 匹配 target_indicators 包含该指标
    const byTarget = plans.filter(p =>
      Array.isArray(p.target_indicators) && p.target_indicators.includes(itemKey) && !matchedIds.has(p.id)
    );
    for (const p of byTarget) {
      matchedIds.add(p.id);
      matchedPlans.push({ id: p.id, name: p.name, indicatorKey: p.indicator_key });
    }
  }

  // D类额外匹配综合方案
  if (newQuadrant === 'D') {
    const general = plans.find(p => p.indicator_key === 'general' && !matchedIds.has(p.id));
    if (general) {
      matchedIds.add(general.id);
      matchedPlans.push({ id: general.id, name: general.name, indicatorKey: general.indicator_key });
    }
  }

  // 兜底：如果没匹配到，用通用方案
  if (matchedPlans.length === 0) {
    const general = plans.find(p => p.indicator_key === 'general');
    if (general) {
      matchedPlans.push({ id: general.id, name: general.name, indicatorKey: general.indicator_key });
    }
  }

  if (matchedPlans.length === 0) return;

  // 4. 获取已有执行中/已分配的赋能记录（去重）
  const { data: activeExecs } = await client
    .from('empower_executions')
    .select('plan_id')
    .eq('user_id', userId)
    .in('status', ['assigned', 'in_progress']);
  const activePlanIds = new Set((activeExecs || []).map((e: { plan_id: number }) => e.plan_id));

  // 5. 创建执行记录（仅不存在活跃记录的方案）
  const quadrantLabel = newQuadrant === 'C' ? '成长型' : '危险型';
  const createdPlans: string[] = [];

  for (const plan of matchedPlans) {
    if (activePlanIds.has(plan.id)) continue; // 已有活跃记录，跳过

    // 获取方案内容快照
    const { data: planData } = await client
      .from('empower_plans')
      .select('content')
      .eq('id', plan.id)
      .single();

    await client.from('empower_executions').insert({
      user_id: userId,
      plan_id: plan.id,
      triggered_by: `quadrant_${newQuadrant.toLowerCase()}`,
      status: 'assigned',
      progress: 0,
      started_at: new Date().toISOString(),
      before_quadrant: oldQuadrant,
      prescription_content: planData?.content || null,
      completed_steps: [],
    });

    createdPlans.push(plan.name);
    activePlanIds.add(plan.id);
  }

  if (createdPlans.length === 0) return; // 所有方案都已有活跃记录

  // 6. 发送通知
  const plansSummary = createdPlans.join('、');

  // 6a. 通知新人
  await sendNotification({
    userId,
    type: 'empower_auto',
    title: '您有新的赋能方案',
    message: `您被判定为${quadrantLabel}（${newQuadrant}类），系统已为您推送赋能方案：${plansSummary}，请及时完成`,
    priority: 'high',
  });

  // 6b. 通知带教老师
  const mentorId = await getMentorId(userId);
  if (mentorId) {
    await sendNotification({
      userId: mentorId,
      type: 'empower_auto',
      title: `您的新人${userName}有新赋能方案`,
      message: `${userName}被判定为${quadrantLabel}（${newQuadrant}类），已自动推送：${plansSummary}`,
      relatedUserId: userId,
      priority: 'high',
    });
  }

  // 6c. 通知培训负责人
  const managerIds = await getTrainingManagerIds();
  for (const mgrId of managerIds) {
    await sendNotification({
      userId: mgrId,
      type: 'empower_auto',
      title: `新人${userName}已自动推送赋能方案`,
      message: `${userName}被判定为${quadrantLabel}（${newQuadrant}类，原${oldQuadrant}类），已自动推送：${plansSummary}`,
      relatedUserId: userId,
      priority: 'medium',
    });
  }
}

/**
 * 检查即将到期的赋能方案（距截止日3天）
 * 供定时任务或手动调用
 */
export async function checkEmpowerDueSoon(): Promise<{ notifiedCount: number }> {
  const client = getSupabaseClient();

  // 查询3天内到期的赋能执行记录
  const { data: dueSoonExecutions } = await client
    .from('empower_executions')
    .select('id, user_id, plan_id, due_date, status, empower_plans(title)')
    .in('status', ['assigned', 'in_progress'])
    .gte('due_date', new Date().toISOString().split('T')[0])
    .lte('due_date', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  if (!dueSoonExecutions || dueSoonExecutions.length === 0) {
    return { notifiedCount: 0 };
  }

  let notifiedCount = 0;
  for (const exec of dueSoonExecutions) {
    // 检查今天是否已发过通知
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await client
      .from('notifications')
      .select('id')
      .eq('related_id', String(exec.id))
      .eq('type', 'empower_due_soon')
      .gte('created_at', today)
      .maybeSingle();

    if (existing) continue;

    // 获取新人姓名
    const { data: user } = await client
      .from('users')
      .select('real_name')
      .eq('id', exec.user_id)
      .maybeSingle();

    const planName = (exec.empower_plans as any)?.title || '未命名方案';
    const dueDate = new Date(exec.due_date);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await onEmpowerDueSoon(
      exec.user_id,
      user?.real_name || '未知学员',
      planName,
      exec.plan_id,
      daysRemaining
    );
    notifiedCount++;
  }

  return { notifiedCount };
}

// ─── 学习计划超时检查 ───────────────────────────

/**
 * 检查学习计划超时
 * 每日定时调用：查询所有 pending 状态且 deadline < NOW() 的计划
 * 更新 status='overdue' + 发送通知
 */
export async function checkLearningPlanOverdue(): Promise<{ updatedCount: number }> {
  const client = getSupabaseClient();

  // 查询所有超时未完成的计划
  const { data: overduePlans } = await client
    .from('learning_plans')
    .select('id, user_id, day_number, title, deadline')
    .eq('status', 'pending')
    .lt('deadline', new Date().toISOString());

  if (!overduePlans || overduePlans.length === 0) {
    return { updatedCount: 0 };
  }

  let updatedCount = 0;
  for (const plan of overduePlans) {
    // 更新状态为 overdue
    await client
      .from('learning_plans')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .eq('id', plan.id);

    // 获取用户信息
    const { data: user } = await client
      .from('users')
      .select('real_name')
      .eq('id', plan.user_id)
      .maybeSingle();

    const userName = user?.real_name || '未知学员';

    // 通知新人
    await sendNotification({
      userId: plan.user_id,
      type: 'empower_auto',
      title: `学习任务超时: ${plan.title}`,
      message: `您的D${plan.day_number}学习任务"${plan.title}"已超时，请尽快完成。`,
      relatedId: plan.id,
      priority: 'high',
    });

    // 通知带教老师
    const { data: mentor } = await client
      .from('mentor_trainees')
      .select('mentor_id')
      .eq('trainee_id', plan.user_id)
      .maybeSingle();

    if (mentor) {
      await sendNotification({
        userId: mentor.mentor_id,
        type: 'empower_auto',
        title: `新人学习任务超时: ${userName}`,
        message: `新人${userName}的D${plan.day_number}任务"${plan.title}"已超时，请关注。`,
        relatedUserId: plan.user_id,
        relatedId: plan.id,
        priority: 'high',
      });
    }

    // 通知培训负责人
    const { data: managers } = await client
      .from('users')
      .select('id')
      .eq('role_id', 4)
      .eq('is_active', true);

    for (const mgr of managers || []) {
      await sendNotification({
        userId: mgr.id,
        type: 'empower_auto',
        title: `新人学习任务超时: ${userName}`,
        message: `新人${userName}的D${plan.day_number}任务"${plan.title}"已超时。`,
        relatedUserId: plan.user_id,
        relatedId: plan.id,
        priority: 'medium',
      });
    }

    updatedCount++;
  }

  return { updatedCount };
}
