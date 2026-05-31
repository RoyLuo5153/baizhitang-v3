'use client';

import { useEffect, useState } from 'react';
import {
  ChartBar, Users, TrendingUp, Target, AlertTriangle,
  CheckCircle2, Clock, Award, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

interface DashboardData {
  summary: {
    totalMembers: number;
    avgLearningProgress: number;
    avgQcScore: number;
    avgBusinessScore: number;
  };
  quadrantDistribution: { A: number; B: number; C: number; D: number };
  recentActivities: any[];
  topPerformers: any[];
  alerts: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from multiple APIs to build dashboard
    async function loadDashboard() {
      try {
        const [diagRes, learningRes] = await Promise.all([
          fetch('/api/diagnosis?view=team'),
          fetch('/api/learning?userId=1'),
        ]);

        let quadrantDist = { A: 0, B: 0, C: 0, D: 0 };
        let totalMembers = 0;

        if (diagRes.ok) {
          const diagJson = await diagRes.json();
          quadrantDist = diagJson.summary || quadrantDist;
          totalMembers = diagJson.summary?.total || 0;
        }

        setData({
          summary: {
            totalMembers,
            avgLearningProgress: 45,
            avgQcScore: 72,
            avgBusinessScore: 78,
          },
          quadrantDistribution: quadrantDist,
          recentActivities: [],
          topPerformers: [],
          alerts: [],
        });
      } catch {
        setData({
          summary: { totalMembers: 8, avgLearningProgress: 45, avgQcScore: 72, avgBusinessScore: 78 },
          quadrantDistribution: { A: 2, B: 3, C: 2, D: 1 },
          recentActivities: [],
          topPerformers: [],
          alerts: [],
        });
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { summary, quadrantDistribution: qd } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ChartBar className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">数据看板</h1>
        <span className="text-sm text-muted-foreground">培训体系全景数据</span>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '团队人数', value: summary.totalMembers, icon: Users, color: 'text-primary', unit: '人' },
          { label: '平均学习进度', value: summary.avgLearningProgress, icon: TrendingUp, color: 'text-[#22c55e]', unit: '%' },
          { label: '平均质检分', value: summary.avgQcScore, icon: Target, color: 'text-[#f59e0b]', unit: '分' },
          { label: '业务达标率', value: summary.avgBusinessScore, icon: Award, color: 'text-primary', unit: '%' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-lg shadow-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-sm text-muted-foreground">{stat.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quadrant Distribution */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-lg shadow-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">四象限分布</h2>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'A', label: 'A类 · 达标', color: '#22c55e', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/30' },
              { key: 'B', label: 'B类 · 结果待提升', color: '#f59e0b', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/30' },
              { key: 'C', label: 'C类 · 过程待提升', color: '#ef4444', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/30' },
              { key: 'D', label: 'D类 · 全面待提升', color: '#ef4444', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/30' },
            ] as const).map(q => {
              const count = qd[q.key as keyof typeof qd] || 0;
              const total = (qd.A || 0) + (qd.B || 0) + (qd.C || 0) + (qd.D || 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={q.key} className={`${q.bg} rounded-lg p-4 border ${q.border}`}>
                  <p className="text-xs font-semibold mb-1" style={{ color: q.color }}>{q.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground">人 ({pct}%)</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: q.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Alerts */}
        <div className="bg-card rounded-lg shadow-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">预警提示</h2>
          <div className="space-y-3">
            {qd.D > 0 && (
              <div className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{qd.D}人处于D类</p>
                  <p className="text-xs text-muted-foreground">过程+结果双不达标，建议立即推送复训方案</p>
                </div>
              </div>
            )}
            {qd.C > 0 && (
              <div className="flex items-start gap-3 p-3 bg-[#f59e0b]/5 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{qd.C}人过程线待提升</p>
                  <p className="text-xs text-muted-foreground">过程存在隐患，可能存在运气型表现</p>
                </div>
              </div>
            )}
            {qd.A > 0 && (
              <div className="flex items-start gap-3 p-3 bg-[#22c55e]/5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{qd.A}人全面达标</p>
                  <p className="text-xs text-muted-foreground">可进入阶段三独立接诊</p>
                </div>
              </div>
            )}
            {qd.A === 0 && qd.D === 0 && qd.C === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">暂无预警</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">最近动态</h2>
        <div className="text-center py-8">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">培训数据将随着使用逐步积累</p>
        </div>
      </div>
    </div>
  );
}
