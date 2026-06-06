import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/empower/auto-trigger
 * 结果线自动触发赋能：业务指标低于阈值→自动匹配方案→创建执行记录
 * 可按需调用（定时任务/手动触发）
 */
export async function POST(request: Request) {
  try {
    const client = getSupabaseClient();
    const body = await request.json().catch(() => ({}));
    const { userIds, dryRun = false } = body;

    // 1. 获取结果线阈值
    const { data: thresholds } = await client
      .from('thresholds')
      .select('indicator_key, indicator_name, qualified_value, good_value, excellent_value, direction, category')
      .eq('category', 'result');

    if (!thresholds || thresholds.length === 0) {
      return NextResponse.json({ triggered: [], message: '无阈值配置' });
    }

    // 2. 获取在培新人
    let traineeResult: any;
    if (userIds && Array.isArray(userIds)) {
      traineeResult = await client
        .from('users')
        .select('id, real_name, username, stage')
        .eq('role_id', 1)
        .eq('is_active', true)
        .in('id', userIds);
    } else {
      traineeResult = await client
        .from('users')
        .select('id, real_name, username, stage')
        .eq('role_id', 1)
        .eq('is_active', true);
    }
    const trainees = traineeResult.data;

    if (!trainees || trainees.length === 0) {
      return NextResponse.json({ triggered: [], message: '无在培新人' });
    }

    // 3. 获取最新业务数据
    const { data: bizData } = await client
      .from('business_data')
      .select('*')
      .in('user_id', trainees.map((t: any) => t.id))
      .order('period_start', { ascending: false });

    // 4. 获取赋能方案（按indicator_key索引）
    const { data: empowerPlans } = await client
      .from('empower_plans')
      .select('*')
      .eq('is_active', true);

    const planMap: Record<string, any[]> = {};
    for (const p of empowerPlans || []) {
      if (!planMap[p.indicator_key]) planMap[p.indicator_key] = [];
      planMap[p.indicator_key].push(p);
    }

    // 5. 获取已有执行记录（避免重复触发）
    const { data: existingExecs } = await client
      .from('empower_executions')
      .select('user_id, plan_id, status')
      .in('user_id', trainees.map((t: any) => t.id))
      .in('status', ['pending', 'in_progress']);

    const existingSet = new Set(
      (existingExecs || []).map((e: any) => `${e.user_id}-${e.plan_id}`)
    );

    // 6. 逐人逐指标检查
    const triggered: any[] = [];
    const bizMap: Record<string, any> = {};
    for (const b of bizData || []) {
      if (!bizMap[b.user_id]) bizMap[b.user_id] = [];
      bizMap[b.user_id].push(b);
    }

    for (const trainee of trainees) {
      const userBiz = bizMap[trainee.id];
      if (!userBiz || userBiz.length === 0) continue;
      const latest = userBiz[0]; // 最新一期

      for (const threshold of thresholds) {
        const rawValue = latest[threshold.indicator_key];
        if (rawValue === null || rawValue === undefined) continue;
        const value = parseFloat(String(rawValue));
        const qualifiedVal = Number(threshold.qualified_value);

        // 不达标
        if (value < qualifiedVal) {
          const matchedPlans = planMap[threshold.indicator_key] || [];
          for (const plan of matchedPlans) {
            const key = `${trainee.id}-${plan.id}`;
            if (existingSet.has(key)) continue; // 已有未完成执行

            triggered.push({
              userId: trainee.id,
              userName: trainee.real_name,
              indicatorKey: threshold.indicator_key,
              indicatorName: threshold.indicator_name,
              value,
              threshold: qualifiedVal,
              planId: plan.id,
              planName: plan.name,
              prescriptionContent: plan.content,
            });

            if (!dryRun) {
              // 创建执行记录
              await client.from('empower_executions').insert({
                user_id: trainee.id,
                plan_id: plan.id,
                triggered_by: 'result',
                trigger_value: value,
                status: 'pending',
                progress: 0,
                before_quadrant: null,
                prescription_content: plan.content,
                assigned_by: null,
              });

              // 创建通知
              await client.from('notifications').insert({
                user_id: trainee.id,
                type: 'empower_triggered',
                title: '赋能方案已推送',
                message: `您在${threshold.indicator_name}指标未达标(${value}%，合格线${qualifiedVal}%)，系统已为您推送"${plan.name}"赋能方案`,
                is_read: false,
              });

              existingSet.add(key);
            }
          }
        }
      }
    }

    return NextResponse.json({
      triggered,
      count: triggered.length,
      dryRun,
      message: dryRun
        ? `检测到${triggered.length}条需要触发的赋能方案（试运行模式，未实际创建）`
        : `已触发${triggered.length}条赋能方案`,
    });
  } catch (error: any) {
    console.error('[auto-trigger] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
