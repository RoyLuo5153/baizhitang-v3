/**
 * 出师判定引擎 (V3.1 简化版)
 *
 * 3个条件全部满足即可出师：
 * 1. users.stage = 3（独立服务阶段）
 * 2. 最近N次质检全部通过（N可配置，默认3）
 * 3. 管理员手动点击"确认出师"
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendNotification } from './triggers';

export interface GraduationCheckResult {
  eligible: boolean;
  stage: number;
  stageOk: boolean;
  recentQcTotal: number;
  recentQcPassed: number;
  qcOk: boolean;
  missingConditions: string[];
  details: {
    currentStage: number;
    recentQcResults: { id: number; scoreBusiness: number; scoreService: number; passed: boolean }[];
  };
}

const DEFAULT_QC_COUNT = 3;
const QC_PASS_THRESHOLD = 60;

/**
 * 检查用户是否满足出师条件
 */
export async function checkGraduation(userId: string): Promise<GraduationCheckResult> {
  const supabase = getSupabaseClient();
  const missingConditions: string[] = [];

  // 1. 检查 stage
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, real_name, stage, graduation_date')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return {
      eligible: false,
      stage: 0,
      stageOk: false,
      recentQcTotal: 0,
      recentQcPassed: 0,
      qcOk: false,
      missingConditions: ['用户不存在'],
      details: { currentStage: 0, recentQcResults: [] },
    };
  }

  const stageOk = user.stage >= 4;
  if (!stageOk) {
    missingConditions.push(`当前阶段为${user.stage}，需达到阶段4（面诊当天完成）`);
  }

  // 2. 检查最近N次质检
  const { data: qcRecords, error: qcError } = await supabase
    .from('qc_records')
    .select('id, score_business, score_service')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(DEFAULT_QC_COUNT);

  if (qcError) {
    console.error('[graduation-engine] qc query error:', qcError);
    return {
      eligible: false,
      stage: user.stage,
      stageOk,
      recentQcTotal: 0,
      recentQcPassed: 0,
      qcOk: false,
      missingConditions: [...missingConditions, '查询质检记录失败'],
      details: { currentStage: user.stage, recentQcResults: [] },
    };
  }

  const recentQcResults = (qcRecords || []).map(r => ({
    id: r.id,
    scoreBusiness: r.score_business,
    scoreService: r.score_service,
    passed: (r.score_business ?? 0) >= QC_PASS_THRESHOLD && (r.score_service ?? 0) >= QC_PASS_THRESHOLD,
  }));

  const recentQcTotal = recentQcResults.length;
  const recentQcPassed = recentQcResults.filter(r => r.passed).length;
  const qcOk = recentQcTotal >= DEFAULT_QC_COUNT && recentQcPassed >= DEFAULT_QC_COUNT;

  if (!qcOk) {
    if (recentQcTotal < DEFAULT_QC_COUNT) {
      missingConditions.push(`最近质检记录不足（${recentQcTotal}/${DEFAULT_QC_COUNT}），还需${DEFAULT_QC_COUNT - recentQcTotal}次质检通过`);
    } else {
      const failedCount = recentQcTotal - recentQcPassed;
      missingConditions.push(`最近${DEFAULT_QC_COUNT}次质检未全部通过（${recentQcPassed}/${DEFAULT_QC_COUNT}），${failedCount}次未达标`);
    }
  }

  // 3. 检查是否已出师
  if (user.graduation_date) {
    missingConditions.push('该用户已出师');
  }

  const eligible = stageOk && qcOk && !user.graduation_date;

  return {
    eligible,
    stage: user.stage,
    stageOk,
    recentQcTotal,
    recentQcPassed,
    qcOk,
    missingConditions: eligible ? [] : missingConditions,
    details: { currentStage: user.stage, recentQcResults },
  };
}

/**
 * 执行出师操作
 */
export async function executeGraduation(
  userId: string,
  confirmedBy: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();

  // 先检查条件
  const checkResult = await checkGraduation(userId);
  if (!checkResult.eligible) {
    return { success: false, message: `不满足出师条件: ${checkResult.missingConditions.join('; ')}` };
  }

  const now = new Date().toISOString();

  // 1. UPDATE users
  const { error: updateError } = await supabase
    .from('users')
    .update({
      graduation_date: now,
      graduation_confirmed_by: confirmedBy,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[graduation-engine] update user error:', updateError);
    return { success: false, message: '更新用户出师状态失败' };
  }

  // 2. INSERT stage_transitions
  const { error: transitionError } = await supabase
    .from('stage_transitions')
    .insert({
      user_id: userId,
      from_stage: 4,
      to_stage: 5,
      triggered_by: confirmedBy,
      reason: '管理员确认出师',
      created_at: now,
    });

  if (transitionError) {
    console.error('[graduation-engine] insert transition error:', transitionError);
    // 不回滚，出师状态已更新
  }

  // 3. 获取用户姓名用于通知
  const { data: user } = await supabase
    .from('users')
    .select('real_name')
    .eq('id', userId)
    .single();

  const userName = user?.real_name || userId;

  // 4. 通知培训负责人和老板
  try {
    // 获取培训负责人和老板列表
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .in('role_id', [4, 5])
      .eq('is_active', true);

    if (managers) {
      for (const manager of managers) {
        await sendNotification({
          userId: manager.id,
          type: 'graduation',
          title: '新人出师通知',
          message: `新人「${userName}」已通过出师判定，正式出师`,
          priority: 'high',
          relatedUserId: userId,
        });
      }
    }
  } catch (e) {
    console.error('[graduation-engine] notification error:', e);
  }

  return { success: true, message: `新人「${userName}」已成功出师` };
}
