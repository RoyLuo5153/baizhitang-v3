'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  UserCircle, Award, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Clock, Zap, BookOpen, BarChart3,
  Activity, ChevronRight, ArrowRight, Target, FileText,
  Lightbulb, Calendar, Users
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
const QUADRANT_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; description: string }> = {
  A: { label: 'A类', color: 'text-[#22c55e]', bgColor: 'bg-[#22c55e]/10', borderColor: 'border-[#22c55e]/30', description: '过程达标·结果达标' },
  B: { label: 'B类', color: 'text-[#f59e0b]', bgColor: 'bg-[#f59e0b]/10', borderColor: 'border-[#f59e0b]/30', description: '过程达标·结果不达标' },
  C: { label: 'C类', color: 'text-[#ef4444]', bgColor: 'bg-[#ef4444]/10', borderColor: 'border-[#ef4444]/30', description: '过程不达标·结果达标' },
  D: { label: 'D类', color: 'text-[#ef4444]', bgColor: 'bg-[#ef4444]/10', borderColor: 'border-[#ef4444]/30', description: '过程不达标·结果不达标' },
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

// === Mock data for fallback / initial development ===
const MOCK_DATA: GrowthData = {
  user: { id: 1, real_name: '王小明', primary_role: 'trainee', join_date: '2025-01-15' },
  quadrant: 'B',
  currentStage: 2,
  stageName: '阶段二 · 实战演练',
  processMetrics: [
    { key: 'learning_passed', label: '闯关通过数', value: 12, threshold: 7, unit: '关', qualified: true },
    { key: 'qc_score', label: '录音质检分数', value: 75, threshold: 70, unit: '分', qualified: true },
    { key: 'wechat_skill', label: '加微话术得分', value: 82, threshold: 80, unit: '分', qualified: true },
    { key: 'daily_assessment', label: '日常考核均分', value: 78, threshold: 75, unit: '分', qualified: true },
    { key: 'attendance_rate', label: '出勤率', value: 96, threshold: 90, unit: '%', qualified: true },
  ],
  resultMetrics: [
    { key: 'wechat_add_rate', label: '加V率', value: 85, threshold: 90, unit: '%', qualified: false, diagnosis: '加微承接话术不熟练，高峰期遗漏较多，需强化场景化话术训练' },
    { key: 'consultation_rate', label: '咨询转化率', value: 58, threshold: 60, unit: '%', qualified: false, diagnosis: '客户需求挖掘深度不足，产品价值传递不够清晰' },
    { key: 'reception_rate', label: '接待完成率', value: 75, threshold: 70, unit: '%', qualified: true },
    { key: 'delivery_rate', label: '交付达成率', value: 82, threshold: 80, unit: '%', qualified: true },
    { key: 'medication_rate', label: '用药方案采纳率', value: 70, threshold: 75, unit: '%', qualified: false, diagnosis: '专业表达能力偏弱，方案说服力不够，建议加强医学知识专项学习' },
    { key: 'appointment_rate', label: '预约回访率', value: 55, threshold: 50, unit: '%', qualified: true },
  ],
  empowerPlans: [
    {
      id: 1,
      title: '加微话术专项训练',
      description: '针对加V率不达标，通过场景化话术演练和模拟训练，提升加微承接能力',
      targetMetrics: ['加V率'],
      duration: '2周',
      priority: 'high',
    },
    {
      id: 2,
      title: '咨询转化力提升方案',
      description: '强化需求挖掘技巧和产品价值传递能力，提升从咨询到转化的全链路效率',
      targetMetrics: ['咨询转化率'],
      duration: '3周',
      priority: 'high',
    },
    {
      id: 3,
      title: '医学专业力进阶计划',
      description: '系统提升用药方案表达专业度，增强客户信任感和方案采纳率',
      targetMetrics: ['用药方案采纳率'],
      duration: '4周',
      priority: 'medium',
    },
  ],
  timeline: [
    { week: '第1周', label: '1/15-1/21', quadrant: 'D', processScore: 35, resultScore: 40 },
    { week: '第2周', label: '1/22-1/28', quadrant: 'C', processScore: 55, resultScore: 45 },
    { week: '第3周', label: '1/29-2/4', quadrant: 'C', processScore: 68, resultScore: 48 },
    { week: '第4周', label: '2/5-2/11', quadrant: 'B', processScore: 78, resultScore: 58 },
  ],
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
      setError('加载成长档案失败，正在使用模拟数据');
      // Use mock data as fallback
      setData(MOCK_DATA);
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
                {/* 列表-过程线指标3: 加微话术得分 */}
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
      diagnosis: !processDetails.qcPassed ? '录音质检均分未达到70分合格线，需加强电话沟通话术训练' : undefined,
    },
    {
      key: 'wechat_skill',
      label: '加微话术得分',
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
    wechat_add_rate: '加微承接话术不熟练，高峰期遗漏较多，需强化场景化话术训练',
    consultation_rate: '客户需求挖掘深度不足，产品价值传递不够清晰',
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
          title: '加微话术专项训练',
          description: '针对加V率不达标，通过场景化话术演练和模拟训练，提升加微承接能力',
          targetMetrics: ['加V率'],
          duration: '2周',
          priority: 'high' as const,
        }] : []),
        ...(resultMetrics.find(m => m.key === 'consultation_rate' && !m.qualified) ? [{
          id: 2,
          title: '咨询转化力提升方案',
          description: '强化需求挖掘技巧和产品价值传递能力，提升从咨询到转化的全链路效率',
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
    : MOCK_DATA.empowerPlans;

  // Build timeline
  const timeline: TimelineEntry[] = raw.timeline || MOCK_DATA.timeline;

  return {
    user: {
      id: raw.user?.id || currentUser.id,
      real_name: raw.user?.real_name || currentUser.realName,
      primary_role: raw.user?.primary_role || currentUser.primaryRole,
      join_date: raw.user?.join_date || '2025-01-15',
    },
    quadrant,
    currentStage: raw.learningProgress?.currentStage || 1,
    stageName: STAGE_LABELS[raw.learningProgress?.currentStage || 1],
    processMetrics,
    resultMetrics,
    empowerPlans: empowerPlans.length > 0 ? empowerPlans : MOCK_DATA.empowerPlans,
    timeline,
  };
}
