import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * 路由级权限保护
 * 每个路径显式声明允许访问的角色白名单
 * 未登录用户访问任何dashboard路径都重定向到/login
 */

type RoleCode = 'trainee' | 'mentor' | 'teacher' | 'training_manager' | 'boss';

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

async function parseToken(token: string): Promise<{ role: string } | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'default-secret-for-dev-only'
    );
    const { payload } = await jwtVerify(token, secret);
    if (payload.role) {
      return { role: payload.role as string };
    }
    return null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源、API、登录页跳过
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/login') ||
    pathname.includes('.') // 静态文件
  ) {
    return NextResponse.next();
  }

  // 从cookie获取auth_token
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // 未登录，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 验证JWT签名获取角色
  const parsed = await parseToken(token);
  if (!parsed || !parsed.role) {
    // token无效，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    // 清除无效cookie
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
      // 无权限，重定向到首页
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // 首页(/)和其他未在ROUTE_PERMISSIONS中的路径放行（已登录即可访问）
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
