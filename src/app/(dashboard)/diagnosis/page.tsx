'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import {
  ScanSearch, Users, AlertTriangle, CheckCircle2, TrendingDown,
  ChevronRight, Activity, Target, Route as RouteIcon, User,
  X, ArrowRight, Zap, Clock, ListChecks, Send, BarChart3,
  TrendingUp, TrendingDown as TrendingDownIcon, CheckCircle, Eye, Pill, Compass, Search,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Member {
  id: string;
  name: string;
  role: string;
  stage: number;
  quadrant: string;
  processQualified: boolean;
  resultQualified: boolean;
  processDetails: Record<string, any>;
  resultDetails: Record<string, any>;
}

interface DiagnosisData {
  summary: { total: number; A: number; B: number; C: number; D: number };
  members: Member[];
}

interface EmpowerPlan {
  id: string;
  name: string;
  description: string;
  indicator_key?: string;
  target_indicators?: string[];
  content: {
    analysis?: string;
    direction?: string;
    prescription?: { step: string; detail: string; duration?: string; responsible?: string }[];
    standard?: string;
    steps?: string[];
    [key: string]: unknown;
  };
  estimated_hours?: number;
}

interface AttributionEntry {
  metricKey: string;
  metricLabel: string;
  currentValue: number;
  unit: string;
  threshold: number;
  problemLabel: string;
  problemDesc: string;
  planId: string | null;
  planName: string;
  planHours: number;
  planSteps: string[];
  planContent: EmpowerPlan['content'] | null;
  alreadyPushed: boolean;
}

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  threshold: number;
}

interface WeeklyFunnel {
  week: string;
  stages: FunnelStage[];
}

/* ------------------------------------------------------------------ */
/*  Attribution Mapping (metric → problem → plan)                      */
/* ------------------------------------------------------------------ */

const PROCESS_ATTRIBUTIONS: Record<string, Omit<AttributionEntry, 'currentValue' | 'planId' | 'planContent' | 'alreadyPushed'>> = {
  learning: {
    metricKey: 'learning',
    metricLabel: '闯关进度',
    unit: '关',
    threshold: 7,
    problemLabel: '学习进度滞后',
    problemDesc: '闯关进度未达标，知识储备不足，需加速基础课程学习',
    planName: '闯关加速训练',
    planHours: 4,
    planSteps: ['完成薄弱关卡重做', '观看名师解题视频', '完成阶段性测试'],
  },
  qcScore: {
    metricKey: 'qcScore',
    metricLabel: '质检平均分',
    unit: '分',
    threshold: 70,
    problemLabel: '质检分数偏低',
    problemDesc: '质检评分不达标，沟通表达与流程执行需强化',
    planName: '质检提分专项',
    planHours: 6,
    planSteps: ['回放低分录音找问题', '针对性服务用语强化训练', '模拟质检互评练习'],
  },
  rolePlay: {
    metricKey: 'rolePlay',
    metricLabel: '场景模拟评分',
    unit: '分',
    threshold: 75,
    problemLabel: '场景应对薄弱',
    problemDesc: '场景模拟评分不达标，实际应对能力需提升',
    planName: '场景实战演练',
    planHours: 5,
    planSteps: ['高频场景逐一演练', '异议处理专项训练', '录音复盘与改进'],
  },
  attendance: {
    metricKey: 'attendance',
    metricLabel: '出勤率',
    unit: '%',
    threshold: 90,
    problemLabel: '出勤不达标',
    problemDesc: '出勤率偏低，影响学习连贯性和团队节奏',
    planName: '出勤管理计划',
    planHours: 2,
    planSteps: ['制定个人出勤计划', '设置出勤提醒', '每周出勤回顾'],
  },
};

const RESULT_ATTRIBUTIONS: Record<string, Omit<AttributionEntry, 'currentValue' | 'planId' | 'planContent' | 'alreadyPushed'>> = {
  wechatAddRate: {
    metricKey: 'wechatAddRate',
    metricLabel: '加V率',
    unit: '%',
    threshold: 90,
    problemLabel: '加V率不达标',
    problemDesc: '服务用语运用不熟练，需加强场景模拟训练',
    planName: '加V服务用语强化',
    planHours: 3,
    planSteps: ['优化开场白服务用语', '模拟加V场景演练', 'A/B测试不同服务用语'],
  },
  consultationRate: {
    metricKey: 'consultationRate',
    metricLabel: '面诊率',
    unit: '%',
    threshold: 85,
    problemLabel: '面诊转化不足',
    problemDesc: '面诊邀约技巧欠缺，需提升客户说服力',
    planName: '面诊邀约特训',
    planHours: 4,
    planSteps: ['面诊价值服务用语训练', '邀约时机把握演练', '异议处理专项'],
  },
  receptionRate: {
    metricKey: 'receptionRate',
    metricLabel: '接诊率',
    unit: '%',
    threshold: 80,
    problemLabel: '接诊率偏低',
    problemDesc: '接诊流程把控不足，需提升专业性表现',
    planName: '接诊流程优化',
    planHours: 5,
    planSteps: ['接诊SOP标准化训练', '专业形象塑造指导', '客户需求挖掘训练'],
  },
  signRate: {
    metricKey: 'signRate',
    metricLabel: '签收率',
    unit: '%',
    threshold: 60,
    problemLabel: '签收转化弱',
    problemDesc: '方案呈现和异议处理能力不足，需加强成交技巧',
    planName: '签收转化突破',
    planHours: 6,
    planSteps: ['方案呈现技巧训练', '价格异议处理演练', '成交信号识别训练'],
  },
  medicationRate: {
    metricKey: 'medicationRate',
    metricLabel: '用药率',
    unit: '%',
    threshold: 70,
    problemLabel: '用药率不达标',
    problemDesc: '用药方案解读能力不足，需加强专业沟通',
    planName: '用药沟通专项',
    planHours: 4,
    planSteps: ['用药方案解读训练', '患者疑虑应对服务用语', '用药跟踪回访规范'],
  },
  registrationRate: {
    metricKey: 'registrationRate',
    metricLabel: '挂号率',
    unit: '%',
    threshold: 50,
    problemLabel: '挂号率偏低',
    problemDesc: '复诊引导意识薄弱，需强化长期管理思维',
    planName: '挂号引导训练',
    planHours: 3,
    planSteps: ['复诊价值传递服务用语', '挂号时机把握训练', '患者管理计划制定'],
  },
};

/* ------------------------------------------------------------------ */
/*  Quadrant Config                                                    */
/* ------------------------------------------------------------------ */

const QUADRANT_CONFIG: Record<string, {
  label: string; desc: string; color: string; bgColor: string; borderColor: string; icon: any;
}> = {
  A: {
    label: 'A类 · 达标',
    desc: '过程线全合格 + 结果线全合格',
    color: 'text-[#22c55e]',
    bgColor: 'bg-[#22c55e]/5',
    borderColor: 'border-[#22c55e]/30',
    icon: CheckCircle2,
  },
  B: {
    label: 'B类 · 结果待提升',
    desc: '过程线合格 + 结果线有不合格',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]/5',
    borderColor: 'border-[#f59e0b]/30',
    icon: TrendingDown,
  },
  C: {
    label: 'C类 · 过程待提升',
    desc: '过程线有不合格 + 结果线合格',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/30',
    icon: AlertTriangle,
  },
  D: {
    label: 'D类 · 全面待提升',
    desc: '过程线有不合格 + 结果线有不合格',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/30',
    icon: AlertTriangle,
  },
};

/* ------------------------------------------------------------------ */
/*  Helper: build attribution entries for a member                     */
/* ------------------------------------------------------------------ */

function buildAttributions(
  member: Member,
  plans: EmpowerPlan[],
  pushedPlanIds: Set<string>,
): AttributionEntry[] {
  const entries: AttributionEntry[] = [];

  // Process line unqualified items
  const processEntries = Object.entries(member.processDetails);
  for (const [key, detail] of processEntries) {
    if (detail.level === 'unqualified') {
      const mapping = PROCESS_ATTRIBUTIONS[key];
      if (mapping) {
        // Try to find a matching plan from database
        const matchedPlan = plans.find(p =>
          p.indicator_key === key ||
          (p.target_indicators && Array.isArray(p.target_indicators) && p.target_indicators.includes(key))
        );
        entries.push({
          ...mapping,
          currentValue: detail.value,
          planId: matchedPlan?.id || null,
          planName: matchedPlan?.name || mapping.planName,
          planHours: matchedPlan?.estimated_hours || mapping.planHours,
          planSteps: matchedPlan?.content?.prescription
            ? matchedPlan.content.prescription.map((s: { step: string }) => s.step)
            : matchedPlan?.content?.steps || mapping.planSteps,
          planContent: matchedPlan?.content || null,
          alreadyPushed: matchedPlan ? pushedPlanIds.has(`${matchedPlan.id}:${member.id}`) : false,
        });
      }
    }
  }

  // Result line unqualified items
  const resultEntries = Object.entries(member.resultDetails);
  for (const [key, detail] of resultEntries) {
    if (detail.level === 'unqualified') {
      const mapping = RESULT_ATTRIBUTIONS[key];
      if (mapping) {
        const matchedPlan = plans.find(p =>
          p.indicator_key === key ||
          (p.target_indicators && Array.isArray(p.target_indicators) && p.target_indicators.includes(key))
        );
        entries.push({
          ...mapping,
          currentValue: detail.value,
          planId: matchedPlan?.id || null,
          planName: matchedPlan?.name || mapping.planName,
          planHours: matchedPlan?.estimated_hours || mapping.planHours,
          planSteps: matchedPlan?.content?.prescription
            ? matchedPlan.content.prescription.map((s: { step: string }) => s.step)
            : matchedPlan?.content?.steps || mapping.planSteps,
          planContent: matchedPlan?.content || null,
          alreadyPushed: matchedPlan ? pushedPlanIds.has(`${matchedPlan.id}:${member.id}`) : false,
        });
      }
    }
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function DiagnosisPage() {
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [plans, setPlans] = useState<EmpowerPlan[]>([]);
  const [pushedSet, setPushedSet] = useState<Set<string>>(new Set());
  const [pushingKey, setPushingKey] = useState<string | null>(null);
  const [prescriptionPlan, setPrescriptionPlan] = useState<{ plan: EmpowerPlan; entry: AttributionEntry; memberId: string } | null>(null);

  useEffect(() => {
    fetchDiagnosis();
    fetchPlansAndExecutions();
  }, []);

  async function fetchDiagnosis() {
    const result = await apiGet<DiagnosisData | null>('/api/diagnosis?view=team', null);
    setData(result);
    setLoading(false);
  }

  async function fetchPlansAndExecutions() {
    const [plansResult, execResult] = await Promise.all([
      apiGet<{ plans: EmpowerPlan[] }>('/api/empower', { plans: [] }),
      apiGet<{ executions: { plan_id: string; user_id: string; status: string }[] }>('/api/empower/executions', { executions: [] }),
    ]);
    setPlans(plansResult.plans);
    const set = new Set<string>();
    execResult.executions.forEach((e) => {
      if (e.status === 'assigned' || e.status === 'in_progress') {
        set.add(`${e.plan_id}:${e.user_id}`);
      }
    });
    setPushedSet(set);
  }

  async function handlePushPlan(planId: string, memberId: string, metricKey: string) {
    setPushingKey(metricKey);
    try {
      const res = await fetch('/api/empower/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, traineeId: memberId }),
      });
      if (res.ok) {
        setPushedSet(prev => new Set([...prev, `${planId}:${memberId}`]));
      }
    } catch { /* ignore */ }
    setPushingKey(null);
  }

  async function handlePushAll(memberId: string, attrs: AttributionEntry[]) {
    const pushable = attrs.filter(a => a.planId && !a.alreadyPushed);
    for (const attr of pushable) {
      await handlePushPlan(attr.planId!, memberId, attr.metricKey);
    }
  }

  // Build attributions for selected member
  const attributions = useMemo(() => {
    if (!selectedMember) return [];
    return buildAttributions(selectedMember, plans, pushedSet);
  }, [selectedMember, plans, pushedSet]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <ScanSearch className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">暂无诊断数据</h3>
        <p className="text-sm text-muted-foreground">尚未录入业务数据，无法进行双轨诊断</p>
        <p className="text-xs text-muted-foreground mt-1">请先在"业务数据"页面录入学员指标</p>
      </div>
    );
  }

  const { summary, members } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScanSearch className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">双轨诊断</h1>
        <span className="text-sm text-muted-foreground">
          团队共 {summary.total} 人 · 逐项对标四象限分类
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(['A', 'B', 'C', 'D'] as const).map(q => {
          const config = QUADRANT_CONFIG[q];
          const Icon = config.icon;
          return (
            <div
              key={q}
              className={`bg-card rounded-lg shadow-card p-4 border-2 ${config.borderColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${config.color}`} />
                <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{summary[q]}</p>
              <p className="text-xs text-muted-foreground mt-1">{config.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Quadrant Grid + Attribution Panel */}
      <div className="flex gap-6">
        {/* Quadrant Grid */}
        <div className={`grid grid-cols-2 gap-6 ${selectedMember ? 'w-3/5' : 'w-full'} transition-all duration-300`}>
          {(['A', 'B', 'C', 'D'] as const).map(q => {
            const config = QUADRANT_CONFIG[q];
            const qMembers = members.filter(m => m.quadrant === q);
            return (
              <div
                key={q}
                className={`bg-card rounded-lg shadow-card border ${config.borderColor} overflow-hidden`}
              >
                <div className={`px-5 py-3 border-b border-border flex items-center gap-2 ${config.bgColor}`}>
                  <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                  <span className="text-xs text-muted-foreground">{qMembers.length}人</span>
                </div>
                <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                  {qMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无成员</p>
                  ) : (
                    qMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(selectedMember?.id === m.id ? null : m)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                          selectedMember?.id === m.id ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-foreground'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                          {m.name.charAt(0)}
                        </div>
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">阶段{m.stage}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Attribution Panel */}
        {selectedMember && (
          <div className="w-2/5 min-w-[400px] bg-card rounded-lg shadow-card border border-border overflow-hidden flex flex-col">
            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {selectedMember.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{selectedMember.name} · 归因面板</h3>
                  <span className={`text-xs font-medium ${QUADRANT_CONFIG[selectedMember.quadrant].color}`}>
                    {QUADRANT_CONFIG[selectedMember.quadrant].label}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attribution Flow */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {attributions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-[#22c55e] mb-3" />
                  <p className="text-sm font-medium text-foreground">全部达标</p>
                  <p className="text-xs text-muted-foreground mt-1">该成员所有指标均已达标，暂无需归因</p>
                </div>
              ) : (
                attributions.map((attr, idx) => (
                  <AttributionFlowRow
                    key={attr.metricKey}
                    entry={attr}
                    memberId={selectedMember.id}
                    onPush={(planId) => handlePushPlan(planId, selectedMember.id, attr.metricKey)}
                    onPreview={(plan) => setPrescriptionPlan({ plan, entry: attr, memberId: selectedMember.id })}
                    pushing={pushingKey === attr.metricKey}
                  />
                ))
              )}
            </div>

            {/* Panel Footer */}
            {attributions.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  共 {attributions.length} 项待提升 · 预计 {attributions.reduce((s, a) => s + a.planHours, 0)} 小时
                </span>
                <button
                  onClick={() => handlePushAll(selectedMember.id, attributions)}
                  disabled={attributions.every(a => a.alreadyPushed || !a.planId) || pushingKey !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  一键推送全部方案
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prescription Preview Modal */}
      {prescriptionPlan && (
        <PrescriptionPreviewModal
          plan={prescriptionPlan.plan}
          memberName={selectedMember?.name || ''}
          onClose={() => setPrescriptionPlan(null)}
          onPush={(planId: string) => {
            handlePushPlan(planId, prescriptionPlan.memberId, prescriptionPlan.entry.metricKey);
            setPrescriptionPlan(null);
          }}
          pushing={pushingKey !== null}
        />
      )}

      {/* Funnel Trend Chart */}
      <FunnelTrendSection members={members} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Attribution Flow Row: 不合格项 → 问题归因 → 推荐方案               */
/* ------------------------------------------------------------------ */

function AttributionFlowRow({ entry, memberId, onPush, onPreview, pushing }: {
  entry: AttributionEntry;
  memberId: string;
  onPush: (planId: string) => void;
  onPreview: (plan: EmpowerPlan) => void;
  pushing: boolean;
}) {
  const [planExpanded, setPlanExpanded] = useState(false);
  const hasPlan = !!entry.planId;
  const content = entry.planContent;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Flow: Metric → Problem → Plan */}
      <div className="flex items-stretch">
        {/* Step 1: Unqualified Metric */}
        <div className="flex-1 p-3.5 bg-destructive/5 border-r border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
            <span className="text-xs font-semibold text-destructive">不合格项</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{entry.metricLabel}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-destructive">{entry.currentValue}</span>
            <span className="text-xs text-muted-foreground">{entry.unit}</span>
            <span className="text-xs text-muted-foreground mx-1">/</span>
            <span className="text-xs text-muted-foreground">≥{entry.threshold}{entry.unit}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center px-1 bg-muted/20">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Step 2: Problem Attribution */}
        <div className="flex-1 p-3.5 bg-warning/5 border-r border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <span className="text-xs font-semibold text-[#f59e0b]">问题归因</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{entry.problemLabel}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{entry.problemDesc}</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center px-1 bg-muted/20">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Step 3: Recommended Plan */}
        <div className="flex-1 p-3.5 bg-primary/5">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-primary">推荐方案</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{entry.planName}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{entry.planHours}小时</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {entry.alreadyPushed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#22c55e]/15 text-[#22c55e]">
                <CheckCircle className="w-3 h-3" />已推送
              </span>
            ) : (
              <button
                onClick={() => entry.planId && onPush(entry.planId)}
                disabled={pushing || !hasPlan}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3" />{pushing ? '推送中...' : '推送方案'}
              </button>
            )}
            {hasPlan && content && (
              <button
                onClick={() => setPlanExpanded(!planExpanded)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <Eye className="w-3 h-3" />查看处方
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Prescription (4-segment) */}
      {planExpanded && content && (
        <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
          {/* 病情分析 */}
          {content.analysis && (
            <div className="bg-[#102A43]/5 rounded-md p-3 border border-[#102A43]/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Search className="w-3.5 h-3.5 text-[#102A43]" />
                <span className="text-xs font-semibold text-[#102A43]">病情分析</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{content.analysis}</p>
            </div>
          )}
          {/* 调理方向 */}
          {content.direction && (
            <div className="bg-primary/5 rounded-md p-3 border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Compass className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">调理方向</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{content.direction}</p>
            </div>
          )}
          {/* 具体药方 */}
          {content.prescription && Array.isArray(content.prescription) && content.prescription.length > 0 && (
            <div className="bg-[#F59E0B]/5 rounded-md p-3 border border-[#F59E0B]/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Pill className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="text-xs font-semibold text-[#F59E0B]">具体药方</span>
              </div>
              <div className="space-y-2">
                {content.prescription.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-5 h-5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div>
                      <span className="text-xs font-medium text-foreground">{item.step}</span>
                      <span className="text-xs text-muted-foreground ml-1">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 达标标准 */}
          {content.standard && (
            <div className="bg-[#22c55e]/5 rounded-md p-3 border border-[#22c55e]/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-[#22c55e]" />
                <span className="text-xs font-semibold text-[#22c55e]">达标标准</span>
              </div>
              <div className="space-y-1">
                {content.standard.split(/[；;\n]/).filter(s => s.trim()).map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
                    <span className="text-xs text-foreground">{s.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Fallback to steps */}
          {!content.analysis && !content.prescription && content.steps && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">方案步骤</span>
              </div>
              <div className="space-y-1.5">
                {(content.steps as string[]).map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">{i + 1}</span>
                    <span className="text-xs text-foreground leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback: plan steps when no content object */}
      {planExpanded && !content && entry.planSteps.length > 0 && (
        <div className="px-4 py-3 bg-muted/20 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">方案步骤</span>
          </div>
          <div className="space-y-1.5">
            {entry.planSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                  {i + 1}
                </span>
                <span className="text-xs text-foreground leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Funnel Trend Section                                               */
/* ------------------------------------------------------------------ */

const FUNNEL_STAGES = [
  { key: 'wechatAddRate', label: '加V率', threshold: 90 },
  { key: 'consultationRate', label: '面诊率', threshold: 85 },
  { key: 'receptionRate', label: '接诊率', threshold: 80 },
  { key: 'signRate', label: '签收率', threshold: 60 },
  { key: 'medicationRate', label: '用药率', threshold: 70 },
  { key: 'registrationRate', label: '挂号率', threshold: 50 },
];

function FunnelTrendSection({ members }: { members: Member[] }) {
  // Compute team average for each funnel stage from member resultDetails
  const currentAverages = useMemo(() => {
    return FUNNEL_STAGES.map(stage => {
      const values: number[] = [];
      members.forEach(m => {
        const detail = m.resultDetails[stage.key];
        if (detail && detail.value !== null && detail.value !== undefined) {
          values.push(detail.value);
        }
      });
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return {
        ...stage,
        value: Math.round(avg * 10) / 10,
        aboveThreshold: avg >= stage.threshold,
      };
    });
  }, [members]);

  // Weekly trend data (mock last 4 weeks)
  const weeklyData: WeeklyFunnel[] = [
    {
      week: 'W1 (12/02)',
      stages: [
        { key: 'wechatAddRate', label: '加V率', value: 82, threshold: 90 },
        { key: 'consultationRate', label: '面诊率', value: 78, threshold: 85 },
        { key: 'receptionRate', label: '接诊率', value: 72, threshold: 80 },
        { key: 'signRate', label: '签收率', value: 48, threshold: 60 },
        { key: 'medicationRate', label: '用药率', value: 62, threshold: 70 },
        { key: 'registrationRate', label: '挂号率', value: 38, threshold: 50 },
      ],
    },
    {
      week: 'W2 (12/09)',
      stages: [
        { key: 'wechatAddRate', label: '加V率', value: 85, threshold: 90 },
        { key: 'consultationRate', label: '面诊率', value: 80, threshold: 85 },
        { key: 'receptionRate', label: '接诊率', value: 74, threshold: 80 },
        { key: 'signRate', label: '签收率', value: 52, threshold: 60 },
        { key: 'medicationRate', label: '用药率', value: 65, threshold: 70 },
        { key: 'registrationRate', label: '挂号率', value: 42, threshold: 50 },
      ],
    },
    {
      week: 'W3 (12/16)',
      stages: [
        { key: 'wechatAddRate', label: '加V率', value: 87, threshold: 90 },
        { key: 'consultationRate', label: '面诊率', value: 83, threshold: 85 },
        { key: 'receptionRate', label: '接诊率', value: 76, threshold: 80 },
        { key: 'signRate', label: '签收率', value: 55, threshold: 60 },
        { key: 'medicationRate', label: '用药率', value: 68, threshold: 70 },
        { key: 'registrationRate', label: '挂号率', value: 45, threshold: 50 },
      ],
    },
    {
      week: 'W4 (12/23)',
      stages: currentAverages.map(s => ({
        key: s.key,
        label: s.label,
        value: s.value,
        threshold: s.threshold,
      })),
    },
  ];

  return (
    <div className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
      {/* Section Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">漏斗趋势图</h2>
        <span className="text-xs text-muted-foreground">团队结果线各环节均值 · 近4周趋势</span>
      </div>

      <div className="p-5 space-y-6">
        {/* Current Week Funnel Bars */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">本周团队均值</span>
          </div>
          <div className="flex items-end gap-3 h-48">
            {currentAverages.map((stage, i) => {
              const barHeight = Math.max(stage.value * 1.6, 8); // scale to fit
              const isAbove = stage.aboveThreshold;
              return (
                <div key={stage.key} className="flex-1 flex flex-col items-center gap-2">
                  {/* Bar container */}
                  <div className="relative w-full flex justify-center" style={{ height: 180 }}>
                    {/* Threshold line */}
                    <div
                      className="absolute left-1 right-1 border-t border-dashed border-muted-foreground/40"
                      style={{ bottom: stage.threshold * 1.6 }}
                    >
                      <span className="absolute -top-4 right-0 text-[10px] text-muted-foreground whitespace-nowrap">
                        {stage.threshold}%
                      </span>
                    </div>
                    {/* SVG Bar */}
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 48 180`}
                      preserveAspectRatio="xMidYMax meet"
                      className="overflow-visible"
                    >
                      {/* Bar */}
                      <rect
                        x="8"
                        y={180 - barHeight}
                        width="32"
                        height={barHeight}
                        rx="4"
                        fill={isAbove ? '#22c55e' : '#ef4444'}
                        opacity="0.85"
                      />
                      {/* Value label */}
                      <text
                        x="24"
                        y={180 - barHeight - 6}
                        textAnchor="middle"
                        className="text-[11px] font-semibold"
                        fill={isAbove ? '#22c55e' : '#ef4444'}
                      >
                        {stage.value}%
                      </text>
                    </svg>
                  </div>
                  {/* Stage label */}
                  <span className={`text-[11px] font-medium ${isAbove ? 'text-[#22c55e]' : 'text-destructive'}`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Sparkline Trends */}
        <div className="border-t border-border pt-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">近4周趋势</span>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {FUNNEL_STAGES.map(stage => {
              const stageValues = weeklyData.map(w => {
                const s = w.stages.find(st => st.key === stage.key);
                return s ? s.value : 0;
              });
              const latestValue = stageValues[stageValues.length - 1];
              const prevValue = stageValues[stageValues.length - 2];
              const trendUp = latestValue > prevValue;
              const aboveThreshold = latestValue >= stage.threshold;

              return (
                <div key={stage.key} className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{stage.label}</span>
                    {trendUp ? (
                      <TrendingUp className="w-3 h-3 text-[#22c55e]" />
                    ) : (
                      <TrendingDownIcon className="w-3 h-3 text-destructive" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-lg font-bold ${aboveThreshold ? 'text-[#22c55e]' : 'text-destructive'}`}>
                      {latestValue}
                    </span>
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                  {/* Sparkline SVG */}
                  <SparklineSVG
                    values={stageValues}
                    width={120}
                    height={36}
                    color={aboveThreshold ? '#22c55e' : '#ef4444'}
                    threshold={stage.threshold}
                    maxValue={100}
                  />
                  {/* Week labels */}
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground">W1</span>
                    <span className="text-[9px] text-muted-foreground">W4</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline SVG Component (inline, no library)                       */
/* ------------------------------------------------------------------ */

function SparklineSVG({
  values,
  width,
  height,
  color,
  threshold,
  maxValue,
}: {
  values: number[];
  width: number;
  height: number;
  color: string;
  threshold: number;
  maxValue: number;
}) {
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / Math.max(values.length - 1, 1)) * chartW;
    const y = padding + chartH - (v / maxValue) * chartH;
    return { x, y };
  });

  const thresholdY = padding + chartH - (threshold / maxValue) * chartH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding + chartH} L${points[0].x},${padding + chartH} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Threshold line */}
      <line
        x1={padding}
        y1={thresholdY}
        x2={width - padding}
        y2={thresholdY}
        stroke="currentColor"
        className="text-muted-foreground/30"
        strokeWidth="0.5"
        strokeDasharray="3,2"
      />
      {/* Area fill */}
      <path
        d={areaPath}
        fill={color}
        opacity="0.08"
      />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3 : 2}
          fill={i === points.length - 1 ? color : '#fff'}
          stroke={color}
          strokeWidth={i === points.length - 1 ? 0 : 1.5}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Process / Result Line Tables (kept from original)                  */
/* ------------------------------------------------------------------ */

function ProcessLineTable({ details }: { details: Record<string, any> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <RouteIcon className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">过程线对标</h4>
        </div>
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  const unqualified = entries.filter(([, v]) => v.level === 'unqualified');

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <RouteIcon className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">过程线对标</h4>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
          <span>评估环节</span>
          <span className="text-center">当前值</span>
          <span className="text-center">合格线</span>
          <span className="text-center">状态</span>
        </div>
        {entries.map(([key, item]) => (
          <div
            key={key}
            className={`grid grid-cols-4 px-3 py-2.5 items-center border-t border-border text-sm ${
              item.level === 'unqualified' ? 'bg-destructive/5' : ''
            }`}
          >
            <span className={item.level === 'unqualified' ? 'text-destructive font-medium' : 'text-foreground'}>
              {item.label}
            </span>
            <span className={`text-center font-semibold ${item.level === 'unqualified' ? 'text-destructive' : 'text-[#22c55e]'}`}>
              {item.value ?? '-'}{item.unit || ''}
            </span>
            <span className="text-center text-muted-foreground">
              {item.threshold?.qualified ?? '-'}
            </span>
            <span className="flex justify-center">
              {item.level === 'unqualified' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-destructive/15 text-destructive">
                  不达标
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#22c55e]/15 text-[#22c55e]">
                  达标
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {unqualified.length > 0 && (
        <div className="mt-2 p-3 bg-destructive/5 rounded-md border-t border-destructive/15">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">不合格项诊断</p>
              {unqualified.map(([key, item]) => (
                <p key={key} className="text-xs text-muted-foreground">
                  {item.label} {item.value}{item.unit} &lt; {item.threshold?.qualified} → 需针对性训练
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultLineTable({ details }: { details: Record<string, any> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">结果线对标</h4>
        </div>
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  const unqualified = entries.filter(([, v]) => v.level === 'unqualified');

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">结果线对标</h4>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
          <span>业务指标</span>
          <span className="text-center">当前值</span>
          <span className="text-center">合格线</span>
          <span className="text-center">状态</span>
        </div>
        {entries.map(([key, item]) => (
          <div
            key={key}
            className={`grid grid-cols-4 px-3 py-2.5 items-center border-t border-border text-sm ${
              item.level === 'unqualified' ? 'bg-destructive/5' : ''
            }`}
          >
            <span className={item.level === 'unqualified' ? 'text-destructive font-medium' : 'text-foreground'}>
              {item.label}
            </span>
            <span className={`text-center font-semibold ${item.level === 'unqualified' ? 'text-destructive' : 'text-[#22c55e]'}`}>
              {item.value !== null ? `${item.value}${item.unit || ''}` : '-'}
            </span>
            <span className="text-center text-muted-foreground">
              {item.threshold?.qualified ?? '-'}%
            </span>
            <span className="flex justify-center">
              {item.level === 'unqualified' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-destructive/15 text-destructive">
                  不达标
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#22c55e]/15 text-[#22c55e]">
                  达标
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {unqualified.length > 0 && (
        <div className="mt-2 p-3 bg-destructive/5 rounded-md border-t border-destructive/15">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">不合格项诊断</p>
              {unqualified.map(([key, item]) => (
                <p key={key} className="text-xs text-muted-foreground">
                  {item.label} {item.value}{item.unit} &lt; {item.threshold?.qualified}% → 需针对性赋能
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* ------------------------------------------------------------------ */
/*  Prescription Preview Modal (from Diagnosis page)                   */
/* ------------------------------------------------------------------ */

function PrescriptionPreviewModal({ plan, memberName, onClose, onPush, pushing }: {
  plan: EmpowerPlan;
  memberName: string;
  onClose: () => void;
  onPush: (planId: string) => void;
  pushing: boolean;
}) {
  const content = plan.content;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">推送对象：</span>
                <span className="text-xs font-medium text-foreground">{memberName}</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {content && typeof content === 'object' && (
            <div className="space-y-4">
              {content.analysis && (
                <div className="bg-[#102A43]/5 rounded-lg p-4 border border-[#102A43]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#102A43]/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#102A43]">诊</span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#102A43]">病情分析</h4>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed pl-8">{content.analysis}</p>
                </div>
              )}
              {content.direction && (
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">向</span>
                    </div>
                    <h4 className="text-sm font-semibold text-primary">调理方向</h4>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed pl-8">{content.direction}</p>
                </div>
              )}
              {content.prescription && Array.isArray(content.prescription) && content.prescription.length > 0 && (
                <div className="bg-[#F59E0B]/5 rounded-lg p-4 border border-[#F59E0B]/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#F59E0B]/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#F59E0B]">方</span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#F59E0B]">具体药方</h4>
                  </div>
                  <div className="space-y-3 pl-8">
                    {content.prescription.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="w-6 h-6 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.step}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.duration && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.duration}</span>}
                            {item.responsible && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">负责人：{item.responsible}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {content.standard && (
                <div className="bg-[#22c55e]/5 rounded-lg p-4 border border-[#22c55e]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#22c55e]/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#22c55e]">标</span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#22c55e]">达标标准</h4>
                  </div>
                  <div className="space-y-1.5 pl-8">
                    {content.standard.split(/[；;\n]/).filter(s => s.trim()).map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                        <span className="text-sm text-foreground">{s.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!content.analysis && !content.prescription && content.steps && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">方案内容</h4>
                  <div className="space-y-3">
                    {(content.steps as string[]).map((step: string, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                        <p className="text-sm text-foreground">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">关闭</button>
            <button
              onClick={() => onPush(plan.id)}
              disabled={pushing}
              className="px-5 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />{pushing ? '推送中...' : '推送方案'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
