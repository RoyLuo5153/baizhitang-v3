import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, monthIndex, field, value } = body;

    if (!userId || !monthIndex || !field) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Check if record exists
    const { data: existing } = await supabase
      .from('trainee_monthly_data')
      .select('id')
      .eq('user_id', userId)
      .eq('month_index', monthIndex)
      .single();

    const updateData: Record<string, unknown> = { [field]: value, updated_at: new Date().toISOString() };

    if (existing) {
      const { error } = await supabase
        .from('trainee_monthly_data')
        .update(updateData)
        .eq('user_id', userId)
        .eq('month_index', monthIndex);

      if (error) {
        console.error('[trainee-monthly] PUT update error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }
    } else {
      const insertData: Record<string, unknown> = {
        user_id: userId,
        month_index: monthIndex,
        data_type: monthIndex <= 2 ? 'training' : 'assigned',
        ...updateData,
      };
      const { error } = await supabase
        .from('trainee_monthly_data')
        .insert(insertData);

      if (error) {
        console.error('[trainee-monthly] PUT insert error:', error);
        return NextResponse.json({ error: '创建失败' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: '更新成功', success: true });
  } catch (error: unknown) {
    console.error('[trainee-monthly] PUT error:', error);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
