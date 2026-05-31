import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());

    if (payload.exp < Date.now()) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
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
      },
    });
  } catch {
    return NextResponse.json({ error: '无效的登录凭证' }, { status: 401 });
  }
}
