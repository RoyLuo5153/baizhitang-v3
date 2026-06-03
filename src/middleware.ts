import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 路由级权限保护
 * 每个路径显式声明允许访问的角色白名单
 * 未登录用户访问任何/dashboard路径都重定向到/login
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
  '/resources': ['trainee', 'teacher', 'training_manager'],
  '/qc-review': ['mentor', 'teacher', 'training_manager'],
  '/assessment': ['teacher', 'training_manager'],
  '/scrm-import': ['training_manager'],
  '/practice': ['trainee', 'mentor', 'teacher', 'training_manager'],
  '/courses': ['teacher', 'training_manager'],
  '/dashboard': ['training_manager', 'boss'],
  '/overview': ['training_manager', 'boss'],
  '/settings': ['training_manager'],
};

// 角色ID到角色代码的映射（与数据库一致）
const ROLE_ID_MAP: Record<string, RoleCode> = {
  '1': 'trainee',
  '2': 'mentor',
  '3': 'teacher',
  '4': 'training_manager',
  '5': 'boss',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源和API跳过
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

  // 解析token获取角色（当前为base64编码，后续升级JWT）
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    const roleId = parts[2]; // userId:username:roleId
    const userRole = ROLE_ID_MAP[roleId];

    if (!userRole) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // 检查当前路径的权限
    const allowedRoles = ROUTE_PERMISSIONS[pathname];
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      // 无权限，重定向到首页
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
