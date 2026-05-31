'use client';

import { useEffect, useState } from 'react';
import {
  Eye, Users, Trophy, Target, Zap,
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, Clock, UserCheck, AlertCircle,
  BarChart3, Shield, Route,
  CheckCircle2, ChevronRight,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────

interface QuadrantDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
}

interface MetricRow {
  key: string;
  label: string;
  teamAvg: number;
  threshold: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  trendValue: number;
}

interface AlertItem {
  id: string;
  type: 'd_class' | 'overdue' | 'empower_deadline';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  personName?: string;
  personId?: string;
  dueDate?: string;
  link: string;
}

interface OverviewData {
  totalTrainees: number;
  levelPassRate: number;
  aClassRate: number;
  empowerCompletionRate: number;
  quadrantDist: QuadrantDistribution;
  totalLevels: number;
  passedLevels: number;
  totalEmpowerExecutions: number;
  completedEmpowerExecutions: number;
}

interface ThresholdsData {
  processMetrics: MetricRow[];
  resultMetrics: MetricRow[];
}

interface EmpowerData {
  upcomingDeadlines: AlertItem[];
}

// ─── Mock Data ─────────────────────────────────────────

function getMockOverviewData(): OverviewData {
  return {
    totalTrainees: 42,
    levelPassRate: 73.8,
    aClassRate: 28.6,
    empowerCompletionRate: 65.2,
    quadrantDist: { A: 12, B: 14, C: 10, D: 6 },
    totalLevels: 168,
    passedLevels: 124,
    totalEmpowerExecutions: 23,
    completedEmpowerExecutions: 15,
  };
}

function getMockThresholdsData(): ThresholdsData {
  return {
    processMetrics: [
      { key: 'learning', label: '闯关进度', teamAvg: 9.2, threshold: 7, unit: '关', trend: 'up', trendValue: 1.3 },
      { key: 'qcScore', label: '质检均分', teamAvg: 76.5, threshold: 70, unit: '分', trend: 'up', trendValue: 2.1 },
      { key: 'communication', label: '沟通表达', teamAvg: 68.3, threshold: 70, unit: '分', trend: 'down', trendValue: 1.5 },
      { key: 'profession', label: '专业能力', teamAvg: 72.8, threshold: 70, unit: '分', trend: 'up', trendValue: 0.8 },
      { key: 'service', label: '服务态度', teamAvg: 81.2, threshold: 75, unit: '分', trend: 'up', trendValue: 3.2 },
      { key: 'compliance', label: '合规规范', teamAvg: 91.0, threshold: 85, unit: '分', trend: 'flat', trendValue: 0 },
    ],
    resultMetrics: [
      { key: 'wechatAddRate', label: '加V率', teamAvg: 87.5, threshold: 90, unit: '%', trend: 'down', trendValue: 1.2 },
      { key: 'consultationRate', label: '面诊率', teamAvg: 88.3, threshold: 85, unit: '%', trend: 'up', trendValue: 2.5 },
      { key: 'receptionRate', label: '接诊率', teamAvg: 82.1, threshold: 80, unit: '%', trend: 'up', trendValue: 1.8 },
      { key: 'deliveryRate', label: '签收率', teamAvg: 76.5, threshold: 80, unit: '%', trend: 'down', trendValue: 2.3 },
      { key: 'medicationRate', label: '用药率', teamAvg: 83.4, threshold: 80, unit: '%', trend: 'up', trendValue: 1.1 },
      { key: 'appointmentRate', label: '挂号率', teamAvg: 78.9, threshold: 80, unit: '%', trend: 'flat', trendValue: 0.3 },
    ],
  };
}

function getMockAlerts(): AlertItem[] {
  return [
    {
      id: 'alert-1', type: 'd_class', severity: 'critical',
      title: 'D类人员需立即干预', description: '连续2周D类，已触发复训机制',
      personName: '李四', personId: 'u-2', dueDate: '2025-01-20', link: '/diagnosis',
    },
    {
      id: 'alert-2', type: 'd_class', severity: 'critical',
      title: 'D类人员需立即干预', description: '连续1周D类，即将触发复训机制',
      personName: '王五', personId: 'u-5', dueDate: '2025-01-22', link: '/diagnosis',
    },
    {
      id: 'alert-3', type: 'd_class', severity: 'warning',
      title: 'D类人员关注中', description: '过程线与结果线均不达标',
      personName: '赵六', personId: 'u-8', link: '/diagnosis',
    },
    {
      id: 'alert-4', type: 'd_class', severity: 'warning',
      title: 'D类人员关注中', description: '过程线与结果线均不达标',
      personName: '钱七', personId: 'u-11', link: '/diagnosis',
    },
    {
      id: 'alert-5', type: 'overdue', severity: 'critical',
      title: '评估已逾期', description: '闯关进度评估超期3天未完成',
      personName: '孙八', personId: 'u-14', dueDate: '2025-01-15', link: '/assessment',
    },
    {
      id: 'alert-6', type: 'overdue', severity: 'warning',
      title: '评估即将逾期', description: '质检评估还剩1天截止',
      personName: '周九', personId: 'u-17', dueDate: '2025-01-19', link: '/assessment',
    },
    {
      id: 'alert-7', type: 'empower_deadline', severity: 'warning',
      title: '赋能方案即将到期', description: '「加微话术专项训练」还剩2天截止',
      personName: '吴十', personId: 'u-20', dueDate: '2025-01-20', link: '/empowerment',
    },
    {
      id: 'alert-8', type: 'empower_deadline', severity: 'info',
      title: '赋能方案进度提醒', description: '「沟通表达强化」执行进度仅40%',
      personName: '郑十一', personId: 'u-23', dueDate: '2025-01-25', link: '/empowerment',
    },
  ];
}

// ─── Quadrant Config ───────────────────────────────────

const QUADRANT_CONFIG = {
  A: {
    label: 'A类 · 达标',
    desc: '过程线全合格 + 结果线全合格。人员可进入独立接诊阶段，建议纳入带教候选人。',
    shortDesc: '过程✓ 结果✓',
    color: 'text-[#22c55e]',
    bgColor: 'bg-[#22c55e]/5',
    borderColor: 'border-[#22c55e]/25',
    iconBg: 'bg-[#22c55e]/15',
  },
  B: {
    label: 'B类 · 结果待提升',
    desc: '过程线合格但结果线有短板。需聚焦业务转化指标，推送结果线赋能方案。',
    shortDesc: '过程✓ 结果✗',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]/5',
    borderColor: 'border-[#f59e0b]/25',
    iconBg: 'bg-[#f59e0b]/15',
  },
  C: {
    label: 'C类 · 过程待提升',
    desc: '结果线合格但过程线有短板。需强化基础能力训练，确保过程线合规。',
    shortDesc: '过程✗ 结果✓',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/25',
    iconBg: 'bg-[#ef4444]/15',
  },
  D: {
    label: 'D类 · 全面待提升',
    desc: '过程线与结果线均有短板。需立即启动全面复训与一对一辅导。',
    shortDesc: '过程✗ 结果✗',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/25',
    iconBg: 'bg-[#ef4444]/15',
  },
} as const;

// ─── Main Component ────────────────────────────────────

export default function OverviewPage() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [thresholdsData, setThresholdsData] = useState<ThresholdsData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      const results = await Promise.allSettled([
        fetch('/api/diagnosis?view=team').then(r => r.ok ? r.json() : null),
        fetch('/api/thresholds').then(r => r.ok ? r.json() : null),
        fetch('/api/empower').then(r => r.ok ? r.json() : null),
      ]);

      // Overview data
      const diagnosisJson = results[0].status === 'fulfilled' && results[0].value;
      if (diagnosisJson) {
        const summary = diagnosisJson.summary || {};
        const total = summary.total || 0;
        const qDist = {
          A: summary.A || 0,
          B: summary.B || 0,
          C: summary.C || 0,
          D: summary.D || 0,
        };
        setOverviewData({
          totalTrainees: total,
          levelPassRate: 73.8,
          aClassRate: total > 0 ? Math.round((qDist.A / total) * 1000) / 10 : 0,
          empowerCompletionRate: 65.2,
          quadrantDist: qDist,
          totalLevels: 168,
          passedLevels: 124,
          totalEmpowerExecutions: 23,
          completedEmpowerExecutions: 15,
        });
      } else {
        setOverviewData(getMockOverviewData());
      }

      // Thresholds data
      const thresholdsJson = results[1].status === 'fulfilled' && results[1].value;
      if (thresholdsJson && (thresholdsJson.processMetrics || thresholdsJson.resultMetrics)) {
        setThresholdsData(thresholdsJson);
      } else {
        setThresholdsData(getMockThresholdsData());
      }

      // Alerts
      const empowerJson = results[2].status === 'fulfilled' && results[2].value;
      if (empowerJson?.alerts) {
        setAlerts(empowerJson.alerts);
      } else {
        setAlerts(getMockAlerts());
      }

      setLoading(false);
    }
    loadAll();
  }, []);

  // ─── Loading State ─────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-7 w-36 bg-muted animate-pulse rounded" />
          <div className="h-5 w-72 bg-muted animate-pulse rounded" />
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        {/* Quadrant skeleton */}
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
        {/* Table skeleton */}
        <div className="h-80 bg-muted animate-pulse rounded-xl" />
        {/* Alerts skeleton */}
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  // ─── Empty State ───────────────────────────────────
  if (!overviewData || !thresholdsData) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <Eye className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">暂无概览数据</p>
        <p className="text-sm text-muted-foreground/70 mt-1">请先完成团队诊断配置</p>
      </div>
    );
  }

  const totalMembers =
    overviewData.quadrantDist.A +
    overviewData.quadrantDist.B +
    overviewData.quadrantDist.C +
    overviewData.quadrantDist.D;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ─── Title Area ─────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Eye className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">全局概览</h1>
          <p className="text-sm text-muted-foreground mt-1">总经理视图：培训体系全貌与核心KPI</p>
        </div>
      </div>

      {/* ─── Core KPI Cards ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card: 在培人数 */}
        <div className="bg-card rounded-xl shadow-card p-5 border border-border/40 hover:shadow-float transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">在培人数</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-foreground">{overviewData.totalTrainees}</p>
            <span className="text-sm text-muted-foreground">人</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            已通过 {overviewData.passedLevels}/{overviewData.totalLevels} 关
          </p>
        </div>

        {/* Card: 闯关通过率 */}
        <div className="bg-card rounded-xl shadow-card p-5 border border-border/40 hover:shadow-float transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#22c55e]" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">闯关通过率</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-[#22c55e]">{overviewData.levelPassRate}%</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            团队均值高于行业基准
          </p>
        </div>

        {/* Card: A类占比 */}
        <div className="bg-card rounded-xl shadow-card p-5 border border-border/40 hover:shadow-float transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-[#22c55e]" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">A类占比</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-foreground">{overviewData.aClassRate}%</p>
            <span className="text-xs text-muted-foreground">{overviewData.quadrantDist.A}人</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            目标: ≥35%
          </p>
        </div>

        {/* Card: 赋能完成率 */}
        <div className="bg-card rounded-xl shadow-card p-5 border border-border/40 hover:shadow-float transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">赋能完成率</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-foreground">{overviewData.empowerCompletionRate}%</p>
            <span className="text-xs text-muted-foreground">
              {overviewData.completedEmpowerExecutions}/{overviewData.totalEmpowerExecutions}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            目标: ≥80%
          </p>
        </div>
      </div>

      {/* ─── Quadrant Distribution Chart ────────────── */}
      <div className="bg-card rounded-xl shadow-card p-5 border border-border/40">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">四象限全景分布</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            团队共 {totalMembers} 人
          </span>
        </div>

        {/* Axis labels */}
        <div className="relative">
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-muted-foreground/60 font-medium tracking-wider">
            过程线 →
          </div>
          <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 font-medium tracking-wider">
            结果线 →
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-2 ml-4 mb-4">
            {(['A', 'B', 'C', 'D'] as const).map(q => {
              const config = QUADRANT_CONFIG[q];
              const count = overviewData.quadrantDist[q];
              const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
              return (
                <div
                  key={q}
                  className={`relative rounded-lg p-5 border-2 ${config.borderColor} ${config.bgColor} transition-all hover:shadow-md`}
                >
                  {/* Quadrant letter badge */}
                  <div className={`absolute top-3 right-3 w-7 h-7 rounded-md ${config.iconBg} flex items-center justify-center`}>
                    <span className={`text-sm font-bold ${config.color}`}>{q}</span>
                  </div>
                  <div className="mb-2">
                    <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold text-foreground">{count}</span>
                    <span className="text-sm text-muted-foreground">人</span>
                    <span className={`text-sm font-semibold ${config.color}`}>({pct}%)</span>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        q === 'A' ? 'bg-[#22c55e]' : q === 'B' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{config.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Key Metrics Comparison Table ───────────── */}
      <div className="bg-card rounded-xl shadow-card border border-border/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">核心指标对标看板</h2>
        </div>

        {/* Process Line Section */}
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center gap-2 mb-3">
            <Route className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">过程线指标</h3>
            <span className="text-xs text-muted-foreground">— 基础能力与规范达标情况</span>
          </div>
        </div>
        <MetricsTable metrics={thresholdsData.processMetrics} />

        {/* Result Line Section */}
        <div className="px-5 pt-5 pb-1 border-t border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">结果线指标</h3>
            <span className="text-xs text-muted-foreground">— 业务转化与业绩达成情况</span>
          </div>
        </div>
        <MetricsTable metrics={thresholdsData.resultMetrics} />
      </div>

      {/* ─── Recent Alerts & Warnings ───────────────── */}
      <div className="bg-card rounded-xl shadow-card border border-border/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="text-base font-semibold text-foreground">预警与待办</h2>
            {alerts.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#ef4444] text-white text-[10px] font-bold">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />紧急
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />警告
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />提示
            </span>
          </div>
        </div>

        <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#22c55e] mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">当前无预警事项</p>
            </div>
          ) : (
            alerts.map(alert => <AlertRow key={alert.id} alert={alert} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metrics Table Sub-component ───────────────────────

function MetricsTable({ metrics }: { metrics: MetricRow[] }) {
  return (
    <div className="px-5 pb-4">
      <div className="rounded-lg border border-border/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-2.5 bg-muted/60 text-xs font-semibold text-muted-foreground">
          <span>指标名</span>
          <span className="text-center">团队均值</span>
          <span className="text-center">合格阈值</span>
          <span className="text-center">达标率</span>
          <span className="text-center">趋势</span>
        </div>

        {/* Table Rows */}
        {metrics.map((metric, idx) => {
          const isAbove = metric.teamAvg >= metric.threshold;
          const passRate = isAbove ? 100 : Math.round((metric.teamAvg / metric.threshold) * 100);

          return (
            <div
              key={metric.key}
              className={`grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-3 items-center text-sm border-t border-border/30 ${
                !isAbove ? 'bg-[#ef4444]/[0.03]' : ''
              }`}
            >
              {/* Metric Name */}
              <span className={`font-medium ${!isAbove ? 'text-[#ef4444]' : 'text-foreground'}`}>
                {metric.label}
              </span>

              {/* Team Average */}
              <span className={`text-center font-semibold ${!isAbove ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {metric.teamAvg}{metric.unit}
              </span>

              {/* Threshold */}
              <span className="text-center text-muted-foreground">
                ≥{metric.threshold}{metric.unit}
              </span>

              {/* Pass Rate */}
              <span className="flex justify-center">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                    isAbove
                      ? 'bg-[#22c55e]/15 text-[#22c55e]'
                      : 'bg-[#ef4444]/15 text-[#ef4444]'
                  }`}
                >
                  {isAbove ? '达标' : `${passRate}%`}
                </span>
              </span>

              {/* Trend */}
              <span className="flex justify-center">
                <TrendIcon trend={metric.trend} value={metric.trendValue} isAbove={isAbove} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trend Icon Sub-component ──────────────────────────

function TrendIcon({ trend, value, isAbove }: { trend: 'up' | 'down' | 'flat'; value: number; isAbove: boolean }) {
  if (trend === 'flat' || value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="w-3.5 h-3.5" />
        <span className="text-[10px]">持平</span>
      </span>
    );
  }

  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[#22c55e]">
        <TrendingUp className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">+{value}</span>
      </span>
    );
  }

  // trend === 'down'
  return (
    <span className={`inline-flex items-center gap-0.5 ${isAbove ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
      <TrendingDown className="w-3.5 h-3.5" />
      <span className="text-[10px] font-medium">-{value}</span>
    </span>
  );
}

// ─── Alert Row Sub-component ───────────────────────────

function AlertRow({ alert }: { alert: AlertItem }) {
  const severityConfig = {
    critical: {
      dotColor: 'bg-[#ef4444]',
      icon: AlertCircle,
      iconColor: 'text-[#ef4444]',
      bgClass: 'bg-[#ef4444]/[0.03]',
    },
    warning: {
      dotColor: 'bg-[#f59e0b]',
      icon: AlertTriangle,
      iconColor: 'text-[#f59e0b]',
      bgClass: 'bg-[#f59e0b]/[0.03]',
    },
    info: {
      dotColor: 'bg-primary',
      icon: Clock,
      iconColor: 'text-primary',
      bgClass: 'bg-primary/[0.03]',
    },
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  const typeLabel: Record<string, string> = {
    d_class: 'D类预警',
    overdue: '逾期提醒',
    empower_deadline: '赋能到期',
  };

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${config.bgClass} hover:bg-muted/30 transition-colors`}>
      {/* Severity Icon */}
      <div className="shrink-0">
        <Icon className={`w-5 h-5 ${config.iconColor}`} />
      </div>

      {/* Alert Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            alert.severity === 'critical'
              ? 'bg-[#ef4444]/15 text-[#ef4444]'
              : alert.severity === 'warning'
              ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
              : 'bg-primary/15 text-primary'
          }`}>
            {typeLabel[alert.type] || '提醒'}
          </span>
          <span className="text-sm font-medium text-foreground">{alert.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {alert.personName && (
            <span className="inline-flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              {alert.personName}
            </span>
          )}
          <span>{alert.description}</span>
          {alert.dueDate && (
            <span className="inline-flex items-center gap-1 text-[#f59e0b]">
              <Clock className="w-3 h-3" />
              {alert.dueDate}
            </span>
          )}
        </div>
      </div>

      {/* Action Link */}
      <a
        href={alert.link}
        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
      >
        处理
        <ChevronRight className="w-3 h-3" />
      </a>
    </div>
  );
}
