import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { onStageTransition } from '@/lib/triggers';

/**
 * POST /api/stage-promotion
 * 阶段进阶审批：校验进阶条件 → 审批通过/拒绝
 */
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();
    const { userId, fromStage, toStage, action, reason } = body as {
      userId: string;
      fromStage: number;
      toStage: number;
      action: 'approve' | 'reject' | 'check';
      reason?: string;
    };

    if (!userId || !fromStage || !toStage || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 获取进阶规则
    const { data: rules } = await client
      .from('stage_rules')
      .select('*')
      .eq('from_stage', fromStage)
      .eq('to_stage', toStage)
      .eq('rule_type', 'promotion')
      .eq('is_active', true);

    if (!rules || rules.length === 0) {
      return NextResponse.json({ error: '无对应的进阶规则' }, { status: 404 });
    }

    const rule = rules[0];
    const config = rule.rule_config as Record<string, string>;

    // 校验进阶条件
    const checkResult = await checkPromotionCondition(client, userId, fromStage, toStage, config);

    if (action === 'check') {
      return NextResponse.json({
        canPromote: checkResult.passed,
        rule: { label: config.label, type: config.type },
        details: checkResult.details,
      });
    }

    if (action === 'approve') {
      if (!checkResult.passed) {
        return NextResponse.json({
          error: '进阶条件未满足',
          details: checkResult.details,
          rule: config.label,
        }, { status: 400 });
      }

      // 更新用户阶段
      const { error: updateError } = await client
        .from('users')
        .update({ stage: toStage, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 创建通知
      await client.from('notifications').insert({
        user_id: userId,
        type: 'stage_promoted',
        title: '阶段进阶成功',
        message: `恭喜！您已从阶段${fromStage}晋升至阶段${toStage}`,
        is_read: false,
      });

      // 通知培训负责人
      try {
        const { data: userData } = await client.from('users').select('real_name').eq('id', userId).single();
        const realName = userData?.real_name || userId;
        await onStageTransition(String(userId), realName, String(fromStage), String(toStage));
      } catch {
        // 通知失败不影响主流程
      }

      return NextResponse.json({
        success: true,
        message: `${userId} 已从阶段${fromStage}晋升至阶段${toStage}`,
        details: checkResult.details,
      });
    }

    if (action === 'reject') {
      // 标记相关通知已读
      await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('type', 'stage_change_request')
        .eq('is_read', false);

      await client.from('notifications').insert({
        user_id: userId,
        type: 'stage_promotion_rejected',
        title: '阶段进阶未通过',
        message: reason || `您的阶段${fromStage}→${toStage}进阶申请未通过`,
        is_read: false,
      });

      return NextResponse.json({ success: true, message: '已拒绝进阶申请' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error: any) {
    console.error('[stage-promotion] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function checkPromotionCondition(
  client: any,
  userId: string,
  fromStage: number,
  toStage: number,
  config: Record<string, string>
): Promise<{ passed: boolean; details: Record<string, unknown> }> {
  const type = config.type;

  // 阶段1→2：闯关7关全通过
  if (type === 'levels_pass') {
    const requiredLevels = parseInt(config.levels || '7');
    const { data: progress } = await client
      .from('level_progress')
      .select('level_id, status')
      .eq('user_id', userId)
      .eq('status', 'passed');

    const passedLevels = (progress || []).length;
    return {
      passed: passedLevels >= requiredLevels,
      details: { passedLevels, requiredLevels, type: 'levels_pass' },
    };
  }

  // 阶段2→3：连续4周A类
  if (type === 'consecutive_a') {
    const requiredWeeks = parseInt(config.weeks || '4');
    // 获取最近N周的诊断结果
    const { data: diagnoses } = await client
      .from('diagnosis')
      .select('quadrant, period_start')
      .eq('user_id', userId)
      .order('period_start', { ascending: false })
      .limit(requiredWeeks);

    if (!diagnoses || diagnoses.length < requiredWeeks) {
      return {
        passed: false,
        details: { consecutiveAWeeks: diagnoses?.length || 0, requiredWeeks, type: 'consecutive_a', reason: '数据不足' },
      };
    }

    const allA = diagnoses.every((d: any) => d.quadrant === 'A');
    return {
      passed: allA,
      details: { consecutiveAWeeks: allA ? requiredWeeks : 0, requiredWeeks, type: 'consecutive_a', recentQuadrants: diagnoses.map((d: any) => d.quadrant) },
    };
  }

  return { passed: false, details: { type, reason: '未知规则类型' } };
}
