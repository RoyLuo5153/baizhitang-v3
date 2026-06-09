'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, TrendingDown, TrendingUp, BookOpen, MessageSquare, ChevronRight, Check, CheckCheck, Filter, ClipboardList } from 'lucide-react';

interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  priority: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; label: string; color: string; bg: string }> = {
  overdue: { icon: AlertTriangle, label: '逾期提醒', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10' },
  dropout: { icon: TrendingDown, label: '掉队预警', color: 'text-destructive', bg: 'bg-destructive/10' },
  empower: { icon: BookOpen, label: '赋能通知', color: 'text-primary', bg: 'bg-primary/10' },
  assessment: { icon: ClipboardList, label: '考核提醒', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  qc: { icon: MessageSquare, label: '质检通知', color: 'text-primary', bg: 'bg-primary/10' },
  stage: { icon: TrendingUp, label: '阶段通知', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
  trainee: { icon: AlertTriangle, label: '学员预警', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  system: { icon: Bell, label: '系统通知', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?userId=1');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    }
    setLoading(false);
  };

  const markAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    }).catch(() => {});
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
  };

  const filtered = notifications
    .filter(n => {
      if (filter === 'unread') return !n.is_read;
      if (filter === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
      return true;
    })
    .filter(n => typeFilter === 'all' || n.type === typeFilter)
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 2;
      const pb = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const urgentCount = notifications.filter(n => n.priority === 'urgent' || n.priority === 'high').length;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return d.toLocaleDateString('zh-CN');
  };

  const getRelatedLink = (n: Notification) => {
    switch (n.related_type) {
      case 'level': return '/learning';
      case 'empower_execution': return '/empowerment';
      case 'diagnosis': return '/diagnosis';
      case 'assessment': return '/assessment';
      case 'qc_record': return '/qc-review';
      case 'stage': return '/settings';
      case 'trainee': return '/trainee-board';
      case 'course': return '/courses';
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-card rounded-lg p-5 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">通知中心</h1>
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs font-medium px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <CheckCheck className="w-3.5 h-3.5" />
              全部已读
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{notifications.length}</div>
            <div className="text-xs text-muted-foreground">全部通知</div>
          </div>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
            <Check className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{unreadCount}</div>
            <div className="text-xs text-muted-foreground">未读</div>
          </div>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{urgentCount}</div>
            <div className="text-xs text-muted-foreground">紧急/高优</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-muted rounded-lg p-1">
          {(['all', 'unread', 'urgent'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? '全部' : f === 'unread' ? '未读' : '紧急'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs bg-muted border-0 rounded-md px-2 py-1.5 text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="all">所有类型</option>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-lg p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">暂无通知</p>
          </div>
        ) : (
          filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
            const Icon = cfg.icon;
            const link = getRelatedLink(n);
            return (
              <div
                key={n.id}
                className={`bg-card rounded-lg p-4 flex items-start gap-4 transition hover:shadow-card ${
                  !n.is_read ? 'border-l-2 border-primary' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {(n.priority === 'urgent' || n.priority === 'high') && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        {n.priority === 'urgent' ? '紧急' : '高优'}
                      </span>
                    )}
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <h3 className={`text-sm font-medium mb-0.5 ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {n.title}
                  </h3>
                  {n.message && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Check className="w-3 h-3" />
                        标记已读
                      </button>
                    )}
                    {link && (
                      <a href={link} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        查看详情 <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


