'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  realName: string;
  role: string;
  primaryRole: string;
  stage: number;
  permissions?: string[];
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ forceChangePassword?: boolean }>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  forceChangePassword: boolean;
  setForceChangePassword: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: async () => {},
  hasPermission: () => false,
  forceChangePassword: false,
  setForceChangePassword: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string): Promise<{ forceChangePassword?: boolean }> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');

    // 如果需要强制改密，不跳转，让前端弹窗
    if (data.forceChangePassword) {
      setForceChangePassword(true);
      // 先设置user，以便弹窗期间知道当前用户
      if (data.user) setUser(data.user);
      return { forceChangePassword: true };
    }

    // 硬导航：认证成功后必须走完整HTTP请求
    // 原因：router.push是软导航，不触发middleware验证，不保证cookie随请求发送
    // 硬导航确保：cookie随请求发送 → middleware校验通过 → auth context从/api/auth/me重新初始化
    window.location.href = '/';
    return {};
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setForceChangePassword(false);
    // 登出也用硬导航，确保清除所有客户端状态
    window.location.href = '/login';
  };

  const hasPermission = (permission: string): boolean => {
    if (!user?.permissions) return false;
    return user.permissions.includes(permission) || user.permissions.includes('*');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, forceChangePassword, setForceChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
