import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';
import { calculateQuadrant, calculateTeamQuadrant, saveQuadrantSnapshot } from '@/lib/quadrant-engine';

export const dynamic = 'force-dynamic';

// GET /api/quadrant - 查询四象限数据
export async function GET(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const view = searchParams.get('view') || 'team';

  try {
    if (view === 'team') {
      // 团队视角：所有trainee的四象限分布
      const result = await calculateTeamQuadrant();
      return NextResponse.json(result);
    }

    if (userId) {
      // 个人视角：单个用户的四象限详情
      const result = await calculateQuadrant(userId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '需要userId或view=team参数' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '计算四象限失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/quadrant - 手动触发四象限计算(管理员用)
export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const body = await request.json();
    const { userId, periodType = 'weekly' } = body;

    if (userId) {
      // 计算单个用户
      const result = await calculateQuadrant(userId);
      await saveQuadrantSnapshot(userId, result, periodType);
      return NextResponse.json({ success: true, result });
    }

    // 计算全部trainee
    const teamResult = await calculateTeamQuadrant();
    for (const member of teamResult.members) {
      await saveQuadrantSnapshot(member.userId, member, periodType);
    }
    return NextResponse.json({ success: true, ...teamResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '计算四象限失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
