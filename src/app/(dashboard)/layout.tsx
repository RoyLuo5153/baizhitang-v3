'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home, BookOpen, UserCircle, Users, Activity, Zap,
  BarChart3, Eye, FileQuestion, FolderOpen, ClipboardCheck,
  ClipboardList, TrendingUp, Settings, LogOut, HeartPulse, ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  group?: string;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/', icon: Home },
  // 学习
  { label: '闯关学习', href: '/learning', icon: BookOpen, permission: 'learning.view', group: '学习' },
  { label: '成长档案', href: '/growth', icon: UserCircle, permission: 'growth.own', group: '学习' },
  // 管理
  { label: '新人看板', href: '/trainee-board', icon: Users, permission: 'growth.team', group: '管理' },
  { label: '双轨诊断', href: '/diagnosis', icon: Activity, permission: 'diagnosis.team', group: '管理' },
  { label: '赋能中心', href: '/empowerment', icon: Zap, permission: 'empower.assign', group: '管理' },
  // 数据
  { label: '数据看板', href: '/dashboard', icon: BarChart3, permission: 'dashboard.team', group: '数据' },
  { label: '全局概览', href: '/overview', icon: Eye, permission: 'overview.view', group: '数据' },
  // 教务
  { label: '题库管理', href: '/question-bank', icon: FileQuestion, permission: 'question.create', group: '教务' },
  { label: '资料中心', href: '/resources', icon: FolderOpen, permission: 'resource.view', group: '教务' },
  { label: '质检审核', href: '/qc-review', icon: ClipboardCheck, permission: 'qc.review', group: '教务' },
  { label: '日常考核', href: '/assessment', icon: ClipboardList, permission: 'assessment.create', group: '教务' },
  { label: '业务数据', href: '/scrm-import', icon: TrendingUp, permission: 'business.view', group: '教务' },
  // 设置
  { label: '系统设置', href: '/settings', icon: Settings, permission: 'settings.user', group: '设置' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  // 过滤导航项
  const visibleItems = ALL_NAV_ITEMS.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  // 按group分组
  const groups: Record<string, NavItem[]> = {};
  for (const item of visibleItems) {
    const g = item.group || 'main';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }
  const groupOrder = ['main', '学习', '管理', '数据', '教务', '设置'];

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const roleLabel: Record<string, string> = {
    training_manager: '培训负责人',
    boss: '总经理',
    teacher: '培训老师',
    mentor: '带教老师',
    trainee: '新人',
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
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
                const Icon = item.icon;
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
            {ALL_NAV_ITEMS.find(i => i.href === pathname)?.label || '首页'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {user.realName} · {roleLabel[user.role] || user.role}
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
          {children}
        </main>
      </div>
    </div>
  );
}
