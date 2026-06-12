import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { calculateQuadrant, saveQuadrantSnapshot } from '@/lib/quadrant-engine';

export const dynamic = 'force-dynamic';

// POST /api/business/batch - 批量导入业务数据
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const { records } = body;

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: '缺少导入数据' }, { status: 400 });
  }

  const results: { success: boolean; name?: string; error?: string }[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const record of records) {
    try {
      const {
        userId, periodStart, periodEnd, periodType,
        wechatAddRate, consultationRate, receptionRate,
        deliveryRate, medicationRate, appointmentRate,
        name, source,
      } = record;

      if (!userId || !periodStart || !periodEnd) {
        results.push({ success: false, name: name || '未知', error: '缺少必要字段' });
        failCount++;
        continue;
      }

      const { data, error } = await client
        .from('business_data')
        .upsert({
          user_id: userId,
          period_type: periodType || 'weekly',
          period_start: periodStart,
          period_end: periodEnd,
          wechat_add_rate: wechatAddRate,
          consultation_rate: consultationRate,
          reception_rate: receptionRate,
          delivery_rate: deliveryRate,
          medication_rate: medicationRate,
          appointment_rate: appointmentRate,
          data_source: source || 'batch_import',
        }, { onConflict: 'user_id,period_start,period_type' })
        .select()
        .maybeSingle();

      if (error) {
        results.push({ success: false, name: name || '未知', error: error.message });
        failCount++;
        continue;
      }

      // 自动触发四象限计算
      try {
        const result = await calculateQuadrant(userId);
        await saveQuadrantSnapshot(userId, result, periodType || 'weekly');
      } catch (e) {
        console.error('Quadrant calculation failed after batch import:', e);
      }

      results.push({ success: true, name: name || '未知' });
      successCount++;
    } catch (err) {
      results.push({ success: false, name: record.name || '未知', error: String(err) });
      failCount++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `导入完成：成功${successCount}条，失败${failCount}条`,
    details: { total: records.length, successCount, failCount },
    results,
  });
}
