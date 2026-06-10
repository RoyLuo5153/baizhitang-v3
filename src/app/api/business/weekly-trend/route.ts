import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const weeks = parseInt(searchParams.get('weeks') || '4');

    // 查询近N周的周粒度业务数据
    const { data: weeklyData, error } = await supabase
      .from('business_data')
      .select('period_start, wechat_add_rate, consultation_rate, reception_rate, delivery_rate, medication_rate, appointment_rate')
      .eq('period_type', 'weekly')
      .order('period_start', { ascending: false })
      .limit(weeks * 10); // 多取一些，因为可能有多个学员

    if (error) {
      console.error('Weekly trend query error:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    if (!weeklyData || weeklyData.length === 0) {
      return NextResponse.json({ weeks: [] });
    }

    // 按周分组聚合（取团队平均）
    const weekMap = new Map<string, {
      period_start: string;
      wechat_add_rate: number[];
      consultation_rate: number[];
      reception_rate: number[];
      delivery_rate: number[];
      medication_rate: number[];
      appointment_rate: number[];
    }>();

    for (const row of weeklyData) {
      const weekKey = row.period_start;
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          period_start: weekKey,
          wechat_add_rate: [],
          consultation_rate: [],
          reception_rate: [],
          delivery_rate: [],
          medication_rate: [],
          appointment_rate: [],
        });
      }
      const entry = weekMap.get(weekKey)!;
      if (row.wechat_add_rate != null) entry.wechat_add_rate.push(Number(row.wechat_add_rate));
      if (row.consultation_rate != null) entry.consultation_rate.push(Number(row.consultation_rate));
      if (row.reception_rate != null) entry.reception_rate.push(Number(row.reception_rate));
      if (row.delivery_rate != null) entry.delivery_rate.push(Number(row.delivery_rate));
      if (row.medication_rate != null) entry.medication_rate.push(Number(row.medication_rate));
      if (row.appointment_rate != null) entry.appointment_rate.push(Number(row.appointment_rate));
    }

    // 计算每周平均，取近N周
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    const weeks_result = Array.from(weekMap.values())
      .sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime())
      .slice(-weeks)
      .map((w, i) => {
        const startDate = new Date(w.period_start);
        const weekLabel = `W${i + 1} (${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getDate().toString().padStart(2, '0')})`;
        return {
          week: weekLabel,
          stages: [
            { key: 'wechatAddRate', label: '加V率', value: avg(w.wechat_add_rate), threshold: 90 },
            { key: 'consultationRate', label: '面诊率', value: avg(w.consultation_rate), threshold: 85 },
            { key: 'receptionRate', label: '接诊率', value: avg(w.reception_rate), threshold: 80 },
            { key: 'signRate', label: '签收率', value: avg(w.delivery_rate), threshold: 60 },
            { key: 'medicationRate', label: '用药率', value: avg(w.medication_rate), threshold: 70 },
            { key: 'registrationRate', label: '挂号率', value: avg(w.appointment_rate), threshold: 50 },
          ].filter(s => s.value !== null),
        };
      })
      .filter(w => w.stages.length > 0);

    return NextResponse.json({ weeks: weeks_result });
  } catch (err) {
    console.error('Weekly trend error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
