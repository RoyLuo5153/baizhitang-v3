import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/diagnosis - 获取诊断数据（双轨四象限）
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'overview';
  const userId = searchParams.get('userId');

  if (view === 'overview' || view === 'team') {
    // 团队概览：返回所有成员的四象限分类
    const { data: users, error } = await client
      .from('users')
      .select('id, real_name, username, role_id, stage')
      .eq('is_active', true)
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results = [];
    for (const u of users || []) {
      const quad = await calculateQuadrant(client, u.id);
      // 计算汇总分数：过程线/结果线各指标达标率的均值
      const processScore = calcAggregateScore(quad.processDetails);
      const resultScore = calcAggregateScore(quad.resultDetails);
      results.push({
        ...u,
        name: u.real_name || u.username || '未知',
        quadrant: quad.quadrant,
        processQualified: quad.processQualified,
        resultQualified: quad.resultQualified,
        processScore,
        resultScore,
        processDetails: quad.processDetails,
        resultDetails: quad.resultDetails,
      });
    }

    const summary = {
      total: results.length,
      A: results.filter(r => r.quadrant === 'A').length,
      B: results.filter(r => r.quadrant === 'B').length,
      C: results.filter(r => r.quadrant === 'C').length,
      D: results.filter(r => r.quadrant === 'D').length,
    };

    return NextResponse.json({ summary, members: results });
  }

  // 个人详情
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const quad = await calculateQuadrant(client, userId);
  const unqualifiedItems = getUnqualifiedItems(quad);

  // 获取匹配的赋能方案
  const { data: empowerPlans } = await client
    .from('empower_plans')
    .select('*')
    .eq('is_active', true);

  const matchedPlans = matchPlansToUnqualified(unqualifiedItems, empowerPlans || []);

  return NextResponse.json({
    userId,
    quadrant: quad.quadrant,
    processQualified: quad.processQualified,
    resultQualified: quad.resultQualified,
    processDetails: quad.processDetails,
    resultDetails: quad.resultDetails,
    unqualifiedItems,
    matchedPlans,
  });
}

/** 计算汇总分数：各指标达标率(0-100)的均值 */
function calcAggregateScore(details: Record<string, any>): number {
  const items = Object.values(details);
  if (items.length === 0) return 0;
  const scores = items.map((item: any) => {
    const { value, threshold } = item;
    const t = threshold?.excellent || threshold?.good || threshold?.passing || 100;
    if (t <= 0) return value || 0;
    return Math.min(Math.round((value / t) * 100), 100);
  });
  return Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
}

async function calculateQuadrant(client: any, userId: string) {
  // 获取学习进度
  const { data: progress } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId);

  // 获取质检记录
  const { data: qcRecords } = await client
    .from('qc_records')
    .select('*')
    .eq('user_id', userId)
    .order('qc_date', { ascending: false })
    .limit(5);

  // 获取最新业务数据
  const { data: bizData } = await client
    .from('business_data')
    .select('*')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(1);

  // 获取阈值配置
  const { data: thresholds } = await client
    .from('thresholds')
    .select('*');

  const thresholdMap: Record<string, any> = {};
  for (const t of thresholds || []) {
    thresholdMap[t.indicator_key] = t;
  }

  // 过程线逐项对标
  const passedLevels = (progress || []).filter((p: Record<string, unknown>) => p.status === 'passed').length;
  const processItems: Record<string, any> = {};

  // 闯关对标
  const learningT = thresholdMap['learning'];
  processItems.learning = {
    label: '闯关进度',
    value: passedLevels,
    unit: '关',
    threshold: learningT ? { qualified: learningT.passing, good: learningT.good, excellent: learningT.excellent } : { qualified: 7, good: 14, excellent: 21 },
    level: passedLevels >= (learningT?.excellent || 21) ? 'excellent' : passedLevels >= (learningT?.good || 14) ? 'good' : passedLevels >= (learningT?.passing || 7) ? 'qualified' : 'unqualified',
  };

  // 质检对标 - 使用实际列
  const avgQcScore = (qcRecords || []).length > 0
    ? Math.round((qcRecords || []).reduce((sum: number, q: any) => {
        const scores = [q.score_business, q.score_service, q.score_communication, q.score_process].filter((s: any) => s != null);
        const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
        return sum + avg;
      }, 0) / (qcRecords || []).length)
    : 0;

  const qcScoreT = thresholdMap['qcScore'];
  processItems.qcScore = {
    label: '质检平均分',
    value: avgQcScore,
    unit: '分',
    threshold: qcScoreT ? { qualified: qcScoreT.passing, good: qcScoreT.good, excellent: qcScoreT.excellent } : { qualified: 70, good: 80, excellent: 90 },
    level: avgQcScore >= (qcScoreT?.excellent || 90) ? 'excellent' : avgQcScore >= (qcScoreT?.good || 80) ? 'good' : avgQcScore >= (qcScoreT?.passing || 70) ? 'qualified' : 'unqualified',
  };

  // 质检4维度
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
    processItems[tKey] = {
      label: dimT?.indicator_name || dimConfig.label,
      value: dimValue,
      unit: '分',
      threshold: dimT ? { qualified: dimT.passing, good: dimT.good, excellent: dimT.excellent } : { qualified: 70, good: 80, excellent: 90 },
      level: dimValue >= (dimT?.excellent || 90) ? 'excellent' : dimValue >= (dimT?.good || 80) ? 'good' : dimValue >= (dimT?.passing || 70) ? 'qualified' : 'unqualified',
    };
  }

  const processQualified = Object.values(processItems).every((item: any) => item.level !== 'unqualified');

  // 结果线逐项对标
  const resultItems: Record<string, any> = {};
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
    resultItems[metric.key] = {
      label: t?.indicator_name || metric.label,
      value,
      unit: '%',
      threshold: t ? { qualified: t.passing, good: t.good, excellent: t.excellent } : { qualified: 0, good: 0, excellent: 0 },
      level: value === null ? 'unqualified' :
        value >= (t?.excellent || 100) ? 'excellent' :
        value >= (t?.good || 80) ? 'good' :
        value >= (t?.passing || 60) ? 'qualified' : 'unqualified',
    };
  }

  const resultQualified = Object.values(resultItems).every((item: any) => item.level !== 'unqualified');

  const quadrant = processQualified && resultQualified ? 'A' :
    processQualified && !resultQualified ? 'B' :
    !processQualified && resultQualified ? 'C' : 'D';

  return {
    quadrant,
    processQualified,
    resultQualified,
    processDetails: processItems,
    resultDetails: resultItems,
  };
}

function getUnqualifiedItems(quad: any): string[] {
  const items: string[] = [];
  for (const [key, val] of Object.entries(quad.processDetails || {})) {
    if ((val as any).level === 'unqualified') items.push(key);
  }
  for (const [key, val] of Object.entries(quad.resultDetails || {})) {
    if ((val as any).level === 'unqualified') items.push(key);
  }
  return items;
}

function matchPlansToUnqualified(items: string[], plans: any[]): any[] {
  return items.map(itemKey => {
    const matched = plans.find(p =>
      p.target_indicators && Array.isArray(p.target_indicators) && p.target_indicators.includes(itemKey)
    );
    return {
      metricKey: itemKey,
      plan: matched || null,
    };
  });
}
