import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/empower/alerts - 获取待推送预警（不合格新人 + 匹配方案）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  try {
    // 1. 获取所有活跃赋能方案
    const { data: plans, error: plansError } = await client
      .from('empower_plans')
      .select('*')
      .eq('is_active', true);

    if (plansError) return NextResponse.json({ error: plansError.message }, { status: 500 });

    // 2. 获取所有在培新人 (仅trainee角色)
    const { data: trainees, error: traineesError } = await client
      .from('users')
      .select('id, real_name, username, role_id, stage')
      .eq('is_active', true)
      .eq('role_id', 1);

    if (traineesError) return NextResponse.json({ error: traineesError.message }, { status: 500 });

    // 3. 获取已有执行中的赋能记录（避免重复推送）
    const { data: activeExecutions } = await client
      .from('empower_executions')
      .select('plan_id, user_id')
      .in('status', ['assigned', 'in_progress']);

    const activeSet = new Set(
      (activeExecutions || []).map((e: { plan_id: string; user_id: string }) => `${e.plan_id}:${e.user_id}`)
    );

    // 4. 获取阈值
    const { data: thresholds } = await client
      .from('thresholds')
      .select('*');
    const thresholdMap: Record<string, any> = {};
    for (const t of thresholds || []) {
      thresholdMap[t.indicator_key] = t;
    }

    // 5. 对每个新人做诊断，提取不合格指标，匹配方案
    const alerts: {
      userId: string;
      userName: string;
      unqualifiedIndicators: { key: string; label: string; value: number; unit: string; threshold: number }[];
      recommendedPlans: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[];
    }[] = [];

    for (const u of trainees || []) {
      const userName = u.real_name || u.username || '未知';

      // 获取学习进度
      const { data: progress } = await client
        .from('level_progress')
        .select('*')
        .eq('user_id', u.id);

      // 获取质检记录
      const { data: qcRecords } = await client
        .from('qc_records')
        .select('*')
        .eq('user_id', u.id)
        .order('qc_date', { ascending: false })
        .limit(5);

      // 获取最新业务数据
      const { data: bizData } = await client
        .from('business_data')
        .select('*')
        .eq('user_id', u.id)
        .order('period_start', { ascending: false })
        .limit(1);

      // 过程线对标
      const unqualified: { key: string; label: string; value: number; unit: string; threshold: number }[] = [];

      const passedLevels = (progress || []).filter((p: Record<string, unknown>) => p.status === 'passed').length;
      const learningT = thresholdMap['learning'];
      const learningPass = learningT?.passing || 7;
      if (passedLevels < learningPass) {
        unqualified.push({ key: 'learning', label: '闯关进度', value: passedLevels, unit: '关', threshold: learningPass });
      }

      // 质检维度对标
      const qcDimensionMap: Record<string, { key: string; label: string }> = {
        qc_communication: { key: 'score_communication', label: '沟通表达' },
        qc_professional: { key: 'score_process', label: '流程规范' },
        qc_service: { key: 'score_service', label: '服务态度' },
        qc_compliance: { key: 'score_business', label: '业务能力' },
      };

      for (const [tKey, dimConfig] of Object.entries(qcDimensionMap)) {
        const dimT = thresholdMap[tKey];
        const dimValue = (qcRecords || []).length > 0
          ? Math.round((qcRecords || []).reduce((sum: number, q: any) => sum + (q[dimConfig.key] || 0), 0) / (qcRecords || []).length)
          : 0;
        const dimPass = dimT?.passing || 70;
        if (dimValue < dimPass) {
          unqualified.push({ key: tKey, label: dimT?.indicator_name || dimConfig.label, value: dimValue, unit: '分', threshold: dimPass });
        }
      }

      // 质检平均分
      const avgQcScore = (qcRecords || []).length > 0
        ? Math.round((qcRecords || []).reduce((sum: number, q: any) => {
            const scores = [q.score_business, q.score_service, q.score_communication, q.score_process].filter((s: any) => s != null);
            return sum + (scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0);
          }, 0) / (qcRecords || []).length)
        : 0;
      const qcScoreT = thresholdMap['qcScore'];
      const qcPass = qcScoreT?.passing || 70;
      if (avgQcScore < qcPass && avgQcScore > 0) {
        unqualified.push({ key: 'qcScore', label: '质检平均分', value: avgQcScore, unit: '分', threshold: qcPass });
      }

      // 结果线对标
      const latestBiz = (bizData || [])[0] || {};
      const bizMetrics = [
        { key: 'wechatAddRate', label: '加V率', dbKey: 'wechat_add_rate' },
        { key: 'consultationRate', label: '面诊率', dbKey: 'consultation_rate' },
        { key: 'receptionRate', label: '接诊率', dbKey: 'reception_rate' },
        { key: 'deliveryRate', label: '签收率', dbKey: 'delivery_rate' },
        { key: 'medicationRate', label: '用药率', dbKey: 'medication_rate' },
        { key: 'appointmentRate', label: '挂号率', dbKey: 'appointment_rate' },
      ];

      for (const metric of bizMetrics) {
        const t = thresholdMap[metric.key];
        const value = latestBiz[metric.dbKey] ? parseFloat(latestBiz[metric.dbKey]) : null;
        const metricPass = t?.passing || 0;
        if (value !== null && value < metricPass) {
          unqualified.push({
            key: metric.key,
            label: t?.indicator_name || metric.label,
            value: Math.round(value * 10) / 10,
            unit: '%',
            threshold: metricPass,
          });
        }
      }

      // 如果有不合格指标，匹配赋能方案
      if (unqualified.length > 0) {
        const recommendedPlans: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[] = [];
        const matchedKeys = new Set<string>();

        for (const item of unqualified) {
          // 优先匹配 indicator_key
          const byKey = (plans || []).find((p: any) => p.indicator_key === item.key);
          if (byKey && !matchedKeys.has(byKey.id)) {
            matchedKeys.add(byKey.id);
            recommendedPlans.push({
              planId: byKey.id,
              planName: byKey.name,
              indicatorKey: item.key,
              alreadyPushed: activeSet.has(`${byKey.id}:${u.id}`),
            });
          }

          // 其次匹配 target_indicators 数组包含
          const byTarget = (plans || []).filter((p: any) =>
            p.target_indicators && Array.isArray(p.target_indicators) && p.target_indicators.includes(item.key) && !matchedKeys.has(p.id)
          );
          for (const p of byTarget) {
            matchedKeys.add(p.id);
            recommendedPlans.push({
              planId: p.id,
              planName: p.name,
              indicatorKey: item.key,
              alreadyPushed: activeSet.has(`${p.id}:${u.id}`),
            });
          }
        }

        // 如果没匹配到具体方案，兜底匹配通用方案
        if (recommendedPlans.length === 0) {
          const general = (plans || []).find((p: any) => p.indicator_key === 'general');
          if (general) {
            recommendedPlans.push({
              planId: general.id,
              planName: general.name,
              indicatorKey: 'general',
              alreadyPushed: activeSet.has(`${general.id}:${u.id}`),
            });
          }
        }

        alerts.push({
          userId: u.id,
          userName,
          unqualifiedIndicators: unqualified,
          recommendedPlans,
        });
      }
    }

    return NextResponse.json({ alerts, totalPlans: (plans || []).length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
