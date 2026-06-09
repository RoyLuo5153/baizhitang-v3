import { NextResponse } from 'next/server';

/**
 * API鉴权工具函数
 * 从middleware注入的请求头中读取用户身份信息
 */

export interface AuthInfo {
  id: string;       // 兼容旧代码中的 user.id
  userId: string;
  role: string;
}

/**
 * 从请求头读取middleware注入的用户身份
 * middleware在JWT验证通过后，将userId和role注入x-user-id/x-user-role请求头
 */
export function getAuthFromHeaders(request: Request): AuthInfo | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role) return null;
  return { id: userId, userId, role };
}

/**
 * 角色权限常量
 */
export const ROLES = {
  TRAINEE: 'trainee',
  MENTOR: 'mentor',
  TEACHER: 'teacher',
  TRAINING_MANAGER: 'training_manager',
  BOSS: 'boss',
} as const;

/**
 * 检查用户是否拥有指定角色之一
 */
export function hasRole(auth: AuthInfo, ...roles: string[]): boolean {
  return roles.includes(auth.role);
}

/**
 * 仅允许指定角色访问，否则返回403
 */
export function requireRoles(auth: AuthInfo, ...roles: string[]): NextResponse | null {
  if (!hasRole(auth, ...roles)) {
    return NextResponse.json({ error: '无权限访问' }, { status: 403 });
  }
  return null;
}
