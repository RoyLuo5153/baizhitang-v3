export type RoleCode = 'trainee' | 'mentor' | 'teacher' | 'training_manager' | 'boss';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: RoleCode[];
  group?: string;
}

export const NAV_ITEMS: NavItem[] = [
  // 新人专属
  { label: '闯关学习', href: '/learning', icon: 'Gamepad2', roles: ['trainee'], group: '学习' },
  { label: '成长档案', href: '/growth', icon: 'UserCheck', roles: ['trainee', 'mentor'], group: '学习' },

  // 带教专属
  { label: '新人看板', href: '/trainee-board', icon: 'Users', roles: ['mentor', 'training_manager'], group: '管理' },
  { label: '质检审核', href: '/qc-review', icon: 'ShieldCheck', roles: ['mentor'], group: '管理' },

  // 培训老师专属
  { label: '题库管理', href: '/question-bank', icon: 'FileQuestion', roles: ['teacher', 'training_manager'], group: '教学' },
  { label: '资料中心', href: '/resources', icon: 'BookOpen', roles: ['teacher', 'trainee', 'mentor', 'training_manager'], group: '教学' },
  { label: '日常考核', href: '/assessment', icon: 'ClipboardCheck', roles: ['teacher', 'training_manager'], group: '教学' },

  // 管理者专属
  { label: '双轨诊断', href: '/diagnosis', icon: 'Activity', roles: ['training_manager'], group: '诊断' },
  { label: '赋能中心', href: '/empowerment', icon: 'Zap', roles: ['mentor', 'training_manager'], group: '诊断' },
  { label: '数据看板', href: '/dashboard', icon: 'BarChart3', roles: ['training_manager'], group: '数据' },
  { label: '业务数据', href: '/scrm-import', icon: 'TrendingUp', roles: ['training_manager'], group: '数据' },

  // 总经理专属
  { label: '全局概览', href: '/overview', icon: 'Eye', roles: ['boss', 'training_manager'], group: '决策' },

  // 设置
  { label: '系统设置', href: '/settings', icon: 'Settings', roles: ['training_manager'], group: '设置' },
];

export function getNavForRole(role: RoleCode): NavItem[] {
  return NAV_ITEMS.filter(item => item.roles.includes(role));
}

export const ROLE_DISPLAY: Record<RoleCode, string> = {
  trainee: '新人',
  mentor: '带教老师',
  teacher: '培训老师',
  training_manager: '培训负责人',
  boss: '总经理',
};

export const ROLE_COLORS: Record<RoleCode, string> = {
  trainee: 'bg-primary/10 text-primary',
  mentor: 'bg-warning/10 text-warning',
  teacher: 'bg-success/10 text-success',
  training_manager: 'bg-error/10 text-error',
  boss: 'bg-muted text-foreground',
};
