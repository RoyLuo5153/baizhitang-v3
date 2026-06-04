'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, AlertCircle, Info, Bell, Users, Clock, TrendingDown,
  Zap, Shield, FileQuestion, Headphones, BookOpen, Loader2,
  ChevronRight, Filter,
} from 'lucide-react';

interface AlertItem {
  userId: string;
  realName: string;
  alertType: string;
  alertLevel: 'warning' | 'danger' | 'info';
  message: string;
  detail: string;
  relatedModule: string;
  relatedId: string | null;
  createdAt: string;
  mentorName: string | null;
  department: string | null;
  stage: number | null;
}

interface AlertStats {
  total: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
  byType: Record<string, number>;
}

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  level_overdue: { label: '闯关逾期', icon: Clock, color: '#ef4444', bgColor: 'bg-[#ef4444]/10' },
  practice_low_score: { label: '演练低分', icon: TrendingDown, color: '#F59E0B', bgColor: 'bg-[#F59E0B]/10' },
  diagnosis_fail: { label: '诊断不合格', icon: AlertTriangle, color: '#ef4444', bgColor: 'bg-[#ef4444]/10' },
  upcoming_group: { label: '即将下组', icon: Bell, color: '#2978B5', bgColor: 'bg-[#2978B5]/10' },
  consecutive_d: { label: '连续D类', icon: AlertCircle, color: '#dc2626', bgColor: 'bg-[#dc2626]/10' },
  pending_review: { label: '待审核演练', icon: Headphones, color: '#8b5cf6', bgColor: 'bg-[#8b5cf6]/10' },
  pending_qc: { label: '待审核质检', icon: Shield, color: '#0891b2', bgColor: 'bg-[#0891b2]/10' },
  pending_practice: { label: '待完成演练', icon: FileQuestion, color: '#6366f1', bgColor: 'bg-[#6366f1]/10' },
};

const LEVEL_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  danger: { label: '紧急', color: '#dc2626', bgColor: 'bg-[#dc2626]/10' },
  warning: { label: '预警', color: '#F59E0B', bgColor: 'bg-[#F59E0B]/10' },
  info: { label: '提醒', color: '#2978B5', bgColor: 'bg-[#2978B5]/10' },
};

const MODULE_ROUTES: Record<string, string> = {
  learning: '/learning',
  practice: '/practice',
  diagnosis: '/diagnosis',
  empowerment: '/empowerment',
  'qc-review': '/qc-review',
  'trainee-profiles': '/trainee-profiles',
  growth: '/growth',
};

export default function TraineeBoardPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

  // Get current user
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user) setCurrentUser({ id: d.user.id, role: d.user.role });
    }).catch(() => {});
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const params = new URLSearchParams({
        userId: currentUser.id,
        roleId: currentUser.role,
      });
      const res = await fetch(`/api/trainee-alerts?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.alerts || []);
        setStats(json.stats || null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Filter alerts
  const filteredAlerts = alerts.filter(a => {
    if (filterLevel !== 'all' && a.alertLevel !== filterLevel) return false;
    if (filterType !== 'all' && a.alertType !== filterType) return false;
    return true;
  });

  // Role-based label
  const roleLabel = (() => {
    switch (currentUser?.role) {
      case '1': return '我的待办';
      case '3': return '带教预警';
      case '4': return '教务预警';
      case '2': return '全局预警';
      case '5': return '经营预警';
      default: return '预警看板';
    }
  })();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#F59E0B]" />
            <h1 className="text-xl font-bold text-foreground">{roleLabel}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {currentUser?.role === 'trainee' ? '系统在关注你的进度，及时完成待办任务' : '系统盯人 — 自动发现异常，驱动赋能'}
          </p>
        </div>
        <button
          onClick={() => fetchAlerts()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          刷新
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg p-4 shadow-card border-l-4 border-l-[#dc2626]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-[#dc2626]">{stats.dangerCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">紧急</p>
              </div>
              <AlertCircle className="w-8 h-8 text-[#dc2626]/20" />
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 shadow-card border-l-4 border-l-[#F59E0B]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-[#F59E0B]">{stats.warningCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">预警</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-[#F59E0B]/20" />
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 shadow-card border-l-4 border-l-[#2978B5]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-[#2978B5]">{stats.infoCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">提醒</p>
              </div>
              <Info className="w-8 h-8 text-[#2978B5]/20" />
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 shadow-card border-l-4 border-l-muted">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">总计</p>
              </div>
              <Bell className="w-8 h-8 text-muted-foreground/20" />
            </div>
          </div>
        </div>
      )}

      {/* Alert Type Distribution (compact bar) */}
      {stats && stats.total > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-card">
          <h3 className="text-sm font-medium text-foreground mb-3">预警类型分布</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(stats.byType)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const config = ALERT_TYPE_CONFIG[type];
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? 'all' : type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${filterType === type ? 'ring-2 ring-primary' : ''} ${config.bgColor}`}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    <span className="text-foreground">{config.label}</span>
                    <span className="ml-auto font-bold" style={{ color: config.color }}>{count}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-2">
          {[
            { value: 'all', label: '全部' },
            { value: 'danger', label: '紧急' },
            { value: 'warning', label: '预警' },
            { value: 'info', label: '提醒' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterLevel(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterLevel === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-card rounded-lg p-12 text-center shadow-card">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">暂无预警信息</p>
            <p className="text-xs text-muted-foreground/70 mt-1">系统会自动检测异常情况并在此提醒</p>
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const typeConfig = ALERT_TYPE_CONFIG[alert.alertType] || ALERT_TYPE_CONFIG.pending_review;
            const levelConfig = LEVEL_CONFIG[alert.alertLevel];
            const TypeIcon = typeConfig.icon;
            const moduleRoute = MODULE_ROUTES[alert.relatedModule] || '/';

            return (
              <div
                key={`${alert.userId}-${alert.alertType}-${idx}`}
                className="bg-card rounded-lg shadow-card hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: levelConfig.color }}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Type Icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConfig.bgColor}`}>
                        <TypeIcon className="w-4 h-4" style={{ color: typeConfig.color }} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">{alert.message}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${levelConfig.bgColor}`} style={{ color: levelConfig.color }}>
                            {levelConfig.label}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${typeConfig.bgColor}`} style={{ color: typeConfig.color }}>
                            {typeConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{alert.detail}</p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground/80">
                          {alert.department && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {alert.department}
                            </span>
                          )}
                          {alert.mentorName && (
                            <span>带教老师: {alert.mentorName}</span>
                          )}
                          {alert.stage && (
                            <span>阶段{alert.stage}</span>
                          )}
                          <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {/* Action */}
                    <a
                      href={moduleRoute}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex-shrink-0"
                    >
                      去处理
                      <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions (for manager/mentor) */}
      {currentUser?.role && currentUser.role !== 'trainee' && (
        <div className="bg-card rounded-lg p-4 shadow-card">
          <h3 className="text-sm font-medium text-foreground mb-3">快捷操作</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <a href="/practice" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <Headphones className="w-4 h-4 text-[#8b5cf6]" />
              审核演练
            </a>
            <a href="/qc-review" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <Shield className="w-4 h-4 text-[#0891b2]" />
              质检审核
            </a>
            <a href="/empowerment" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              赋能中心
            </a>
            <a href="/trainee-profiles" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <BookOpen className="w-4 h-4 text-[#2978B5]" />
              新人档案
            </a>
          </div>
        </div>
      )}

      {/* New person's quick actions */}
      {currentUser?.role === 'trainee' && (
        <div className="bg-card rounded-lg p-4 shadow-card">
          <h3 className="text-sm font-medium text-foreground mb-3">我的快捷入口</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <a href="/learning" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <BookOpen className="w-4 h-4 text-[#2978B5]" />
              继续闯关
            </a>
            <a href="/practice" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <Headphones className="w-4 h-4 text-[#8b5cf6]" />
              提交演练
            </a>
            <a href="/growth" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <Users className="w-4 h-4 text-[#22c55e]" />
              成长档案
            </a>
            <a href="/knowledge-base" className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
              <FileQuestion className="w-4 h-4 text-[#F59E0B]" />
              知识库
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
