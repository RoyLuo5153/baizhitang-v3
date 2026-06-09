import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/business/funnel - 团队漏斗数据(均值+学员明细)
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromHeaders(request);
    const supabase = getSupabaseClient();

    // 获取所有trainee的最新业务数据
    const { data: bizData, error: bizError } = await supabase
      .from('business_data')
      .select('user_id, wechat_add_rate, consultation_rate, reception_rate, delivery_rate, medication_rate, appointment_rate, period_start')
      .order('period_start', { ascending: false });

    if (bizError) throw bizError;

    if (!bizData || bizData.length === 0) {
      return NextResponse.json({
        teamAverages: null,
        traineeBreakdowns: null,
      });
    }

    // Get trainee names
    const { data: trainees, error: traineeError } = await supabase
      .from('users')
      .select('id, real_name')
      .eq('is_active', true);

    if (traineeError) throw traineeError;

    const nameMap = new Map((trainees || []).map((t: { id: string; real_name: string }) => [t.id, t.real_name]));

    // Get latest record per user
    const latestByUser = new Map<string, typeof bizData[0]>();
    for (const row of bizData) {
      if (!latestByUser.has(row.user_id)) {
        latestByUser.set(row.user_id, row);
      }
    }

    const records = Array.from(latestByUser.values());
    const keys = ['wechat_add_rate', 'consultation_rate', 'reception_rate', 'delivery_rate', 'medication_rate', 'appointment_rate'] as const;

    // Compute team averages
    const teamAverages: Record<string, number> = {};
    for (const key of keys) {
      const values = records.map(r => r[key]).filter((v): v is number => v !== null && v !== undefined);
      teamAverages[key] = values.length > 0 ? Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length * 10) / 10 : 0;
    }

    // Compute per-trainee breakdowns
    const traineeBreakdowns: Record<string, { name: string; rate: number }[]> = {};
    for (const key of keys) {
      traineeBreakdowns[key] = records
        .map(r => ({
          name: nameMap.get(r.user_id) || r.user_id,
          rate: r[key] ?? 0,
        }))
        .sort((a, b) => b.rate - a.rate);
    }

    return NextResponse.json({ teamAverages, traineeBreakdowns });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
