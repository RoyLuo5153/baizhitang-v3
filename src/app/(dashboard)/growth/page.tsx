'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  UserCircle, Award, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Clock, Zap, BookOpen, BarChart3,
  Activity, ChevronRight, ArrowRight, Target, FileText,
  Lightbulb, Calendar, Users, Hexagon, Crosshair
} from 'lucide-react';
import Link from 'next/link';

// === Types ===
interface ProcessMetric {
  key: string;
  label: string;
  value: number | null;
  threshold: number;
  unit: string;
  qualified: boolean;
  diagnosis?: string;
}

interface ResultMetric {
  key: string;
  label: string;
  value: number | null;
  threshold: number;
  unit: string;
  qualified: boolean;
  diagnosis?: string;
}

interface EmpowerPlan {
  id: number;
  title: string;
  description: string;
  targetMetrics: string[];
  duration: string;
  priority: 'high' | 'medium' | 'low';
}

interface TimelineEntry {
  week: string;
  label: string;
  quadrant: 'A' | 'B' | 'C' | 'D';
  processScore: number;
  resultScore: number;
}

interface GrowthData {
  user: {
    id: number;
    real_name: string;
    primary_role: string;
    join_date: string;
  };
  quadrant: 'A' | 'B' | 'C' | 'D';
  currentStage: number;
  stageName: string;
  processMetrics: ProcessMetric[];
  resultMetrics: ResultMetric[];
  empowerPlans: EmpowerPlan[];
  timeline: TimelineEntry[];
}

// === Quadrant config ===
const QUADRANT_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; description: string; suggestion: string }> = {
  A: { label: 'A类', color: 'text-[#22c55e]', bgColor: 'bg-[#22c55e]/10', borderColor: 'border-[#22c55e]/30', description: '过程达标·结果达标', suggestion: '保持当前状态，追求卓越突破' },
  B: { label: 'B类', color: 'text-[hsl(var(--primary))]', bgColor: 'bg-primary/10', borderColor: 'border-primary/30', description: '过程达标·结果不达标', suggestion: '过程扎实但结果未达预期，需优化转化机制与执行策略' },
  C: { label: 'C类', color: 'text-[#f59e0b]', bgColor: 'bg-[#f59e0b]/10', borderColor: 'border-[#f59e0b]/30', description: '过程不达标·结果达标', suggestion: '结果虽达标但过程不可控，需夯实基础能力避免业绩波动' },
  D: { label: 'D类', color: 'text-[hsl(var(--destructive))]', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30', description: '过程不达标·结果不达标', suggestion: '过程与结果均需提升，建议从基础能力入手逐步改善' },
};

const STAGE_LABELS: Record<number, string> = {
  1: '阶段一 · 理论基础',
  2: '阶段二 · 实战演练',
  3: '阶段三 · 综合达标',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  high: { label: '高优', color: 'text-[#ef4444]', bgColor: 'bg-[#ef4444]/10' },
  medium: { label: '中优', color: 'text-[#f59e0b]', bgColor: 'bg-[#f59e0b]/10' },
  low: { label: '一般', color: 'text-[#22c55e]', bgColor: 'bg-[#22c55e]/10' },
};

export default function GrowthProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<GrowthData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchGrowthData = useCallback(async () => {
    if (!user) return;
    try {
      setDataLoading(true);
      setError(null);
      const res = await fetch(`/api/growth?userId=${user.id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch growth data');
      }
      const raw = await res.json();

      // Transform API response into our structured GrowthData
      const transformed = transformApiResponse(raw, user);
      setData(transformed);
    } catch (err) {
      console.error('Failed to fetch growth data:', err);
      setError('加载成长档案失败，请稍后重试');
      setData(null);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  if (authLoading || !user) return null;

  // Loading skeleton
  if (dataLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-28 bg-muted rounded-lg" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-72 bg-muted rounded-lg" />
          <div className="h-72 bg-muted rounded-lg" />
        </div>
        <div className="h-48 bg-muted rounded-lg" />
        <div className="h-40 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-24">
        <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground text-sm">暂无成长档案数据</p>
      </div>
    );
  }

  const quadrantInfo = QUADRANT_CONFIG[data.quadrant];
  const unqualifiedProcess = data.processMetrics.filter(m => !m.qualified);
  const unqualifiedResult = data.resultMetrics.filter(m => !m.qualified);
  const processQualifiedCount = data.processMetrics.filter(m => m.qualified).length;
  const resultQualifiedCount = data.resultMetrics.filter(m => m.qualified).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0" />
          <span className="text-[#f59e0b]">{error}</span>
        </div>
      )}

      {/* === Top: Personal Info Card === */}
      <div className="bg-card rounded-lg shadow-card p-5 border border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold shrink-0">
              {data.user.real_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-foreground">{data.user.real_name}</h1>
                {/* Stage badge */}
                <span className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5 rounded-sm">
                  {STAGE_LABELS[data.currentStage] || `阶段${data.currentStage}`}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5" />
                  {data.user.primary_role === 'trainee' ? '新人' : data.user.primary_role}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  入职 {data.user.join_date}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  已通过 {data.processMetrics.find(m => m.key === 'learning_passed')?.value ?? '-'} 关
                </span>
              </div>
            </div>
          </div>

          {/* Quadrant indicator */}
          <div id="quadrant-badge" className={`flex flex-col items-center px-5 py-3 rounded-lg border ${quadrantInfo.bgColor} ${quadrantInfo.borderColor}`}>
            <span className={`text-2xl font-bold ${quadrantInfo.color}`}>{data.quadrant}</span>
            <span className={`text-xs font-medium ${quadrantInfo.color} mt-0.5`}>{quadrantInfo.description}</span>
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/20">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">过程线达标</p>
            <p className="text-lg font-bold text-foreground mt-1">
              <span className={processQualifiedCount === data.processMetrics.length ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>
                {processQualifiedCount}
              </span>
              <span className="text-sm font-normal text-muted-foreground">/{data.processMetrics.length}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">结果线达标</p>
            <p className="text-lg font-bold text-foreground mt-1">
              <span className={resultQualifiedCount === data.resultMetrics.length ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>
                {resultQualifiedCount}
              </span>
              <span className="text-sm font-normal text-muted-foreground">/{data.resultMetrics.length}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">不达标项</p>
            <p className="text-lg font-bold text-foreground mt-1">
              <span className={unqualifiedProcess.length + unqualifiedResult.length > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}>
                {unqualifiedProcess.length + unqualifiedResult.length}
              </span>
              <span className="text-sm font-normal text-muted-foreground"> 项</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">当前象限</p>
            <p className={`text-lg font-bold mt-1 ${quadrantInfo.color}`}>{quadrantInfo.label}</p>
          </div>
        </div>
      </div>

      {/* === Quadrant Position Chart === */}
      <div id="quadrant-chart" className="bg-card rounded-lg shadow-card p-5 border border-border/30">
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">四象限定位图</h2>
        </div>

        {/* 2x2 grid */}
        <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
          {/* A类 - Top Left (达标) */}
          <div className={`relative rounded-lg border-2 p-4 min-h-[120px] flex flex-col items-center justify-center transition-all ${
            data.quadrant === 'A'
              ? 'border-[#22c55e] bg-[#22c55e]/8 shadow-[0_0_16px_rgba(34,197,94,0.15)]'
              : 'border-border/30 bg-muted/30'
          }`}>
            <span className={`text-xl font-bold ${data.quadrant === 'A' ? 'text-[#22c55e]' : 'text-muted-foreground/50'}`}>A类</span>
            <span className={`text-xs mt-1 ${data.quadrant === 'A' ? 'text-[#22c55e]/80' : 'text-muted-foreground/40'}`}>过程达标·结果达标</span>
            {data.quadrant === 'A' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22c55e]" />
                </span>
                <span className="text-xs font-semibold text-[#22c55e]">{data.user.real_name}</span>
              </div>
            )}
          </div>

          {/* B类 - Top Right (机制问题) */}
          <div className={`relative rounded-lg border-2 p-4 min-h-[120px] flex flex-col items-center justify-center transition-all ${
            data.quadrant === 'B'
              ? 'border-primary bg-primary/8 shadow-[0_0_16px_hsla(var(--primary),0.15)]'
              : 'border-border/30 bg-muted/30'
          }`}>
            <span className={`text-xl font-bold ${data.quadrant === 'B' ? 'text-[hsl(var(--primary))]' : 'text-muted-foreground/50'}`}>B类</span>
            <span className={`text-xs mt-1 ${data.quadrant === 'B' ? 'text-primary/80' : 'text-muted-foreground/40'}`}>过程达标·结果不达标</span>
            {data.quadrant === 'B' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                </span>
                <span className="text-xs font-semibold text-[hsl(var(--primary))]">{data.user.real_name}</span>
              </div>
            )}
          </div>

          {/* C类 - Bottom Left (运气型) */}
          <div className={`relative rounded-lg border-2 p-4 min-h-[120px] flex flex-col items-center justify-center transition-all ${
            data.quadrant === 'C'
              ? 'border-[#f59e0b] bg-[#f59e0b]/8 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
              : 'border-border/30 bg-muted/30'
          }`}>
            <span className={`text-xl font-bold ${data.quadrant === 'C' ? 'text-[#f59e0b]' : 'text-muted-foreground/50'}`}>C类</span>
            <span className={`text-xs mt-1 ${data.quadrant === 'C' ? 'text-[#f59e0b]/80' : 'text-muted-foreground/40'}`}>过程不达标·结果达标</span>
            {data.quadrant === 'C' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f59e0b]" />
                </span>
                <span className="text-xs font-semibold text-[#f59e0b]">{data.user.real_name}</span>
              </div>
            )}
          </div>

          {/* D类 - Bottom Right (能力不足) */}
          <div className={`relative rounded-lg border-2 p-4 min-h-[120px] flex flex-col items-center justify-center transition-all ${
            data.quadrant === 'D'
              ? 'border-destructive bg-destructive/8 shadow-[0_0_16px_hsla(var(--destructive),0.15)]'
              : 'border-border/30 bg-muted/30'
          }`}>
            <span className={`text-xl font-bold ${data.quadrant === 'D' ? 'text-[hsl(var(--destructive))]' : 'text-muted-foreground/50'}`}>D类</span>
            <span className={`text-xs mt-1 ${data.quadrant === 'D' ? 'text-destructive/80' : 'text-muted-foreground/40'}`}>过程不达标·结果不达标</span>
            {data.quadrant === 'D' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                </span>
                <span className="text-xs font-semibold text-[hsl(var(--destructive))]">{data.user.real_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Axis labels */}
        <div className="max-w-xl mx-auto flex justify-between mt-2 px-1">
          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">← 过程不达标</span>
          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">过程达标 →</span>
        </div>
        <div className="max-w-xl mx-auto flex flex-col items-center mt-0.5">
          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">↑ 结果达标</span>
          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">↓ 结果不达标</span>
        </div>

        {/* Current position summary */}
        <div className={`mt-4 rounded-lg border px-4 py-3 flex items-center gap-3 ${quadrantInfo.bgColor} ${quadrantInfo.borderColor}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${quadrantInfo.bgColor} ${quadrantInfo.color}`}>
            {data.quadrant}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              当前位于：<span className={quadrantInfo.color}>{quadrantInfo.label} - {quadrantInfo.description}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{quadrantInfo.suggestion}</p>
          </div>
        </div>
      </div>

      {/* === Dual-track Radar Chart === */}
      <div id="dual-track-radar" className="bg-card rounded-lg shadow-card p-5 border border-border/30">
        <div className="flex items-center gap-2 mb-4">
          <Hexagon className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">双轨雷达图</h2>
          <span className="text-xs text-muted-foreground">过程线 + 结果线维度对标</span>
        </div>

        <div className="flex items-start gap-6">
          {/* SVG Radar Chart */}
          <div className="flex-1 flex justify-center">
            <svg
              viewBox="-10 -10 320 290"
              className="w-full max-w-md"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {/* Grid rings at 25%, 50%, 75%, 100% */}
              {[0.25, 0.5, 0.75, 1].map(scale => {
                const points = computeRadarPoints(11, scale);
                return (
                  <polygon
                    key={`ring-${scale}`}
                    points={points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="hsl(240 5.9% 90%)"
                    strokeWidth="0.6"
                    opacity={scale === 1 ? 0.5 : 0.25}
                  />
                );
              })}

              {/* Axis lines from center to each vertex */}
              {computeRadarPoints(11, 1).map((p, i) => (
                <line
                  key={`axis-${i}`}
                  x1="150"
                  y1="135"
                  x2={p.x}
                  y2={p.y}
                  stroke="hsl(240 5.9% 90%)"
                  strokeWidth="0.5"
                  opacity="0.35"
                />
              ))}

              {/* Result line polygon (drawn first, behind process) */}
              <polygon
                points={computeDataRadarPoints(data.resultMetrics, data.processMetrics, 11).map(p => `${p.x},${p.y}`).join(' ')}
                fill="rgba(245,158,11,0.12)"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* Process line polygon */}
              <polygon
                points={computeDataRadarPoints(data.processMetrics, data.resultMetrics, 11).map(p => `${p.x},${p.y}`).join(' ')}
                fill="hsl(222.2 47.4% 50%)"
                stroke="hsl(222.2 47.4% 50%)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* Data points - Process line */}
              {computeDataRadarPoints(data.processMetrics, data.resultMetrics, 11).map((p, i) => (
                <circle
                  key={`process-dot-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill="hsl(222.2 47.4% 50%)"
                  stroke="white"
                  strokeWidth="1"
                />
              ))}

              {/* Data points - Result line */}
              {computeDataRadarPoints(data.resultMetrics, data.processMetrics, 11).map((p, i) => (
                <circle
                  key={`result-dot-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill="#f59e0b"
                  stroke="white"
                  strokeWidth="1"
                />
              ))}

              {/* Axis labels */}
              {computeRadarPoints(11, 1).map((p, i) => {
                const label = i < data.processMetrics.length
                  ? data.processMetrics[i].label
                  : data.resultMetrics[i - data.processMetrics.length].label;
                const anchor = p.x > 155 ? 'start' : p.x < 145 ? 'end' : 'middle';
                const dy = p.y < 130 ? -6 : p.y > 140 ? 14 : 4;
                const dx = p.x > 155 ? 8 : p.x < 145 ? -8 : 0;
                return (
                  <text
                    key={`label-${i}`}
                    x={p.x + dx}
                    y={p.y + dy}
                    textAnchor={anchor}
                    fill="hsl(240 3.8% 46.1%)"
                    fontSize="8.5"
                    fontWeight="500"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Legend and metric details */}
          <div className="w-52 shrink-0 space-y-3">
            {/* Legend */}
            <div className="space-y-2 pb-3 border-b border-border/20">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 rounded bg-primary inline-block" />
                <span className="text-xs font-medium text-foreground">过程线</span>
                <span className="text-[10px] text-muted-foreground">{processQualifiedCount}/{data.processMetrics.length} 达标</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 rounded bg-[#f59e0b] inline-block" />
                <span className="text-xs font-medium text-foreground">结果线</span>
                <span className="text-[10px] text-muted-foreground">{resultQualifiedCount}/{data.resultMetrics.length} 达标</span>
              </div>
            </div>

            {/* Process metrics detail */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">过程维度</p>
              <div className="space-y-1">
                {data.processMetrics.map(m => (
                  <div key={m.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{m.label}</span>
                    <span className={`font-medium ${m.qualified ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {m.value !== null ? `${m.value}${m.unit}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Result metrics detail */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">结果维度</p>
              <div className="space-y-1">
                {data.resultMetrics.map(m => (
                  <div key={m.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{m.label}</span>
                    <span className={`font-medium ${m.qualified ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {m.value !== null ? `${m.value}${m.unit}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === Middle: Process & Result Line Tables === */}
      <div className="grid grid-cols-2 gap-6">
        {/* Process Line Table */}
        <div id="process-line-table" className="bg-card rounded-lg shadow-card p-5 border border-border/30">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">过程线对标</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${
              unqualifiedProcess.length === 0
                ? 'bg-[#22c55e]/15 text-[#22c55e]'
                : 'bg-[#f59e0b]/15 text-[#f59e0b]'
            }`}>
              {unqualifiedProcess.length === 0 ? '全部达标' : `${unqualifiedProcess.length}项不达标`}
            </span>
          </div>
          <div className="overflow-hidden rounded-md border border-border/20">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-28">指标</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2.5 w-20">当前值</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2.5 w-20">合格线</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2.5 w-16">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {/* 列表-过程线指标1: 闯关通过数 */}
                <tr className={data.processMetrics[0]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.processMetrics[0]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.processMetrics[0]?.value}{data.processMetrics[0]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.processMetrics[0]?.threshold}{data.processMetrics[0]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.processMetrics[0]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.processMetrics[0]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-过程线指标2: 录音质检分数 */}
                <tr className={data.processMetrics[1]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.processMetrics[1]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.processMetrics[1]?.value}{data.processMetrics[1]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.processMetrics[1]?.threshold}{data.processMetrics[1]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.processMetrics[1]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.processMetrics[1]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-过程线指标3: 加微服务用语得分 */}
                <tr className={data.processMetrics[2]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.processMetrics[2]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.processMetrics[2]?.value}{data.processMetrics[2]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.processMetrics[2]?.threshold}{data.processMetrics[2]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.processMetrics[2]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.processMetrics[2]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-过程线指标4: 日常考核均分 */}
                <tr className={data.processMetrics[3]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.processMetrics[3]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.processMetrics[3]?.value}{data.processMetrics[3]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.processMetrics[3]?.threshold}{data.processMetrics[3]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.processMetrics[3]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.processMetrics[3]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-过程线指标5: 出勤率 */}
                <tr className={data.processMetrics[4]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.processMetrics[4]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.processMetrics[4]?.value}{data.processMetrics[4]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.processMetrics[4]?.threshold}{data.processMetrics[4]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.processMetrics[4]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.processMetrics[4]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Process diagnosis notes for unqualified items */}
          {unqualifiedProcess.length > 0 && (
            <div className="mt-3 bg-destructive/5 border-t border-destructive/15 rounded-md p-3 space-y-2">
              {unqualifiedProcess.map(m => (
                <div key={m.key} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-[#ef4444]">{m.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({m.value}{m.unit} &lt; {m.threshold}{m.unit})
                    </span>
                    {m.diagnosis && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.diagnosis}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result Line Table */}
        <div id="result-line-table" className="bg-card rounded-lg shadow-card p-5 border border-border/30">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">结果线对标</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${
              unqualifiedResult.length === 0
                ? 'bg-[#22c55e]/15 text-[#22c55e]'
                : 'bg-[#f59e0b]/15 text-[#f59e0b]'
            }`}>
              {unqualifiedResult.length === 0 ? '全部达标' : `${unqualifiedResult.length}项不达标`}
            </span>
          </div>
          <div className="overflow-hidden rounded-md border border-border/20">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-28">指标</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2.5 w-20">当前值</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2.5 w-20">合格线</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2.5 w-16">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {/* 列表-结果线指标1: 加V率 */}
                <tr className={data.resultMetrics[0]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.resultMetrics[0]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.resultMetrics[0]?.value}{data.resultMetrics[0]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.resultMetrics[0]?.threshold}{data.resultMetrics[0]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.resultMetrics[0]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.resultMetrics[0]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-结果线指标2: 咨询转化率 */}
                <tr className={data.resultMetrics[1]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.resultMetrics[1]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.resultMetrics[1]?.value}{data.resultMetrics[1]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.resultMetrics[1]?.threshold}{data.resultMetrics[1]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.resultMetrics[1]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.resultMetrics[1]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-结果线指标3: 接待完成率 */}
                <tr className={data.resultMetrics[2]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.resultMetrics[2]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.resultMetrics[2]?.value}{data.resultMetrics[2]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.resultMetrics[2]?.threshold}{data.resultMetrics[2]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.resultMetrics[2]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.resultMetrics[2]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-结果线指标4: 交付达成率 */}
                <tr className={data.resultMetrics[3]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.resultMetrics[3]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.resultMetrics[3]?.value}{data.resultMetrics[3]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.resultMetrics[3]?.threshold}{data.resultMetrics[3]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.resultMetrics[3]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.resultMetrics[3]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-结果线指标5: 用药方案采纳率 */}
                <tr className={data.resultMetrics[4]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.resultMetrics[4]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.resultMetrics[4]?.value}{data.resultMetrics[4]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.resultMetrics[4]?.threshold}{data.resultMetrics[4]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.resultMetrics[4]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.resultMetrics[4]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
                {/* 列表-结果线指标6: 预约回访率 */}
                <tr className={data.resultMetrics[5]?.qualified ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2.5 text-sm text-foreground">{data.resultMetrics[5]?.label}</td>
                  <td className="px-3 py-2.5 text-sm text-center font-medium text-foreground">{data.resultMetrics[5]?.value}{data.resultMetrics[5]?.unit}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">≥{data.resultMetrics[5]?.threshold}{data.resultMetrics[5]?.unit}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={data.resultMetrics[5]?.qualified
                      ? 'bg-[#22c55e]/15 text-[#22c55e] text-xs font-medium px-2 py-0.5 rounded-sm'
                      : 'bg-destructive/15 text-destructive text-xs font-medium px-2 py-0.5 rounded-sm'
                    }>
                      {data.resultMetrics[5]?.qualified ? '达标' : '不达标'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Result diagnosis notes for unqualified items */}
          {unqualifiedResult.length > 0 && (
            <div className="mt-3 bg-destructive/5 border-t border-destructive/15 rounded-md p-3 space-y-2">
              {unqualifiedResult.map(m => (
                <div key={m.key} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-[#ef4444]">{m.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({m.value}{m.unit} &lt; {m.threshold}{m.unit})
                    </span>
                    {m.diagnosis && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.diagnosis}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === Empowerment Suggestions === */}
      <div id="empower-plans" className="bg-card rounded-lg shadow-card p-5 border border-border/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="text-base font-semibold text-foreground">赋能建议</h2>
            <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-sm">
              {data.empowerPlans.length}个推荐方案
            </span>
          </div>
          <Link
            href="/empowerment"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            查看全部 <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {/* 列表-赋能方案1 */}
          {data.empowerPlans[0] && (
            <div className="rounded-lg border border-border/30 p-4 hover:shadow-md transition group">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${PRIORITY_CONFIG[data.empowerPlans[0].priority]?.bgColor} ${PRIORITY_CONFIG[data.empowerPlans[0].priority]?.color}`}>
                  {PRIORITY_CONFIG[data.empowerPlans[0].priority]?.label}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {data.empowerPlans[0].duration}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{data.empowerPlans[0].title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{data.empowerPlans[0].description}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {data.empowerPlans[0].targetMetrics.map(metric => (
                  <span key={metric} className="bg-destructive/10 text-[#ef4444] text-[10px] font-medium px-1.5 py-0.5 rounded-sm">
                    {metric}
                  </span>
                ))}
              </div>
              <Link
                href={`/empowerment?planId=${data.empowerPlans[0].id}`}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-primary group-hover:underline"
              >
                立即执行 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
          {/* 列表-赋能方案2 */}
          {data.empowerPlans[1] && (
            <div className="rounded-lg border border-border/30 p-4 hover:shadow-md transition group">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${PRIORITY_CONFIG[data.empowerPlans[1].priority]?.bgColor} ${PRIORITY_CONFIG[data.empowerPlans[1].priority]?.color}`}>
                  {PRIORITY_CONFIG[data.empowerPlans[1].priority]?.label}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {data.empowerPlans[1].duration}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{data.empowerPlans[1].title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{data.empowerPlans[1].description}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {data.empowerPlans[1].targetMetrics.map(metric => (
                  <span key={metric} className="bg-destructive/10 text-[#ef4444] text-[10px] font-medium px-1.5 py-0.5 rounded-sm">
                    {metric}
                  </span>
                ))}
              </div>
              <Link
                href={`/empowerment?planId=${data.empowerPlans[1].id}`}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-primary group-hover:underline"
              >
                立即执行 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
          {/* 列表-赋能方案3 */}
          {data.empowerPlans[2] && (
            <div className="rounded-lg border border-border/30 p-4 hover:shadow-md transition group">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${PRIORITY_CONFIG[data.empowerPlans[2].priority]?.bgColor} ${PRIORITY_CONFIG[data.empowerPlans[2].priority]?.color}`}>
                  {PRIORITY_CONFIG[data.empowerPlans[2].priority]?.label}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {data.empowerPlans[2].duration}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{data.empowerPlans[2].title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{data.empowerPlans[2].description}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {data.empowerPlans[2].targetMetrics.map(metric => (
                  <span key={metric} className="bg-destructive/10 text-[#ef4444] text-[10px] font-medium px-1.5 py-0.5 rounded-sm">
                    {metric}
                  </span>
                ))}
              </div>
              <Link
                href={`/empowerment?planId=${data.empowerPlans[2].id}`}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-primary group-hover:underline"
              >
                立即执行 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* === Growth Timeline === */}
      <div id="growth-timeline" className="bg-card rounded-lg shadow-card p-5 border border-border/30">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">成长轨迹</h2>
          <span className="text-xs text-muted-foreground">近4周象限变化</span>
        </div>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border/30" />

          <div className="space-y-0">
            {/* 列表-时间线第4周 (newest) */}
            {data.timeline[3] && (
              <div className="relative flex items-start gap-4 pb-4">
                <div className={`relative z-10 w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 ${QUADRANT_CONFIG[data.timeline[3].quadrant].bgColor} border ${QUADRANT_CONFIG[data.timeline[3].quadrant].borderColor}`}>
                  <span className={`text-lg font-bold ${QUADRANT_CONFIG[data.timeline[3].quadrant].color}`}>{data.timeline[3].quadrant}</span>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{data.timeline[3].week}</span>
                    <span className="text-xs text-muted-foreground">{data.timeline[3].label}</span>
                    <span className={`text-xs font-medium ${QUADRANT_CONFIG[data.timeline[3].quadrant].color}`}>
                      {QUADRANT_CONFIG[data.timeline[3].quadrant].description}
                    </span>
                    {data.timeline[3].quadrant !== data.timeline[2]?.quadrant && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${
                        getQuadrantRank(data.timeline[3].quadrant) > getQuadrantRank(data.timeline[2]?.quadrant)
                          ? 'text-[#22c55e]' : 'text-[#ef4444]'
                      }`}>
                        {getQuadrantRank(data.timeline[3].quadrant) > getQuadrantRank(data.timeline[2]?.quadrant)
                          ? <><TrendingUp className="w-3 h-3" /> 提升</>
                          : <><TrendingDown className="w-3 h-3" /> 下降</>
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      过程线 <span className="font-medium text-foreground">{data.timeline[3].processScore}分</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      结果线 <span className="font-medium text-foreground">{data.timeline[3].resultScore}分</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* 列表-时间线第3周 */}
            {data.timeline[2] && (
              <div className="relative flex items-start gap-4 pb-4">
                <div className={`relative z-10 w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 ${QUADRANT_CONFIG[data.timeline[2].quadrant].bgColor} border ${QUADRANT_CONFIG[data.timeline[2].quadrant].borderColor}`}>
                  <span className={`text-lg font-bold ${QUADRANT_CONFIG[data.timeline[2].quadrant].color}`}>{data.timeline[2].quadrant}</span>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{data.timeline[2].week}</span>
                    <span className="text-xs text-muted-foreground">{data.timeline[2].label}</span>
                    <span className={`text-xs font-medium ${QUADRANT_CONFIG[data.timeline[2].quadrant].color}`}>
                      {QUADRANT_CONFIG[data.timeline[2].quadrant].description}
                    </span>
                    {data.timeline[2].quadrant !== data.timeline[1]?.quadrant && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${
                        getQuadrantRank(data.timeline[2].quadrant) > getQuadrantRank(data.timeline[1]?.quadrant)
                          ? 'text-[#22c55e]' : 'text-[#ef4444]'
                      }`}>
                        {getQuadrantRank(data.timeline[2].quadrant) > getQuadrantRank(data.timeline[1]?.quadrant)
                          ? <><TrendingUp className="w-3 h-3" /> 提升</>
                          : <><TrendingDown className="w-3 h-3" /> 下降</>
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      过程线 <span className="font-medium text-foreground">{data.timeline[2].processScore}分</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      结果线 <span className="font-medium text-foreground">{data.timeline[2].resultScore}分</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* 列表-时间线第2周 */}
            {data.timeline[1] && (
              <div className="relative flex items-start gap-4 pb-4">
                <div className={`relative z-10 w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 ${QUADRANT_CONFIG[data.timeline[1].quadrant].bgColor} border ${QUADRANT_CONFIG[data.timeline[1].quadrant].borderColor}`}>
                  <span className={`text-lg font-bold ${QUADRANT_CONFIG[data.timeline[1].quadrant].color}`}>{data.timeline[1].quadrant}</span>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{data.timeline[1].week}</span>
                    <span className="text-xs text-muted-foreground">{data.timeline[1].label}</span>
                    <span className={`text-xs font-medium ${QUADRANT_CONFIG[data.timeline[1].quadrant].color}`}>
                      {QUADRANT_CONFIG[data.timeline[1].quadrant].description}
                    </span>
                    {data.timeline[1].quadrant !== data.timeline[0]?.quadrant && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${
                        getQuadrantRank(data.timeline[1].quadrant) > getQuadrantRank(data.timeline[0]?.quadrant)
                          ? 'text-[#22c55e]' : 'text-[#ef4444]'
                      }`}>
                        {getQuadrantRank(data.timeline[1].quadrant) > getQuadrantRank(data.timeline[0]?.quadrant)
                          ? <><TrendingUp className="w-3 h-3" /> 提升</>
                          : <><TrendingDown className="w-3 h-3" /> 下降</>
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      过程线 <span className="font-medium text-foreground">{data.timeline[1].processScore}分</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      结果线 <span className="font-medium text-foreground">{data.timeline[1].resultScore}分</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* 列表-时间线第1周 (oldest) */}
            {data.timeline[0] && (
              <div className="relative flex items-start gap-4">
                <div className={`relative z-10 w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 ${QUADRANT_CONFIG[data.timeline[0].quadrant].bgColor} border ${QUADRANT_CONFIG[data.timeline[0].quadrant].borderColor}`}>
                  <span className={`text-lg font-bold ${QUADRANT_CONFIG[data.timeline[0].quadrant].color}`}>{data.timeline[0].quadrant}</span>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{data.timeline[0].week}</span>
                    <span className="text-xs text-muted-foreground">{data.timeline[0].label}</span>
                    <span className={`text-xs font-medium ${QUADRANT_CONFIG[data.timeline[0].quadrant].color}`}>
                      {QUADRANT_CONFIG[data.timeline[0].quadrant].description}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      过程线 <span className="font-medium text-foreground">{data.timeline[0].processScore}分</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      结果线 <span className="font-medium text-foreground">{data.timeline[0].resultScore}分</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Helper functions ===

function getQuadrantRank(quadrant?: string): number {
  if (!quadrant) return 0;
  const ranks: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  return ranks[quadrant] || 0;
}

// === Radar chart helpers ===
const RADAR_CENTER_X = 150;
const RADAR_CENTER_Y = 135;
const RADAR_RADIUS = 110;

/** Compute polygon points for an N-axis radar grid ring at a given scale (0..1) */
function computeRadarPoints(numAxes: number, scale: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < numAxes; i++) {
    const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
    points.push({
      x: RADAR_CENTER_X + RADAR_RADIUS * scale * Math.cos(angle),
      y: RADAR_CENTER_Y + RADAR_RADIUS * scale * Math.sin(angle),
    });
  }
  return points;
}

/** Compute radar polygon points from actual metric data.
 *  Plots process metrics on axes 0..4 and result metrics on axes 5..10.
 *  Each value is plotted as a percentage of the excellent threshold (100% = threshold).
 *  Values that exceed the threshold are capped at 1.0 for visual clarity.
 */
function computeDataRadarPoints(
  primaryMetrics: ProcessMetric[] | ResultMetric[],
  secondaryMetrics: ProcessMetric[] | ResultMetric[],
  numAxes: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < numAxes; i++) {
    const metric = i < primaryMetrics.length ? primaryMetrics[i] : secondaryMetrics[i - primaryMetrics.length];
    const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
    // Value as fraction of threshold; if value is null, default to 0
    // Cap at 1.0 (threshold) for visual clarity on the radar
    const fraction = metric && metric.value !== null && metric.threshold > 0
      ? Math.min(metric.value / metric.threshold, 1.0)
      : 0;
    points.push({
      x: RADAR_CENTER_X + RADAR_RADIUS * fraction * Math.cos(angle),
      y: RADAR_CENTER_Y + RADAR_RADIUS * fraction * Math.sin(angle),
    });
  }
  return points;
}

function transformApiResponse(raw: any, currentUser: any): GrowthData {
  const quadrant = raw.quadrant || 'D';
  const processQualified = raw.processQualified?.qualified ?? false;
  const resultQualified = raw.resultQualified?.qualified ?? false;

  // Build process metrics
  const processDetails = raw.processQualified?.details || {};
  const processMetrics: ProcessMetric[] = [
    {
      key: 'learning_passed',
      label: '闯关通过数',
      value: processDetails.learningCount ?? raw.learningProgress?.passedLevels ?? 0,
      threshold: 7,
      unit: '关',
      qualified: processDetails.learningPassed ?? false,
    },
    {
      key: 'qc_score',
      label: '录音质检分数',
      value: raw.qcRecords?.length > 0 ? Math.round(raw.qcRecords.reduce((s: number, r: any) => s + (r.score || 0), 0) / raw.qcRecords.length) : null,
      threshold: 70,
      unit: '分',
      qualified: processDetails.qcPassed ?? false,
      diagnosis: !processDetails.qcPassed ? '录音质检均分未达到70分合格线，需加强电话沟通服务用语训练' : undefined,
    },
    {
      key: 'wechat_skill',
      label: '加微服务用语得分',
      value: processDetails.wechatSkillScore ?? null,
      threshold: 80,
      unit: '分',
      qualified: (processDetails.wechatSkillScore ?? 0) >= 80,
    },
    {
      key: 'daily_assessment',
      label: '日常考核均分',
      value: processDetails.dailyAssessmentAvg ?? null,
      threshold: 75,
      unit: '分',
      qualified: (processDetails.dailyAssessmentAvg ?? 0) >= 75,
    },
    {
      key: 'attendance_rate',
      label: '出勤率',
      value: processDetails.attendanceRate ?? 100,
      threshold: 90,
      unit: '%',
      qualified: (processDetails.attendanceRate ?? 100) >= 90,
    },
  ];

  // Build result metrics from business data
  const resultDetails = raw.resultQualified?.details || {};
  const resultMetricKeys = [
    { key: 'wechat_add_rate', label: '加V率', threshold: 90, unit: '%' },
    { key: 'consultation_rate', label: '咨询转化率', threshold: 60, unit: '%' },
    { key: 'reception_rate', label: '接待完成率', threshold: 70, unit: '%' },
    { key: 'delivery_rate', label: '交付达成率', threshold: 80, unit: '%' },
    { key: 'medication_rate', label: '用药方案采纳率', threshold: 75, unit: '%' },
    { key: 'appointment_rate', label: '预约回访率', threshold: 50, unit: '%' },
  ];

  const DIAGNOSES: Record<string, string> = {
    wechat_add_rate: '加微承接服务用语不熟练，高峰期遗漏较多，需强化场景化服务用语训练',
    consultation_rate: '客户需求挖掘深度不足，治疗动机引导和安全感建立不够到位',
    reception_rate: '接待流程执行不够规范，建议加强接待SOP训练',
    delivery_rate: '交付流程存在薄弱环节，需优化交付节奏把控',
    medication_rate: '专业表达能力偏弱，方案说服力不够，建议加强医学知识专项学习',
    appointment_rate: '回访节奏把控不够，客户维护意识需加强',
  };

  const resultMetrics: ResultMetric[] = resultMetricKeys.map(mk => {
    const detail = resultDetails[mk.key];
    const value = detail?.value ?? null;
    const qualified = detail?.qualified ?? false;
    return {
      key: mk.key,
      label: mk.label,
      value,
      threshold: mk.threshold,
      unit: mk.unit,
      qualified,
      diagnosis: !qualified ? DIAGNOSES[mk.key] : undefined,
    };
  });

  // Build empower plans based on unqualified items
  const allUnqualified = [...processMetrics.filter(m => !m.qualified), ...resultMetrics.filter(m => !m.qualified)];
  const empowerPlans: EmpowerPlan[] = allUnqualified.length > 0
    ? [
        ...(resultMetrics.find(m => m.key === 'wechat_add_rate' && !m.qualified) ? [{
          id: 1,
          title: '加微服务用语专项训练',
          description: '针对加V率不达标，通过场景化服务用语演练和模拟训练，提升加微承接能力',
          targetMetrics: ['加V率'],
          duration: '2周',
          priority: 'high' as const,
        }] : []),
        ...(resultMetrics.find(m => m.key === 'consultation_rate' && !m.qualified) ? [{
          id: 2,
          title: '咨询转化力提升方案',
          description: '强化治疗动机深度挖掘和安全感建立能力，提升从咨询到转化的全链路效率',
          targetMetrics: ['咨询转化率'],
          duration: '3周',
          priority: 'high' as const,
        }] : []),
        ...(resultMetrics.find(m => m.key === 'medication_rate' && !m.qualified) ? [{
          id: 3,
          title: '医学专业力进阶计划',
          description: '系统提升用药方案表达专业度，增强客户信任感和方案采纳率',
          targetMetrics: ['用药方案采纳率'],
          duration: '4周',
          priority: 'medium' as const,
        }] : []),
      ]
    : [];

  // Build timeline
  const timeline: TimelineEntry[] = raw.timeline || [];

  return {
    user: {
      id: raw.user?.id || currentUser.id,
      real_name: raw.user?.real_name || currentUser.realName,
      primary_role: raw.user?.primary_role || currentUser.primaryRole,
      join_date: raw.user?.join_date || '',
    },
    quadrant,
    currentStage: raw.learningProgress?.currentStage || 1,
    stageName: STAGE_LABELS[raw.learningProgress?.currentStage || 1],
    processMetrics,
    resultMetrics,
    empowerPlans,
    timeline,
  };
}
