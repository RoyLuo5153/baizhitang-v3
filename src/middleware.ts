import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * 全局鉴权中间件
 * 1. API路由：JWT验证 + 用户信息注入请求头 + 角色权限校验
 * 2. 页面路由：JWT验证 + 角色路由权限
 */

type RoleCode = 'trainee' | 'mentor' | 'teacher' | 'training_manager' | 'boss';

// 无需鉴权的API路由白名单
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/auth/change-password',
];

// API路由角色权限（未列出的API已登录即可访问）
const API_PERMISSIONS: Record<string, RoleCode[]> = {
  '/api/users': ['training_manager', 'boss'],
  '/api/migrate': ['training_manager'],
  '/api/stage-rules': ['training_manager'],
  '/api/thresholds': ['training_manager'],
  '/api/mentor-trainees': ['training_manager', 'mentor'],
};

// 页面路由角色权限
const ROUTE_PERMISSIONS: Record<string, RoleCode[]> = {
  '/learning': ['trainee', 'mentor', 'teacher', 'training_manager'],
  '/growth': ['trainee', 'mentor', 'training_manager'],
  '/knowledge-base': ['trainee', 'mentor', 'teacher', 'training_manager'],
  '/trainee-board': ['mentor', 'training_manager'],
  '/trainee-profiles': ['mentor', 'training_manager'],
  '/diagnosis': ['mentor', 'training_manager'],
  '/empowerment': ['mentor', 'training_manager'],
  '/question-bank': ['teacher', 'training_manager'],
  '/resources': ['trainee', 'mentor', 'teacher', 'training_manager'],
  '/qc-review': ['mentor', 'teacher', 'training_manager'],
  '/assessment': ['teacher', 'training_manager'],
  '/scrm-import': ['training_manager'],
  '/practice': ['trainee', 'mentor', 'teacher', 'training_manager'],
  '/courses': ['trainee', 'teacher', 'training_manager', 'mentor'],
  '/dashboard': ['training_manager', 'boss'],
  '/overview': ['training_manager', 'boss'],
  '/settings': ['training_manager'],
};

async function parseToken(token: string): Promise<{ userId: string; role: string; permissions: string[] } | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'bz-training-dev-secret-key-2026'
    );
    const { payload } = await jwtVerify(token, secret);
    if (payload.userId && payload.role) {
      return {
        userId: payload.userId as string,
        role: payload.role as string,
        permissions: (payload.permissions as string[]) || [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源跳过
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') // 静态文件
  ) {
    return NextResponse.next();
  }

  // ====== API路由鉴权 ======
  if (pathname.startsWith('/api/')) {
    // 白名单API放行
    if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // 检查auth_token cookie
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // JWT验证
    const parsed = await parseToken(token);
    if (!parsed) {
      return NextResponse.json({ error: '无效凭证，请重新登录' }, { status: 401 });
    }

    // API角色权限校验（找最长匹配前缀）
    let matchedPath = '';
    for (const routePath of Object.keys(API_PERMISSIONS)) {
      if (pathname.startsWith(routePath) && routePath.length > matchedPath.length) {
        matchedPath = routePath;
      }
    }
    if (matchedPath) {
      const allowedRoles = API_PERMISSIONS[matchedPath];
      if (!allowedRoles.includes(parsed.role as RoleCode)) {
        return NextResponse.json({ error: '无权限访问' }, { status: 403 });
      }
    }

    // 将用户信息注入请求头，供下游API使用
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', parsed.userId);
    requestHeaders.set('x-user-role', parsed.role);
    requestHeaders.set('x-user-permissions', parsed.permissions.join(','));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ====== 登录页跳过 ======
  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // ====== 页面路由鉴权 ======
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const parsed = await parseToken(token);
  if (!parsed || !parsed.role) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('auth_token', '', { maxAge: 0 });
    return response;
  }

  const userRole = parsed.role as RoleCode;

  // 检查当前路径的权限（找到最长匹配的路径前缀）
  let matchedPath = '';
  for (const routePath of Object.keys(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(routePath) && routePath.length > matchedPath.length) {
      matchedPath = routePath;
    }
  }

  if (matchedPath) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedPath];
    if (!allowedRoles.includes(userRole)) {
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
