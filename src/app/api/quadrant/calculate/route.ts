import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromHeaders, hasRole } from '@/lib/auth/api-auth';
import { calculateQuadrant, saveQuadrantSnapshot } from '@/lib/quadrant-engine';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 只有管理员和培训经理可以手动触发全量重算
    if (!hasRole(auth, 'training_manager', 'boss')) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const periodType = body.periodType || 'monthly';
    const userId = body.userId; // 如果指定userId则只重算该用户

    if (userId) {
      // 单用户重算
      const result = await calculateQuadrant(userId);
      if (result) {
        await saveQuadrantSnapshot(userId, result, periodType);
      }
      return NextResponse.json({ success: true, recalculated: 1, result });
    }

    // 全量重算：获取所有trainee
    const { pgQuery } = await import('@/storage/database/pg-client');
    const trainees = await pgQuery<{ id: string }>(
      "SELECT id FROM users WHERE role_id = 1 AND is_active = true"
    );

    let recalculated = 0;
    const errors: string[] = [];

    for (const trainee of trainees) {
      try {
        const result = await calculateQuadrant(trainee.id);
        if (result) {
          await saveQuadrantSnapshot(trainee.id, result, periodType);
          recalculated++;
        }
      } catch (err) {
        errors.push(`${trainee.id}: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }

    return NextResponse.json({
      success: true,
      recalculated,
      total: trainees.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Quadrant calculate error:', error);
    return NextResponse.json(
      { error: '四象限计算失败' },
      { status: 500 }
    );
  }
}
