import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/growth - 获取个人成长档案
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || '1';

  // 获取用户信息
  const { data: user } = await client
    .from('users')
    .select('id, real_name, username, role, stage, roles(name)')
    .eq('id', userId)
    .maybeSingle();

  // 获取学习进度
  const { data: levelProgress } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId);

  const passedLevels = (levelProgress || []).filter(p => p.status === 'passed').length;
  const totalLevels = 21;

  // 获取最新业务数据
  const { data: bizData } = await client
    .from('business_data')
    .select('*')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(4);

  // 获取质检记录
  const { data: qcRecords } = await client
    .from('qc_records')
    .select('*')
    .eq('user_id', userId)
    .order('qc_date', { ascending: false })
    .limit(5);

  // 获取阈值
  const { data: thresholds } = await client
    .from('thresholds')
    .select('*');

  const thresholdMap: Record<string, any> = {};
  for (const t of thresholds || []) {
    thresholdMap[t.indicator_key] = t;
  }

  // 获取赋能执行记录
  const { data: empowerExecs } = await client
    .from('empower_executions')
    .select('*, empower_plans(name, description)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // 构建过程线对标
  const processLine: any[] = [];

  // 闯关进度
  const learningT = thresholdMap['learning'];
  processLine.push({
    key: 'learning',
    label: '闯关进度',
    value: passedLevels,
    unit: '关',
    thresholds: learningT
      ? { qualified: learningT.passing, good: learningT.good, excellent: learningT.excellent }
      : { qualified: 7, good: 14, excellent: 21 },
    status: passedLevels >= (learningT?.passing || 7) ? 'qualified' : 'unqualified',
  });

  // 质检维度
  const avgQc = (qcRecords || []).length > 0
    ? Math.round((qcRecords || []).reduce((sum: number, q: any) => {
        const scores = [q.score_business, q.score_service, q.score_communication, q.score_process].filter((s: any) => s != null);
        return sum + (scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0);
      }, 0) / (qcRecords || []).length)
    : 0;

  const qcT = thresholdMap['qcScore'];
  processLine.push({
    key: 'qcScore',
    label: '质检平均分',
    value: avgQc,
    unit: '分',
    thresholds: qcT ? { qualified: qcT.passing, good: qcT.good, excellent: qcT.excellent } : { qualified: 70, good: 80, excellent: 90 },
    status: avgQc >= (qcT?.passing || 70) ? 'qualified' : 'unqualified',
  });

  // 4个子维度
  const dimMap: Record<string, { dbKey: string; tKey: string; label: string }> = {
    communication: { dbKey: 'score_communication', tKey: 'qc_communication', label: '沟通表达' },
    professional: { dbKey: 'score_process', tKey: 'qc_professional', label: '流程规范' },
    service: { dbKey: 'score_service', tKey: 'qc_service', label: '服务态度' },
    compliance: { dbKey: 'score_business', tKey: 'qc_compliance', label: '业务能力' },
  };

  for (const [, dim] of Object.entries(dimMap)) {
    const dimVal = (qcRecords || []).length > 0
      ? Math.round((qcRecords || []).reduce((sum: number, q: any) => sum + (q[dim.dbKey] || 0), 0) / (qcRecords || []).length)
      : 0;
    const dimT = thresholdMap[dim.tKey];
    processLine.push({
      key: dim.tKey,
      label: dimT?.indicator_name || dim.label,
      value: dimVal,
      unit: '分',
      thresholds: dimT ? { qualified: dimT.passing, good: dimT.good, excellent: dimT.excellent } : { qualified: 70, good: 80, excellent: 90 },
      status: dimVal >= (dimT?.passing || 70) ? 'qualified' : 'unqualified',
    });
  }

  // 构建结果线对标
  const latestBiz = (bizData || [])[0] || {};
  const resultLine: any[] = [];
  const bizMetrics = [
    { key: 'wechatAddRate', label: '加V率', dbKey: 'wechat_add_rate' },
    { key: 'consultationRate', label: '面诊率', dbKey: 'consultation_rate' },
    { key: 'receptionRate', label: '接诊率', dbKey: 'reception_rate' },
    { key: 'deliveryRate', label: '签收率', dbKey: 'delivery_rate' },
    { key: 'medicationRate', label: '用药率', dbKey: 'medication_rate' },
    { key: 'appointmentRate', label: '挂号率', dbKey: 'appointment_rate' },
  ];

  for (const m of bizMetrics) {
    const val = latestBiz[m.dbKey] ? parseFloat(latestBiz[m.dbKey]) : null;
    const t = thresholdMap[m.key];
    resultLine.push({
      key: m.key,
      label: t?.indicator_name || m.label,
      value: val,
      unit: '%',
      thresholds: t ? { qualified: t.passing, good: t.good, excellent: t.excellent } : { qualified: 0, good: 0, excellent: 0 },
      status: val === null ? 'unqualified' : val >= (t?.passing || 0) ? 'qualified' : 'unqualified',
    });
  }

  const processQualified = processLine.every(i => i.status !== 'unqualified');
  const resultQualified = resultLine.every(i => i.status !== 'unqualified');
  const quadrant = processQualified && resultQualified ? 'A' :
    processQualified && !resultQualified ? 'B' :
    !processQualified && resultQualified ? 'C' : 'D';

  // 构建周趋势
  const weeklyTrend = (bizData || []).map((b: any) => ({
    periodStart: b.period_start,
    periodEnd: b.period_end,
    metrics: {
      wechatAddRate: parseFloat(b.wechat_add_rate || '0'),
      consultationRate: parseFloat(b.consultation_rate || '0'),
      receptionRate: parseFloat(b.reception_rate || '0'),
    },
  }));

  return NextResponse.json({
    user: user ? { ...user, name: user.real_name || user.username || '未知' } : { id: userId, name: '未知', role: 'trainee', stage: 1 },
    learning: { passed: passedLevels, total: totalLevels, progress: Math.round(passedLevels / totalLevels * 100) },
    processLine,
    resultLine,
    quadrant,
    processQualified,
    resultQualified,
    empowerHistory: (empowerExecs || []).map((e: any) => ({
      id: e.id,
      planName: e.empower_plans?.name || '未命名方案',
      status: e.status,
      startedAt: e.started_at,
      completedAt: e.completed_at,
    })),
    weeklyTrend,
    qcRecords: (qcRecords || []).map((q: any) => ({
      id: q.id,
      type: q.qc_type,
      date: q.qc_date,
      dimensions: {
        business: q.score_business,
        service: q.score_service,
        communication: q.score_communication,
        process: q.score_process,
      },
      feedback: q.human_comment || q.ai_analysis,
    })),
  });
}
