'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen, BarChart3, Target, TrendingUp, Users, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  user: { id: string; name: string; role: string; stage: number };
  learning: { passed: number; total: number; progress: number };
  quadrant: string;
  processQualified: boolean;
  resultQualified: boolean;
  processLine: any[];
  resultLine: any[];
  empowerHistory: any[];
}

const quadrantConfig: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: 'A类·全达标', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
  B: { label: 'B类·结果待提升', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  C: { label: 'C类·过程待提升', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10' },
  D: { label: 'D类·全面待提升', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10' },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/growth?userId=1')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const quadConfig = quadrantConfig[data?.quadrant || 'D'];
  const unqualifiedProcess = (data?.processLine || []).filter((i: any) => i.status === 'unqualified');
  const unqualifiedResult = (data?.resultLine || []).filter((i: any) => i.status === 'unqualified');
  const totalUnqualified = unqualifiedProcess.length + unqualifiedResult.length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            工作台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            欢迎回来，{data?.user?.name || '用户'}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-md ${quadConfig.bg}`}>
          <span className={`text-sm font-medium ${quadConfig.color}`}>
            {quadConfig.label}
          </span>
        </div>
      </div>

      {/* 4个核心指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="闯关进度"
          value={`${data?.learning?.passed || 0}/${data?.learning?.total || 21}`}
          suffix="关"
          progress={data?.learning?.progress || 0}
          color="#2978B5"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="过程线达标"
          value={`${(data?.processLine || []).length - unqualifiedProcess.length}/${(data?.processLine || []).length}`}
          suffix="项"
          progress={data?.processLine?.length ? Math.round(((data.processLine.length - unqualifiedProcess.length) / data.processLine.length) * 100) : 0}
          color="#22c55e"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="结果线达标"
          value={`${(data?.resultLine || []).length - unqualifiedResult.length}/${(data?.resultLine || []).length}`}
          suffix="项"
          progress={data?.resultLine?.length ? Math.round(((data.resultLine.length - unqualifiedResult.length) / data.resultLine.length) * 100) : 0}
          color="#f59e0b"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="待改善项"
          value={`${totalUnqualified}`}
          suffix="项"
          progress={0}
          color={totalUnqualified > 0 ? '#ef4444' : '#22c55e'}
          alert={totalUnqualified > 0}
        />
      </div>

      {/* 双轨对标一览 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 过程线 */}
        <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#2978B5] rounded-full" />
              <h3 className="text-base font-semibold text-foreground">过程线对标</h3>
            </div>
            <Link href="/growth" className="text-xs text-[#2978B5] flex items-center gap-1 hover:underline">
              查看详情 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.processLine || []).map((item: any) => (
              <div
                key={item.key}
                className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                  item.status === 'unqualified' ? 'bg-destructive/5' : 'bg-muted/30'
                }`}
              >
                <span className={item.status === 'unqualified' ? 'text-destructive font-medium' : 'text-foreground'}>
                  {item.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {item.value}{item.unit}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    item.status === 'qualified'
                      ? 'bg-[#22c55e]/15 text-[#22c55e]'
                      : 'bg-destructive/15 text-destructive'
                  }`}>
                    {item.status === 'qualified' ? '达标' : '不达标'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 结果线 */}
        <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#f59e0b] rounded-full" />
              <h3 className="text-base font-semibold text-foreground">结果线对标</h3>
            </div>
            <Link href="/growth" className="text-xs text-[#2978B5] flex items-center gap-1 hover:underline">
              查看详情 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.resultLine || []).map((item: any) => (
              <div
                key={item.key}
                className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                  item.status === 'unqualified' ? 'bg-destructive/5' : 'bg-muted/30'
                }`}
              >
                <span className={item.status === 'unqualified' ? 'text-destructive font-medium' : 'text-foreground'}>
                  {item.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {item.value !== null ? `${item.value}${item.unit}` : '--'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    item.status === 'qualified'
                      ? 'bg-[#22c55e]/15 text-[#22c55e]'
                      : 'bg-destructive/15 text-destructive'
                  }`}>
                    {item.status === 'qualified' ? '达标' : '不达标'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink
          href="/learning"
          icon={<BookOpen className="w-5 h-5" />}
          title="闯关学习"
          desc="继续学习关卡"
          color="#2978B5"
        />
        <QuickLink
          href="/diagnosis"
          icon={<BarChart3 className="w-5 h-5" />}
          title="双轨诊断"
          desc="查看四象限分析"
          color="#102A43"
        />
        <QuickLink
          href="/empowerment"
          icon={<TrendingUp className="w-5 h-5" />}
          title="赋能中心"
          desc="查看推荐方案"
          color="#f59e0b"
        />
        <QuickLink
          href="/overview"
          icon={<Users className="w-5 h-5" />}
          title="全局看板"
          desc="团队数据概览"
          color="#22c55e"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, suffix, progress, color, alert }: {
  icon: React.ReactNode; label: string; value: string; suffix: string;
  progress: number; color: string; alert?: boolean;
}) {
  return (
    <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      {progress > 0 && (
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
          />
        </div>
      )}
      {alert && (
        <p className="mt-2 text-xs text-destructive">需要关注</p>
      )}
    </div>
  );
}

function QuickLink({ href, icon, title, desc, color }: {
  href: string; icon: React.ReactNode; title: string; desc: string; color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex items-center gap-4 hover:shadow-md transition-shadow group"
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}
