'use client';

import { useAuth } from '@/lib/auth/context';
import ErrorBoundary from '@/components/error-boundary';
import { useRouter, usePathname } from 'next/navigation';
import { getNavForRole, NAV_ITEMS, ROLE_DISPLAY, RoleCode } from '@/lib/auth/permissions';
import {
  Home, BookOpen, UserCheck, Users, Activity, Zap,
  BarChart3, Eye, FileQuestion, FolderOpen, ClipboardCheck,
  ClipboardList, TrendingUp, Settings, LogOut, HeartPulse, ChevronDown, Bell,
  Mic, GraduationCap, BookMarked, ShieldCheck, UserCircle, Gamepad2
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

// icon字符串到lucide组件的映射
const ICON_MAP: Record<string, React.ElementType> = {
  Home, BookOpen, UserCheck, Users, Activity, Zap,
  BarChart3, Eye, FileQuestion, FolderOpen, ClipboardCheck,
  ClipboardList, TrendingUp, Settings, Bell,
  Mic, GraduationCap, BookMarked, ShieldCheck, UserCircle, Gamepad2,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // 加载中显示骨架屏
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F6F0]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2978B5] border-t-transparent" />
          <span className="text-sm text-[#667085]">加载中...</span>
        </div>
      </div>
    );
  }

  // 未登录重定向到登录页
  // 用router.replace而非window.location.href，因为：
  // 1. 此时无cookie依赖问题，只需跳转到登录页
  // 2. replace不会产生历史记录，避免用户按后退键回到需要认证的页面
  // 3. 避免硬跳转导致的循环（硬跳转会重新mount整个应用）
  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
    return null;
  }

  // 基于角色的导航过滤 — 统一使用 permissions.ts 的 getNavForRole
  const userRole = (user.role || 'trainee') as RoleCode;
  const visibleItems = getNavForRole(userRole);

  // 按group分组
  const groups: Record<string, typeof visibleItems> = {};
  for (const item of visibleItems) {
    const g = item.group || 'main';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }
  const groupOrder = ['main', '学习', '管理', '教务', '数据', '设置'];

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const roleLabel = ROLE_DISPLAY;

  return (
    <div className="flex h-screen bg-background overflow-hidden" suppressHydrationWarning>
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} flex-shrink-0 bg-card border-r border-border/50 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border/30">
          <HeartPulse className="w-6 h-6 text-primary flex-shrink-0" />
          {!collapsed && <span className="ml-2 font-semibold text-foreground text-sm">百芝堂赋能</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {groupOrder.filter(g => groups[g]).map(group => (
            <div key={group}>
              {group !== 'main' && !collapsed && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-3 pt-3 pb-1">{group}</div>
              )}
              {group !== 'main' && collapsed && <div className="my-2 border-t border-border/20 mx-2" />}
              {groups[group].map(item => {
                const isActive = pathname === item.href;
                const Icon = ICON_MAP[item.icon] || Home;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse button */}
        <div className="p-2 border-t border-border/30">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 text-xs"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition ${collapsed ? 'rotate-90' : '-rotate-90'}`} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 bg-card border-b border-border/30">
          <h2 className="text-sm font-medium text-muted-foreground">
            {NAV_ITEMS.find(i => i.href === pathname)?.label || '首页'}
          </h2>
          <div className="flex items-center gap-3">
            <a
              href="/notifications"
              className="relative p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
              title="通知中心"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
            </a>
            <span className="text-xs text-muted-foreground">
              {user.realName} · {roleLabel[userRole] || user.role}
              {user.isSuperAdmin && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b]">
                  超管
                </span>
              )}
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-error transition"
              title="退出"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
