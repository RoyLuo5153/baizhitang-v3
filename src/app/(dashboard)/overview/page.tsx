'use client';

import { useEffect, useState } from 'react';
import {
  Activity, Users, BookOpen, Award, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, Eye,
} from 'lucide-react';

interface OverviewData {
  totalMembers: number;
  avgStage: number;
  totalPassed: number;
  quadrantDist: { A: number; B: number; C: number; D: number };
  stageDistribution: Record<number, number>;
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/diagnosis?view=team');
        if (res.ok) {
          const json = await res.json();
          setData({
            totalMembers: json.summary?.total || 0,
            avgStage: 1.5,
            totalPassed: 0,
            quadrantDist: {
              A: json.summary?.A || 0,
              B: json.summary?.B || 0,
              C: json.summary?.C || 0,
              D: json.summary?.D || 0,
            },
            stageDistribution: { 1: 4, 2: 3, 3: 1 },
          });
        }
      } catch {
        setData({
          totalMembers: 8, avgStage: 1.5, totalPassed: 0,
          quadrantDist: { A: 2, B: 3, C: 2, D: 1 },
          stageDistribution: { 1: 4, 2: 3, 3: 1 },
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const total = data.quadrantDist.A + data.quadrantDist.B + data.quadrantDist.C + data.quadrantDist.D;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">全局概览</h1>
        <span className="text-sm text-muted-foreground">总经理/培训负责人视角</span>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">团队规模</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{data.totalMembers}<span className="text-base font-normal text-muted-foreground ml-1">人</span></p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">达标率</span>
          </div>
          <p className="text-3xl font-bold text-[#22c55e]">
            {total > 0 ? Math.round((data.quadrantDist.A / total) * 100) : 0}%
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">阶段分布</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold text-foreground">阶段1: {data.stageDistribution[1] || 0}</span>
            <span className="text-lg font-bold text-foreground">阶段2: {data.stageDistribution[2] || 0}</span>
            <span className="text-lg font-bold text-foreground">阶段3: {data.stageDistribution[3] || 0}</span>
          </div>
        </div>
      </div>

      {/* Quadrant Visualization */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">四象限全景</h2>
        <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg">
          {/* A - top left */}
          <div className="bg-[#22c55e]/5 rounded-md p-5 text-center border-2 border-[#22c55e]/20">
            <p className="text-sm font-semibold text-[#22c55e] mb-1">A类 · 达标</p>
            <p className="text-4xl font-bold text-foreground">{data.quadrantDist.A}</p>
            <p className="text-xs text-muted-foreground mt-1">过程✓ 结果✓</p>
          </div>
          {/* B - top right */}
          <div className="bg-[#f59e0b]/5 rounded-md p-5 text-center border-2 border-[#f59e0b]/20">
            <p className="text-sm font-semibold text-[#f59e0b] mb-1">B类 · 结果待提升</p>
            <p className="text-4xl font-bold text-foreground">{data.quadrantDist.B}</p>
            <p className="text-xs text-muted-foreground mt-1">过程✓ 结果✗</p>
          </div>
          {/* C - bottom left */}
          <div className="bg-[#ef4444]/5 rounded-md p-5 text-center border-2 border-[#ef4444]/20">
            <p className="text-sm font-semibold text-[#ef4444] mb-1">C类 · 过程待提升</p>
            <p className="text-4xl font-bold text-foreground">{data.quadrantDist.C}</p>
            <p className="text-xs text-muted-foreground mt-1">过程✗ 结果✓</p>
          </div>
          {/* D - bottom right */}
          <div className="bg-[#ef4444]/5 rounded-md p-5 text-center border-2 border-[#ef4444]/20">
            <p className="text-sm font-semibold text-[#ef4444] mb-1">D类 · 全面待提升</p>
            <p className="text-4xl font-bold text-foreground">{data.quadrantDist.D}</p>
            <p className="text-xs text-muted-foreground mt-1">过程✗ 结果✗</p>
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground px-2">
          <span>← 过程线</span>
          <span>结果线 →</span>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">风险预警</h2>
        <div className="space-y-3">
          {data.quadrantDist.D > 0 && (
            <div className="flex items-center gap-3 p-3 bg-destructive/5 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">D类人员 {data.quadrantDist.D} 人需要立即干预</p>
                <p className="text-xs text-muted-foreground">连续2周D类将触发复训机制</p>
              </div>
              <a href="/diagnosis" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                查看详情 <Eye className="w-3 h-3" />
              </a>
            </div>
          )}
          {data.quadrantDist.A > 0 && (
            <div className="flex items-center gap-3 p-3 bg-[#22c55e]/5 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-[#22c55e] shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">A类人员 {data.quadrantDist.A} 人可进入阶段三</p>
                <p className="text-xs text-muted-foreground">连续4周A类即可独立接诊</p>
              </div>
            </div>
          )}
          {data.quadrantDist.D === 0 && data.quadrantDist.C === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">当前无风险预警</p>
          )}
        </div>
      </div>
    </div>
  );
}
