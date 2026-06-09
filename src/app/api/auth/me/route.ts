import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const payload = await verifyJWT(token);

  if (!payload) {
    return NextResponse.json({ error: '登录已过期或无效凭证' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: payload.userId,
      username: payload.username,
      realName: payload.realName,
      role: payload.role,
      primaryRole: payload.role,
      stage: payload.stage,
      permissions: payload.permissions || [],
      isSuperAdmin: payload.isSuperAdmin || false,
    },
  });
}
