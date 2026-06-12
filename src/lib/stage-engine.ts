/**
 * 阶段转换引擎
 * 核心逻辑：检查用户是否满足 stage_rules 中定义的阶段转换条件，自动推进阶段
 *
 * 支持的规则类型:
 * - level_completion: 当前阶段所有闯关通过
 * - level_and_business: 闯关全通过 + 业务指标达标
 * - graduation: 闯关全通过 + 更高业务指标达标
 * - promotion: 通用晋升（consecutive_a / consecutive_pass）
 * - demotion: 降级（consecutive_d）
 * - warning: 预警（不触发阶段转换）
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { pgQuery } from '@/storage/database/pg-client';
import { sendNotification } from '@/lib/triggers';

// ─── 类型定义 ───────────────────────────────────

export interface StageTransitionResult {
  transitioned: boolean;
  fromStage: number;
  toStage: number;
  reason: string;
  ruleId?: number;
  skipped?: string[]; // 未满足的条件
}

interface StageRule {
  id: number;
  from_stage: number;
  to_stage: number;
  rule_type: string;
  rule_config: Record<string, unknown>;
  description: string;
  is_active: boolean;
}

interface BusinessThreshold {
  consultationRate?: number;  // 面诊率
  wechatAddRate?: number;     // 加V率
  receptionRate?: number;     // 接诊率
  deliveryRate?: number;      // 签收率
  medicationRate?: number;    // 用药率
  appointmentRate?: number;   // 挂号率
}

// ─── 核心函数 ───────────────────────────────────

/**
 * 检查并执行阶段转换
 * 幂等：已转换过的阶段不会重复转换
 */
export async function checkAndTransitionStage(
  userId: string,
  triggeredBy?: string
): Promise<StageTransitionResult> {
  const client = getSupabaseClient();

  // 1. 查询用户当前阶段
  const { data: user, error: userError } = await client
    .from('users')
    .select('id, stage, real_name, role_id')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    return {
      transitioned: false,
      fromStage: 0,
      toStage: 0,
      reason: `用户不存在: ${userId}`,
    };
  }

  // 只对trainee(role_id=1)执行阶段转换
  if (user.role_id !== 1) {
    return {
      transitioned: false,
      fromStage: user.stage,
      toStage: user.stage,
      reason: '非学员角色，不执行阶段转换',
    };
  }

  const currentStage = user.stage || 1;

  // 2. 查询适用的晋升规则 (from_stage = currentStage, rule_type IN promotion types)
  const { data: rules, error: rulesError } = await client
    .from('stage_rules')
    .select('*')
    .eq('from_stage', currentStage)
    .eq('is_active', true)
    .in('rule_type', ['level_completion', 'level_and_business', 'graduation', 'promotion']);

  if (rulesError || !rules || rules.length === 0) {
    return {
      transitioned: false,
      fromStage: currentStage,
      toStage: currentStage,
      reason: `无适用的晋升规则 (stage=${currentStage})`,
    };
  }

  // 3. 逐一校验规则，找到第一个满足的
  const skipped: string[] = [];

  for (const rule of rules as StageRule[]) {
    const checkResult = await checkRule(userId, currentStage, rule);

    if (checkResult.satisfied) {
      // 4. 执行阶段转换
      const nextStage = rule.to_stage;

      // 幂等检查：是否已有相同的转换记录（防止重复）
      const alreadyTransitioned = await hasTransitionRecord(userId, currentStage, nextStage);
      if (alreadyTransitioned) {
        return {
          transitioned: false,
          fromStage: currentStage,
          toStage: nextStage,
          reason: '已存在相同转换记录，跳过',
          ruleId: rule.id,
          skipped,
        };
      }

      // 更新 users.stage
      await client
        .from('users')
        .update({
          stage: nextStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      // INSERT stage_transitions 记录
      await client.from('stage_transitions').insert({
        user_id: userId,
        from_stage: currentStage,
        to_stage: nextStage,
        rule_id: rule.id,
        triggered_by: triggeredBy || null,
      });

      // 5. 通知相关人
      await notifyStageTransition(userId, user.real_name || userId, currentStage, nextStage);

      return {
        transitioned: true,
        fromStage: currentStage,
        toStage: nextStage,
        reason: checkResult.reason,
        ruleId: rule.id,
        skipped,
      };
    } else {
      skipped.push(`${rule.description}: ${checkResult.reason}`);
    }
  }

  // 所有规则都不满足
  return {
    transitioned: false,
    fromStage: currentStage,
    toStage: currentStage,
    reason: '未满足任何晋升条件',
    skipped,
  };
}

// ─── 规则校验 ───────────────────────────────────

async function checkRule(
  userId: string,
  currentStage: number,
  rule: StageRule
): Promise<{ satisfied: boolean; reason: string }> {
  const config = rule.rule_config;

  switch (rule.rule_type) {
    case 'level_completion': {
      const lcResult = await checkLevelCompletion(userId, currentStage, config);
      // Stage 1→2 额外要求: D7综合考核完成
      if (lcResult.satisfied && currentStage === 1) {
        const d7Result = await checkD7Completion(userId);
        if (!d7Result.satisfied) return d7Result;
      }
      return lcResult;
    }

    case 'level_and_business':
      return checkLevelAndBusiness(userId, currentStage, config);

    case 'graduation':
      return checkLevelAndBusiness(userId, currentStage, config);

    case 'promotion': {
      const promoType = config.type as string;
      if (promoType === 'consecutive_a' || promoType === 'consecutive_pass') {
        // 连续N周A类/通过 — 暂时跳过（需要周数据，后续L工单实现）
        return { satisfied: false, reason: `连续周规则(${promoType})暂未实现` };
      }
      if (promoType === 'levels_pass') {
        return checkLevelCompletion(userId, currentStage, config);
      }
      return { satisfied: false, reason: `未知晋升类型: ${promoType}` };
    }

    default:
      return { satisfied: false, reason: `未知规则类型: ${rule.rule_type}` };
  }
}

/**
 * 检查当前阶段所有闯关是否全部通过
 */
async function checkLevelCompletion(
  userId: string,
  currentStage: number,
  config: Record<string, unknown>
): Promise<{ satisfied: boolean; reason: string }> {
  if (!config.allLevelsPassed) {
    return { satisfied: false, reason: '规则未要求闯关全通过' };
  }

  // 查询当前阶段的关卡数
  const levelsResult = await pgQuery(
    'SELECT level_id FROM learning_levels WHERE stage = $1 ORDER BY level_id',
    [currentStage]
  );

  const levelIds = levelsResult.map((r: Record<string, unknown>) => r.level_id as number);

  if (levelIds.length === 0) {
    return { satisfied: false, reason: `阶段${currentStage}无关卡定义` };
  }

  // 查询用户已通过的关卡
  const passedResult = await pgQuery(
    `SELECT level_id FROM level_progress 
     WHERE user_id = $1 AND level_id = ANY($2) AND status = 'passed'`,
    [userId, levelIds]
  );

  const passedLevelIds = new Set(
    passedResult.map((r: Record<string, unknown>) => r.level_id as number)
  );

  const passedCount = levelIds.filter((id: number) => passedLevelIds.has(id)).length;
  const totalRequired = levelIds.length;

  if (passedCount >= totalRequired) {
    return { satisfied: true, reason: `当前阶段${totalRequired}关全部通过` };
  }

  return {
    satisfied: false,
    reason: `闯关进度${passedCount}/${totalRequired}，未全部通过`,
  };
}

/**
 * 检查闯关全通过 + 业务指标达标
 */
async function checkLevelAndBusiness(
  userId: string,
  currentStage: number,
  config: Record<string, unknown>
): Promise<{ satisfied: boolean; reason: string }> {
  // 先检查闯关
  const levelCheck = await checkLevelCompletion(userId, currentStage, config);
  if (!levelCheck.satisfied) {
    return levelCheck;
  }

  // 再检查业务指标
  const threshold = config.businessThreshold as BusinessThreshold | undefined;
  if (!threshold || Object.keys(threshold).length === 0) {
    return { satisfied: true, reason: '无业务指标要求' };
  }

  return checkBusinessThreshold(userId, threshold);
}

/**
 * 检查业务指标是否达标
 * 从 business_data 表查询最近30天的平均值
 */
async function checkBusinessThreshold(
  userId: string,
  threshold: BusinessThreshold
): Promise<{ satisfied: boolean; reason: string }> {
  // 查询用户最近的业务数据
  const result = await pgQuery(
    `SELECT 
      COALESCE(AVG(consultation_rate), 0) as avg_consultation_rate,
      COALESCE(AVG(wechat_add_rate), 0) as avg_wechat_add_rate,
      COALESCE(AVG(reception_rate), 0) as avg_reception_rate,
      COALESCE(AVG(delivery_rate), 0) as avg_delivery_rate,
      COALESCE(AVG(medication_rate), 0) as avg_medication_rate,
      COALESCE(AVG(appointment_rate), 0) as avg_appointment_rate
    FROM business_data 
    WHERE user_id = $1 AND record_date >= NOW() - INTERVAL '30 days'`,
    [userId]
  );

  if (!result || result.length === 0) {
    return { satisfied: false, reason: '无业务数据' };
  }

  const data = result[0];
  const failedMetrics: string[] = [];

  const metricLabels: Record<string, string> = {
    consultationRate: '面诊率',
    wechatAddRate: '加V率',
    receptionRate: '接诊率',
    deliveryRate: '签收率',
    medicationRate: '用药率',
    appointmentRate: '挂号率',
  };

  const metricDbFields: Record<string, string> = {
    consultationRate: 'avg_consultation_rate',
    wechatAddRate: 'avg_wechat_add_rate',
    receptionRate: 'avg_reception_rate',
    deliveryRate: 'avg_delivery_rate',
    medicationRate: 'avg_medication_rate',
    appointmentRate: 'avg_appointment_rate',
  };

  for (const [key, requiredValue] of Object.entries(threshold)) {
    const dbField = metricDbFields[key];
    const actualValue = Number(data[dbField]) || 0;
    const label = metricLabels[key] || key;

    if (actualValue < Number(requiredValue)) {
      failedMetrics.push(`${label}: ${actualValue.toFixed(1)}% < ${requiredValue}%`);
    }
  }

  if (failedMetrics.length === 0) {
    return { satisfied: true, reason: '业务指标全部达标' };
  }

  return {
    satisfied: false,
    reason: `业务指标未达标: ${failedMetrics.join('; ')}`,
  };
}

// ─── 幂等检查 ───────────────────────────────────

async function hasTransitionRecord(
  userId: string,
  fromStage: number,
  toStage: number
): Promise<boolean> {
  const result = await pgQuery(
    `SELECT id FROM stage_transitions 
     WHERE user_id = $1 AND from_stage = $2 AND to_stage = $3 
     LIMIT 1`,
    [userId, fromStage, toStage]
  );
  return result.length > 0;
}

// ─── 通知 ───────────────────────────────────

const STAGE_NAMES: Record<number, string> = {
  1: '学习期',
  2: '练习期',
  3: '独立期',
  4: '熟练期',
};

async function notifyStageTransition(
  traineeId: string,
  traineeName: string,
  fromStage: number,
  toStage: number
): Promise<void> {
  const fromName = STAGE_NAMES[fromStage] || `阶段${fromStage}`;
  const toName = STAGE_NAMES[toStage] || `阶段${toStage}`;

  const title = `${traineeName}进入${toName}`;
  const message = `${traineeName}已完成${fromName}全部要求，正式进入${toName}`;

  // 通知新人本人
  await sendNotification({
    userId: traineeId,
    type: 'stage_transition',
    title,
    message,
    priority: 'high',
  });

  // 通知带教老师
  const client = getSupabaseClient();
  const { data: mentorRel } = await client
    .from('mentor_trainees')
    .select('mentor_id')
    .eq('trainee_id', traineeId)
    .maybeSingle();

  if (mentorRel?.mentor_id) {
    await sendNotification({
      userId: mentorRel.mentor_id,
      type: 'stage_transition',
      title,
      message,
      relatedUserId: traineeId,
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
      type: 'stage_transition',
      title,
      message,
      relatedUserId: traineeId,
      priority: 'medium',
    });
  }
}

/**
 * 检查D7综合考核是否完成
 * Stage 1→2 的必要条件
 */
async function checkD7Completion(
  userId: string
): Promise<{ satisfied: boolean; reason: string }> {
  const result = await pgQuery(
    `SELECT status FROM learning_plans 
     WHERE user_id = $1 AND day_number = 7 AND status = 'completed'
     LIMIT 1`,
    [userId]
  );

  if (result.length > 0) {
    return { satisfied: true, reason: 'D7综合考核已完成' };
  }
  return { satisfied: false, reason: 'D7综合考核未完成' };
}
