'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, Users, BookOpen, Target, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { RingProgress } from '@/components/charts/RingProgress';
import { QuadrantScatter } from '@/components/charts/QuadrantScatter';
import { BenchmarkRadar } from '@/components/charts/BenchmarkRadar';
import { CHART_COLORS, getStatusColor } from '@/lib/constants/chart-colors';

// ─── Types ──────────────────────────────────────────

interface DiagnosisMember {
  id: string;
  name: string;
  quadrant: string;
  processQualified: boolean;
  resultQualified: boolean;
  processScore: number;
  resultScore: number;
  processDetails: Record<string, any>;
  resultDetails: Record<string, any>;
  stage?: number;
}

interface DiagnosisSummary {
  total: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

interface AlertItem {
  id: string;
  type: 'critical' | 'warning';
  message: string;
  metric: string;
}

interface OverviewData {
  healthScore: number;
  totalTrainees: number;
  passedLevels: number;
  totalLevels: number;
  passRate: number;
  aClassRate: number;
  empowerRate: number;
  empowerStats: { assigned: number; inProgress: number; completed: number; verified: number; total: number };
  summary: DiagnosisSummary;
  members: DiagnosisMember[];
  alerts: AlertItem[];
  radarData: { dimension: string; actual: number; benchmark: number; fullMark: number }[];
}

// ─── Main Page ──────────────────────────────────────

export default function GlobalOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // 获取诊断数据
    const diagResult = await apiGet<{ members: DiagnosisMember[]; summary: DiagnosisSummary }>('/api/diagnosis?view=overview', { members: [], summary: { total: 0, A: 0, B: 0, C: 0, D: 0 } });

    const members: DiagnosisMember[] = diagResult.members;
    const summary: DiagnosisSummary = diagResult.summary;

      // 计算KPI
      const totalTrainees = members.length;
      const aClassRate = totalTrainees > 0 ? Math.round((summary.A / totalTrainees) * 100) : 0;

      // 全局健康度 = (A类占比*1 + B类占比*0.5 + C类占比*0.5 + D类占比*0) * 100
      const healthScore = totalTrainees > 0
        ? Math.round(((summary.A * 1 + summary.B * 0.5 + summary.C * 0.5 + summary.D * 0) / totalTrainees) * 100)
        : 0;

      // 闯关通过率 — 从processDetails.learning取
      const passRates = members.map(m => {
        const learning = m.processDetails?.learning;
        if (!learning) return 0;
        const passed = learning.value || 0;
        const total = learning.threshold?.excellent || learning.threshold?.good || 21;
        return Math.min(Math.round((passed / total) * 100), 100);
      });
      const passRate = passRates.length > 0 ? Math.round(passRates.reduce((a, b) => a + b, 0) / passRates.length) : 0;

      // 已通过/总关数
      const passedLevels = members.reduce((sum, m) => sum + (m.processDetails?.learning?.value || 0), 0);
      const totalLevels = totalTrainees * 21;

      // 赋能完成率 — 从empower API取（简化：用结果线达标率估算）
      const empowerRates = members.map(m => {
        const rd = m.resultDetails || {};
        const items = Object.values(rd);
        if (items.length === 0) return 0;
        const qualified = items.filter((it: any) => it.level !== 'unqualified').length;
        return Math.round((qualified / items.length) * 100);
      });
      const empowerRate = empowerRates.length > 0 ? Math.round(empowerRates.reduce((a, b) => a + b, 0) / empowerRates.length) : 0;

      // 赋能执行统计 — 从executions API获取真实数据
      let empowerStats = { assigned: 0, inProgress: 0, completed: 0, verified: 0, total: 0 };
      const execResult = await apiGet<{ executions: any[] }>('/api/empower/executions', { executions: [] });
      const execs = execResult.executions;
      empowerStats = {
        assigned: execs.filter((e: any) => e.status === 'assigned').length,
        inProgress: execs.filter((e: any) => e.status === 'in_progress').length,
        completed: execs.filter((e: any) => e.status === 'completed').length,
        verified: execs.filter((e: any) => e.status === 'verified').length,
        total: execs.length,
      };

      // 雷达图数据 — 各维度团队均值 vs 基准(75)
      const allDimensions = new Set<string>();
      members.forEach(m => {
        Object.keys(m.processDetails || {}).forEach(k => allDimensions.add(k));
        Object.keys(m.resultDetails || {}).forEach(k => allDimensions.add(k));
      });

      const dimensionLabels: Record<string, string> = {
        learning: '闯关进度', qcScore: '质检平均分',
        qc_communication: '沟通表达', qc_professional: '流程规范',
        qc_service: '服务态度', qc_compliance: '业务能力',
        wechatAddRate: '加V率', consultationRate: '面诊率',
        receptionRate: '接诊率', deliveryRate: '签收率',
        medicationRate: '用药率', appointmentRate: '挂号率',
      };

      const radarData = Array.from(allDimensions).map(dim => {
        const values: number[] = [];
        members.forEach(m => {
          const detail = m.processDetails?.[dim] || m.resultDetails?.[dim];
          if (detail) {
            const t = detail.threshold?.excellent || detail.threshold?.good || detail.threshold?.passing || 100;
            values.push(t > 0 ? Math.min(Math.round((detail.value / t) * 100), 100) : 0);
          }
        });
        const actual = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
        return {
          dimension: dimensionLabels[dim] || dim,
          actual,
          benchmark: 75,
          fullMark: 100,
        };
      });

      // 预警项
      const alerts: AlertItem[] = [];
      members.forEach(m => {
        if (m.quadrant === 'D') {
          alerts.push({ id: `d-${m.id}`, type: 'critical', message: `${m.name} 全不合格(D类)`, metric: 'quadrant' });
        }
        const rd = m.resultDetails || {};
        Object.values(rd).forEach((it: any) => {
          if (it.level === 'unqualified' && it.value !== null) {
            alerts.push({ id: `r-${m.id}-${it.label}`, type: 'warning', message: `${m.name} ${it.label}未达标(${it.value}${it.unit})`, metric: it.label });
          }
        });
      });

      setData({
        healthScore,
        totalTrainees,
        passedLevels,
        totalLevels,
        passRate,
        aClassRate,
        empowerRate,
        empowerStats,
        summary,
        members,
        alerts: alerts.slice(0, 8),
        radarData,
      });
      setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-[1400px] mx-auto">
      {/* 顶部标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">全局概览</h1>
        <span className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* ── 顶部: 5个KPI图表卡片一行 ── */}
      <div className="grid grid-cols-5 gap-3">
        {/* 全局健康度 — 仪表盘 */}
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5" style={{ color: getStatusColor(data.healthScore, { green: 70, yellow: 40 }) }} />
              <span className="text-xs font-medium text-muted-foreground">全局健康度</span>
            </div>
            <GaugeChart value={data.healthScore} size={140} strokeWidth={12} thresholds={{ green: 70, yellow: 40 }} />
          </CardContent>
        </Card>

        {/* 在培人数 — 数字+进度条 */}
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-[#2978B5]" />
              <span className="text-xs font-medium text-muted-foreground">在培人数</span>
            </div>
            <span className="text-3xl font-bold text-foreground">{data.totalTrainees}</span>
            <div className="w-full mt-2 px-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>闯关进度</span>
                <span>{data.passedLevels}/{data.totalLevels}关</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E6E1D8' }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${data.totalLevels > 0 ? Math.round((data.passedLevels / data.totalLevels) * 100) : 0}%`,
                    backgroundColor: getStatusColor(data.totalLevels > 0 ? (data.passedLevels / data.totalLevels) * 100 : 0, { green: 80, yellow: 60 }),
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 闯关通过率 — 环形进度图 */}
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-[#2978B5]" />
              <span className="text-xs font-medium text-muted-foreground">闯关通过率</span>
            </div>
            <RingProgress
              value={data.passRate}
              thresholds={{ green: 80, yellow: 60 }}
              targetLabel="目标 80%"
              showTarget
              targetValue={80}
            />
          </CardContent>
        </Card>

        {/* A类占比 — 柱状对比图 */}
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5" style={{ color: getStatusColor(data.aClassRate, { green: 35, yellow: 10 }) }} />
              <span className="text-xs font-medium text-muted-foreground">A类占比</span>
            </div>
            <div className="w-full h-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: '实际', value: data.aClassRate },
                    { name: '目标', value: 35 },
                  ]}
                  barSize={28}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 50]} hide />
                  <RechartsTooltip
                    formatter={(val: number) => `${val}%`}
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill={getStatusColor(data.aClassRate, { green: 35, yellow: 10 })} />
                    <Cell fill={CHART_COLORS.muted} fillOpacity={0.3} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 赋能完成率 — 环形进度图 + 执行统计 */}
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5" style={{ color: getStatusColor(data.empowerRate, { green: 80, yellow: 50 }) }} />
              <span className="text-xs font-medium text-muted-foreground">赋能完成率</span>
            </div>
            <RingProgress
              value={data.empowerRate}
              thresholds={{ green: 80, yellow: 50 }}
              targetLabel="目标 80%"
              showTarget
              targetValue={80}
            />
            {/* 赋能执行率明细 */}
            {data.empowerStats.total > 0 && (
              <div className="w-full mt-2 px-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">已推送</span>
                  <span className="font-medium text-foreground">{data.empowerStats.assigned + data.empowerStats.inProgress}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">执行中</span>
                  <span className="font-medium" style={{ color: '#2978B5' }}>{data.empowerStats.inProgress}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">已完成</span>
                  <span className="font-medium" style={{ color: '#F59E0B' }}>{data.empowerStats.completed}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">已达标</span>
                  <span className="font-medium" style={{ color: '#2E7D32' }}>{data.empowerStats.verified}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 中部: 气泡散点图 + 象限摘要 ── */}
      <Card className="border-border/40">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-foreground">四象限分布</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <QuadrantScatter
            data={data.members.map(m => ({
              name: m.name,
              processScore: m.processScore,
              resultScore: m.resultScore,
              trainingDays: m.stage ? m.stage * 7 : 30,
              quadrant: m.quadrant,
            }))}
            quadrantSummary={data.summary}
          />
        </CardContent>
      </Card>

      {/* ── 底部: 雷达图 + 预警列表 ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* 雷达图 2/3 */}
        <Card className="col-span-2 border-border/40">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">核心指标对标看板</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <BenchmarkRadar data={data.radarData} />
          </CardContent>
        </Card>

        {/* 预警列表 1/3 */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
              预警项
              {data.alerts.filter(a => a.type === 'critical').length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#EF4444]/15 text-[#EF4444] font-medium">
                  {data.alerts.filter(a => a.type === 'critical').length}紧急
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {data.alerts.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">暂无预警</div>
            ) : (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {data.alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-2 px-3 py-2 rounded-md text-xs ${
                      alert.type === 'critical' ? 'bg-[#EF4444]/[0.04]' : 'bg-[#F59E0B]/[0.04]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      alert.type === 'critical' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'
                    }`} />
                    <span className={alert.type === 'critical' ? 'text-[#EF4444]' : 'text-[#F59E0B]'}>
                      {alert.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
