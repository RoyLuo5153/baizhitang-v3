import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/business - 获取业务数据
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const period = searchParams.get('period');

  let query = client.from('business_data').select('*');
  if (userId) query = query.eq('user_id', userId);
  if (period) query = query.eq('period_start', period);

  const { data, error } = await query.order('period_start', { ascending: false }).limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

// POST /api/business - 录入业务数据
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const body = await request.json();
  const {
    userId, periodStart, periodEnd, periodType,
    wechatAddRate, consultationRate, receptionRate,
    deliveryRate, medicationRate, appointmentRate,
    totalPatients, newPatients, source, notes,
  } = body;

  if (!userId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await client
    .from('business_data')
    .insert({
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
      data_source: source || 'manual',
      notes,
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
