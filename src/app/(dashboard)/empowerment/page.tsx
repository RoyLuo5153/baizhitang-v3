'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { apiGet, apiPost } from '@/lib/api-client';
import {
  Zap, Plus, Library, PlayCircle, CheckCircle2, Clock, Users, Target,
  MessageCirclePlus, Pill, Mic, BookOpen, ChevronRight, ChevronDown, ArrowRight, TrendingUp,
  MessageSquare, User, Calendar, Star, X, Send, Eye, Search, Compass, BellRing,
  Pencil, Trash2, FileText, Award, AlertTriangle, ChevronLeft,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EmpowerPlan {
  id: string;
  name: string;
  description: string;
  plan_type: string;
  duration_days: number;
  target_metrics: string[];
  target_quadrants: string[];
  content: {
    analysis?: string;
    direction?: string;
    prescription?: { step: string; detail: string; duration?: string; responsible?: string }[];
    standard?: string;
    steps?: string[];
    [key: string]: unknown;
  };
  is_active: boolean;
  estimated_hours?: number;
  indicator_key?: string;
  target_indicators?: string[];
  created_at?: string;
}

interface Execution {
  id: string;
  plan_id: string;
  user_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  progress?: number;
  before_quadrant?: string | null;
  after_quadrant?: string | null;
  improvement_pct?: number | null;
  verification_result: unknown;
  prescription_content?: Record<string, unknown> | null;
  completed_steps?: number[] | null;
  mentor_notes?: string | null;
  plan?: EmpowerPlan;
  // Enriched fields from API
  trainee_name?: string;
  trainee_role_id?: number;
  latest_qc_avg?: number;
  latest_qc_date?: string;
  coaching_count?: number;
}

interface AlertItem {
  userId: string;
  userName: string;
  unqualifiedIndicators: { key: string; label: string; value: number; unit: string; threshold: number }[];
  recommendedPlans: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[];
}

interface CoachingRecord {
  id: number;
  execution_id: number | null;
  mentor_id: string;
  trainee_id: string;
  session_date: string;
  duration_minutes: number;
  content: string;
  mentor_comment: string;
  trainee_feedback: string;
  next_steps: string;
  status: string;
  created_at: string;
  mentor?: { real_name: string };
  trainee?: { real_name: string };
}

const INDICATOR_LABELS: Record<string, string> = {
  qc_communication: '质检-沟通能力',
  qc_professional: '质检-专业能力',
  qc_compliance: '质检-合规执行',
  qc_service: '质检-服务态度',
  qc_service_attitude: '质检-服务态度',
  wechatAddRate: '加V率',
  consultationRate: '面诊率',
  receptionRate: '接诊率',
  deliveryRate: '签收率',
  medicationRate: '用药率',
  appointmentRate: '挂号率',
  learning: '阶段通关',
  qcScore: '质检分数',
  general: '综合提升',
};

const PLAN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  wechatAddRate: { label: '话术提升', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/15' },
  consultationRate: { label: '技能强化', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
  qcScore: { label: '质检提升', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
  medicationRate: { label: '专业提升', color: 'text-[#102A43]', bg: 'bg-[#102A43]/10' },
  general: { label: '综合干预', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/15' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  assigned: { label: '已分配', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
  in_progress: { label: '进行中', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/15' },
  completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
  verified: { label: '已验证', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
};

const QUADRANT_COLOR: Record<string, string> = { A: '#22c55e', B: '#2978B5', C: '#F59E0B', D: '#ef4444' };
const QUADRANT_LABEL: Record<string, string> = { A: '达标', B: '结果待提升', C: '过程待提升', D: '全面待提升' };

/* ------------------------------------------------------------------ */
/*  Helper: get prescription steps from execution                      */
/* ------------------------------------------------------------------ */
function getSteps(execution: Execution): { step: string; detail: string; duration?: string; responsible?: string }[] {
  const plan = execution.plan;
  const content = (execution.prescription_content || plan?.content || {}) as Record<string, unknown>;
  return (content.prescription || []) as { step: string; detail: string; duration?: string; responsible?: string }[];
}

function calcProgress(execution: Execution): number {
  const steps = getSteps(execution);
  const completed = execution.completed_steps || [];
  if (steps.length > 0) return Math.round((completed.length / steps.length) * 100);
  return execution.progress || 0;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EmpowermentPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<EmpowerPlan[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [coachingRecords, setCoachingRecords] = useState<CoachingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'myprescriptions' | 'plans' | 'executing' | 'verified' | 'coaching'>(user?.role === 'trainee' ? 'myprescriptions' : 'executing');
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<EmpowerPlan | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<{ plan: EmpowerPlan; traineeName?: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState<EmpowerPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<EmpowerPlan | null>(null);
  const [pushingPlanId, setPushingPlanId] = useState<string | null>(null);
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);
  const [myExecutions, setMyExecutions] = useState<Execution[]>([]);
  const [myExecLoading, setMyExecLoading] = useState(false);

  // Drill-down state
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [executionDetailCoaching, setExecutionDetailCoaching] = useState<CoachingRecord[]>([]);

  const executingExecs = executions.filter(e => e.status === 'in_progress' || e.status === 'assigned');
  const verifiedExecs = executions.filter(e => e.status === 'completed' || e.status === 'verified');

  const fetchData = useCallback(async () => {
    const [plansResult, alertsResult, execResult, coachingResult] = await Promise.all([
      apiGet<{ plans: EmpowerPlan[] }>('/api/empower', { plans: [] }),
      apiGet<{ alerts: AlertItem[] }>('/api/empower/alerts', { alerts: [] }),
      apiGet<{ executions: Execution[] }>('/api/empower/executions', { executions: [] }),
      apiGet<{ records: CoachingRecord[] }>('/api/empower/coaching', { records: [] }),
    ]);
    setPlans(plansResult.plans);
    setAlerts(alertsResult.alerts);
    setExecutions(execResult.executions);
    setCoachingRecords(coachingResult.records);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    fetchTrainees();
    fetchMyExecutions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTrainees() {
    const result = await apiGet<{ profiles: Record<string, unknown>[] }>('/api/trainee-profiles', { profiles: [] });
    setTrainees(result.profiles.map((p) => ({ id: String(p.user_id || p.id), name: String(p.realName || p.real_name || '') })));
  }

  async function fetchMyExecutions() {
    if (!user?.id) return;
    setMyExecLoading(true);
    const result = await apiGet<{ executions: Execution[] }>(`/api/empower/executions?userId=${user.id}`, { executions: [] });
    setMyExecutions(result.executions);
    setMyExecLoading(false);
  }

  // Drill down: load coaching records for a specific execution
  async function openExecutionDetail(exec: Execution) {
    setSelectedExecution(exec);
    // Fetch coaching records linked to this execution
    const result = await apiGet<{ records: CoachingRecord[] }>(`/api/empower/coaching?executionId=${exec.id}`, { records: [] });
    setExecutionDetailCoaching(result.records);
  }

  async function toggleStep(executionId: string, stepIndex: number, currentSteps: number[]) {
    const newSteps = currentSteps.includes(stepIndex)
      ? currentSteps.filter(s => s !== stepIndex)
      : [...currentSteps, stepIndex];
    const exec = [...myExecutions, ...executions].find(e => e.id === executionId);
    const content = exec?.prescription_content as Record<string, unknown> | undefined;
    const totalSteps = (content?.prescription as unknown[])?.length || 1;
    const progress = Math.round((newSteps.length / totalSteps) * 100);
    try {
      const res = await fetch('/api/empower/executions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          completedSteps: newSteps,
          progress,
          status: progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'assigned',
        }),
      });
      if (res.ok) {
        setMyExecutions(prev => prev.map(e => e.id === executionId ? { ...e, completed_steps: newSteps, progress } : e));
        setExecutions(prev => prev.map(e => e.id === executionId ? { ...e, completed_steps: newSteps, progress } : e));
        if (selectedExecution?.id === executionId) {
          setSelectedExecution(prev => prev ? { ...prev, completed_steps: newSteps, progress } : prev);
        }
      }
    } catch { /* ignore */ }
  }

  async function handlePushPlan(planId: string, userId: string) {
    setPushingPlanId(planId);
    try {
      const res = await fetch('/api/empower/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, traineeId: userId, assignedBy: user?.id }),
      });
      if (res.ok) {
        fetchData();
      } else {
        const json = await res.json();
        alert(json.error || '推送失败');
      }
    } catch {
      alert('操作失败');
    }
    setPushingPlanId(null);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">赋能中心</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">基于双轨诊断结果，精准推送赋能方案并闭环验证</p>
        </div>
        <button
          onClick={() => setShowNewPlanDialog(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />新建方案
        </button>
      </div>

      {/* 待推送预警区域 */}
      {alerts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BellRing className="w-5 h-5 text-[#F59E0B]" />
            <h2 className="text-base font-semibold text-foreground">待推送预警</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#F59E0B]/15 text-[#F59E0b]">{alerts.length}条</span>
          </div>
          <div className="space-y-3">
            {alerts.map(alert => (
              <AlertCard
                key={alert.userId}
                alert={alert}
                plans={plans}
                onPreview={(plan) => setPreviewPlan({ plan, traineeName: alert.userName })}
                onPush={(planId) => handlePushPlan(planId, alert.userId)}
                pushing={pushingPlanId !== null}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit flex-wrap">
        {([
          ...(user?.role === 'trainee' ? [{ key: 'myprescriptions' as const, label: `我的处方 (${myExecutions.length})`, icon: Pill }] : []),
          { key: 'executing' as const, label: `执行中 (${executingExecs.length})`, icon: PlayCircle },
          { key: 'verified' as const, label: `已验证 (${verifiedExecs.length})`, icon: CheckCircle2 },
          { key: 'coaching' as const, label: `辅导记录 (${coachingRecords.length})`, icon: MessageSquare },
          { key: 'plans' as const, label: `方案库 (${plans.length})`, icon: Library },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Content: 我的处方 (trainee) */}
      {activeTab === 'myprescriptions' && user?.role === 'trainee' && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-[#F59E0B]" />
            <h2 className="text-base font-semibold text-foreground">我的处方</h2>
            <span className="text-xs text-muted-foreground">系统根据诊断结果自动推荐的赋能方案</span>
          </div>
          {myExecLoading ? (
            <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div>
          ) : myExecutions.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无处方</p>
              <p className="text-xs text-muted-foreground/60 mt-1">诊断不合格时将自动推荐赋能方案</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myExecutions.map(exec => (
                <MyPrescriptionCard
                  key={exec.id}
                  execution={exec}
                  onToggleStep={(stepIndex) => toggleStep(exec.id, stepIndex, exec.completed_steps || [])}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Content: 执行中 */}
      {activeTab === 'executing' && (
        <div className="space-y-3">
          {executingExecs.length === 0 ? (
            <div className="text-center py-12">
              <PlayCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无执行中的方案</p>
            </div>
          ) : (
            executingExecs.map(exec => (
              <ExecutionSummaryCard
                key={exec.id}
                execution={exec}
                plans={plans}
                onClick={() => openExecutionDetail(exec)}
              />
            ))
          )}
        </div>
      )}

      {/* Content: 已验证 */}
      {activeTab === 'verified' && (
        <div className="space-y-3">
          {verifiedExecs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无已验证的方案</p>
            </div>
          ) : (
            verifiedExecs.map(exec => (
              <ExecutionSummaryCard
                key={exec.id}
                execution={exec}
                plans={plans}
                onClick={() => openExecutionDetail(exec)}
              />
            ))
          )}
        </div>
      )}

      {/* Content: 辅导记录 */}
      {activeTab === 'coaching' && (
        <CoachingTab
          coachingRecords={coachingRecords}
          executions={executions}
          onOpenExecution={openExecutionDetail}
          onRefresh={fetchData}
          userId={user?.id || ''}
          userRole={user?.role || ''}
        />
      )}

      {/* Content: 方案库 */}
      {activeTab === 'plans' && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Library className="w-5 h-5 text-[#2978B5]" />
            <h2 className="text-base font-semibold text-foreground">方案库</h2>
            <span className="text-xs text-muted-foreground">共{plans.length}个方案</span>
          </div>
          <div className="space-y-4">
            {plans.length === 0 ? (
              <div className="text-center py-12">
                <Library className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">暂无赋能方案</p>
              </div>
            ) : (
              plans.map(plan => (
                <PlanCardExpandable
                  key={plan.id}
                  plan={plan}
                  expanded={expandedPlanId === plan.id}
                  onToggle={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                  onPreview={() => setPreviewPlan({ plan })}
                  onEdit={() => setEditingPlan(plan)}
                  onDelete={() => setDeletingPlan(plan)}
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* 执行详情下钻面板 */}
      {selectedExecution && (
        <ExecutionDetailPanel
          execution={selectedExecution}
          plans={plans}
          coachingRecords={executionDetailCoaching}
          userId={user?.id || ''}
          userRole={user?.role || ''}
          onClose={() => setSelectedExecution(null)}
          onRefresh={async () => {
            await fetchData();
            // Re-fetch detail coaching records
            const result = await apiGet<{ records: CoachingRecord[] }>(`/api/empower/coaching?executionId=${selectedExecution.id}`, { records: [] });
            setExecutionDetailCoaching(result.records);
            // Also update the selected execution with latest data
            const execResult = await apiGet<{ executions: Execution[] }>(`/api/empower/executions?planId=${selectedExecution.plan_id}`, { executions: [] });
            const updated = execResult.executions.find(e => e.id === selectedExecution.id);
            if (updated) setSelectedExecution(updated);
          }}
          onToggleStep={(stepIndex) => toggleStep(selectedExecution.id, stepIndex, selectedExecution.completed_steps || [])}
        />
      )}

      {/* 方案处方预览弹窗 */}
      {previewPlan && (
        <PrescriptionPreviewModal
          plan={previewPlan.plan}
          traineeName={previewPlan.traineeName}
          onClose={() => setPreviewPlan(null)}
          onPush={previewPlan.traineeName ? (planId) => {
            const alert = alerts.find(a => a.userName === previewPlan.traineeName);
            if (alert) handlePushPlan(planId, alert.userId);
            setPreviewPlan(null);
          } : undefined}
          pushing={pushingPlanId !== null}
        />
      )}

      {/* 新建方案弹窗 */}
      {showNewPlanDialog && (
        <NewPlanDialog onClose={() => setShowNewPlanDialog(false)} onCreated={() => { setShowNewPlanDialog(false); fetchData(); }} />
      )}

      {/* 编辑方案弹窗 */}
      {editingPlan && (
        <EditPlanDialog plan={editingPlan} onClose={() => setEditingPlan(null)} onSaved={() => { setEditingPlan(null); fetchData(); }} />
      )}

      {/* 删除确认弹窗 */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">确认删除</h3>
            <p className="text-sm text-muted-foreground mb-1">确定要删除方案「{deletingPlan.name}」吗？</p>
            <p className="text-xs text-[#ef4444] mb-6">删除后不可恢复，已有推送记录不受影响</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingPlan(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">取消</button>
              <button onClick={async () => {
                try {
                  const res = await fetch(`/api/empower?id=${deletingPlan.id}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error('删除失败');
                  setDeletingPlan(null);
                  fetchData();
                } catch (err) {
                  console.error('删除赋能方案失败:', err);
                }
              }} className="px-4 py-2 text-sm bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626]">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ExecutionSummaryCard: 执行摘要卡片（赋能对象+进度+质量+可点击下钻）  */
/* ------------------------------------------------------------------ */

function ExecutionSummaryCard({ execution, plans, onClick }: {
  execution: Execution;
  plans: EmpowerPlan[];
  onClick: () => void;
}) {
  const plan = plans.find(p => p.id === execution.plan_id) || execution.plan;
  const content = (execution.prescription_content || plan?.content || {}) as Record<string, unknown>;
  const prescriptionSteps = (content.prescription || []) as { step: string; detail: string; duration?: string; responsible?: string }[];
  const completedSteps = execution.completed_steps || [];
  const doneSteps = completedSteps.length;
  const totalSteps = prescriptionSteps.length;
  const progress = calcProgress(execution);
  const sc = STATUS_CONFIG[execution.status] || STATUS_CONFIG.assigned;
  const typeConfig = PLAN_TYPE_LABELS[plan?.indicator_key || ''] || { label: '专项提升', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/15' };

  // Quality assessment
  const qcAvg = execution.latest_qc_avg || 0;
  const qcLevel = qcAvg >= 4 ? '优秀' : qcAvg >= 3 ? '合格' : qcAvg > 0 ? '待提升' : '暂无';
  const qcColor = qcAvg >= 4 ? 'text-[#22c55e]' : qcAvg >= 3 ? 'text-[#2978B5]' : qcAvg > 0 ? 'text-[#F59E0B]' : 'text-muted-foreground';

  return (
    <div
      className="bg-card rounded-lg shadow-sm border border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="p-5">
        {/* Row 1: 方案名 + 状态 + 进度环 + 箭头 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="text-sm font-semibold text-foreground truncate">{plan?.name || '未知方案'}</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>{typeConfig.label}</span>
            </div>
            {/* 赋能对象 - 关键信息 */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <User className="w-3.5 h-3.5 text-[#2978B5]" />
                {execution.trainee_name || '未知学员'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(execution.started_at).toLocaleDateString()}
              </span>
              {(execution.coaching_count || 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[#2978B5]">
                  <MessageSquare className="w-3 h-3" />
                  {execution.coaching_count}次辅导
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 进度环 */}
            <div className="relative w-11 h-11">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E6E1D8" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={progress >= 100 ? '#22c55e' : '#2978B5'} strokeWidth="3" strokeDasharray={`${progress * 0.942} 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{progress}%</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
        </div>

        {/* Row 2: 三栏信息 - 任务进度 / 质量评估 / 象限变化 */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/30">
          {/* 任务安排进度 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">任务进度</span>
              <span className="text-xs font-semibold text-foreground">{doneSteps}/{totalSteps}</span>
            </div>
            <div className="flex gap-0.5">
              {totalSteps > 0 ? prescriptionSteps.map((_, i: number) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${completedSteps.includes(i) ? 'bg-[#22c55e]' : 'bg-muted'}`} />
              )) : (
                <div className="h-1.5 w-full bg-muted rounded-full" />
              )}
            </div>
          </div>

          {/* 质量评估 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">质量评估</span>
              <span className={`text-xs font-semibold ${qcColor}`}>{qcLevel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className={`w-4 h-4 ${qcColor}`} />
              <span className="text-xs text-foreground">{qcAvg > 0 ? `近5次均分 ${qcAvg}` : '暂无质检'}</span>
            </div>
          </div>

          {/* 象限变化 */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">象限变化</span>
            <div className="flex items-center gap-1.5">
              {execution.before_quadrant ? (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ backgroundColor: (QUADRANT_COLOR[execution.before_quadrant] || '#999') + '20', color: QUADRANT_COLOR[execution.before_quadrant] || '#999' }}
                >
                  {execution.before_quadrant}类
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">--</span>
              )}
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              {execution.after_quadrant ? (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ backgroundColor: (QUADRANT_COLOR[execution.after_quadrant] || '#999') + '20', color: QUADRANT_COLOR[execution.after_quadrant] || '#999' }}
                >
                  {execution.after_quadrant}类
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/50 italic">待验证</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ExecutionDetailPanel: 执行详情下钻面板（侧滑）                     */
/* ------------------------------------------------------------------ */

function ExecutionDetailPanel({ execution, plans, coachingRecords, userId, userRole, onClose, onRefresh, onToggleStep }: {
  execution: Execution;
  plans: EmpowerPlan[];
  coachingRecords: CoachingRecord[];
  userId: string;
  userRole: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onToggleStep: (stepIndex: number) => void;
}) {
  const [mentorNote, setMentorNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNewCoaching, setShowNewCoaching] = useState(false);
  const plan = plans.find(p => p.id === execution.plan_id) || execution.plan;
  const content = (execution.prescription_content || plan?.content || {}) as Record<string, unknown>;
  const prescriptionSteps = (content.prescription || []) as { step: string; detail: string; duration?: string; responsible?: string }[];
  const completedSteps = execution.completed_steps || [];
  const doneSteps = completedSteps.length;
  const totalSteps = prescriptionSteps.length;
  const progress = calcProgress(execution);
  const sc = STATUS_CONFIG[execution.status] || STATUS_CONFIG.assigned;

  // Quality
  const qcAvg = execution.latest_qc_avg || 0;
  const qcLevel = qcAvg >= 4 ? '优秀' : qcAvg >= 3 ? '合格' : qcAvg > 0 ? '待提升' : '暂无';
  const qcColor = qcAvg >= 4 ? 'text-[#22c55e]' : qcAvg >= 3 ? 'text-[#2978B5]' : qcAvg > 0 ? 'text-[#F59E0B]' : 'text-muted-foreground';

  async function submitNote() {
    if (!mentorNote.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/empower/executions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: execution.id, mentorNotes: mentorNote.trim() }),
      });
      setMentorNote('');
      onRefresh();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleVerify() {
    setSaving(true);
    try {
      await fetch('/api/empower/executions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: execution.id, status: 'verified' }),
      });
      onRefresh();
      onClose();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await fetch('/api/empower/executions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: execution.id, status: 'completed', progress: 100 }),
      });
      onRefresh();
    } catch { /* ignore */ }
    setSaving(false);
  }

  const canOperate = userRole === 'mentor' || userRole === 'training_manager' || userRole === 'boss';

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="bg-black/30 flex-1" />
      <div
        className="w-full max-w-2xl bg-card shadow-xl overflow-y-auto h-full animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="sticky top-0 bg-card z-10 px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-foreground">方案执行详情</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
                <span className="text-xs text-muted-foreground">{plan?.name || '未知方案'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canOperate && execution.status === 'in_progress' && (
              <button onClick={handleComplete} disabled={saving} className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#22c55e] text-white hover:bg-[#22c55e]/90 disabled:opacity-50 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />标记完成
              </button>
            )}
            {canOperate && execution.status === 'completed' && (
              <button onClick={handleVerify} disabled={saving} className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />验证通过
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* 赋能对象信息 */}
          <section className="bg-[#2978B5]/5 rounded-lg p-4 border border-[#2978B5]/10">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-[#2978B5]" />
              <span className="text-sm font-semibold text-[#2978B5]">赋能对象</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground">姓名</span>
                <p className="text-sm font-semibold text-foreground">{execution.trainee_name || '未知学员'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">开始时间</span>
                <p className="text-sm text-foreground">{new Date(execution.started_at).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">当前象限</span>
                <p className="text-sm">
                  {execution.before_quadrant ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: (QUADRANT_COLOR[execution.before_quadrant] || '#999') + '20', color: QUADRANT_COLOR[execution.before_quadrant] || '#999' }}
                    >
                      {execution.before_quadrant}类·{QUADRANT_LABEL[execution.before_quadrant] || ''}
                    </span>
                  ) : '未知'}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">质量评估</span>
                <p className={`text-sm font-semibold ${qcColor}`}>
                  {qcAvg > 0 ? `${qcLevel} (均分${qcAvg})` : '暂无质检数据'}
                </p>
              </div>
            </div>
          </section>

          {/* 总进度 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2978B5]" />
                <span className="text-sm font-semibold text-foreground">任务安排进度</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{doneSteps}/{totalSteps} 步</span>
                <span className="text-sm font-bold text-foreground">{progress}%</span>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress >= 100 ? '#22c55e' : progress >= 40 ? '#2978B5' : '#F59E0B',
                }}
              />
            </div>
          </section>

          {/* 处方步骤详情 - 可勾选 */}
          {prescriptionSteps.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-sm font-semibold text-foreground">药方步骤</span>
              </div>
              <div className="space-y-0">
                {prescriptionSteps.map((item, i: number) => {
                  const isCompleted = completedSteps.includes(i);
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => onToggleStep(i)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isCompleted
                              ? 'bg-[#22c55e] text-white'
                              : 'bg-muted text-muted-foreground border-2 border-border hover:border-[#2978B5]'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                        </button>
                        {i < prescriptionSteps.length - 1 && <div className={`w-0.5 flex-1 my-1 ${isCompleted ? 'bg-[#22c55e]/30' : 'bg-border/30'}`} />}
                      </div>
                      <div className={`flex-1 pb-4 ${isCompleted ? 'opacity-60' : ''}`}>
                        <div className={`text-sm font-semibold ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.step}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {item.duration && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.duration}</span>}
                          {item.responsible && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">负责人：{item.responsible}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 病情分析 + 调理方向 + 达标标准 (处方详情) */}
          {content.analysis && (
            <section className="bg-[#102A43]/5 rounded-lg p-4 border border-[#102A43]/10">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-[#102A43]/60" />
                <span className="text-sm font-semibold text-[#102A43]">病情分析</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{String(content.analysis)}</p>
            </section>
          )}

          {content.direction && (
            <section className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#2978B5]" />
              <span className="text-sm font-medium text-[#2978B5]">{String(content.direction)}</span>
            </section>
          )}

          {content.standard && (
            <section className="bg-[#22c55e]/5 rounded-lg p-4 border border-[#22c55e]/10">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[#22c55e]" />
                <span className="text-sm font-semibold text-[#22c55e]">达标标准</span>
              </div>
              <div className="space-y-1">
                {String(content.standard).split(/[；;\n]/).filter(s => s.trim()).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]/60" />
                    <span className="text-sm text-foreground">{s.trim()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 质量监督评估 */}
          <section className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm font-semibold text-foreground">质量监督评估</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${qcColor}`}>{qcAvg > 0 ? qcAvg : '--'}</div>
                <div className="text-xs text-muted-foreground mt-1">近期质检均分</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${progress >= 100 ? 'text-[#22c55e]' : 'text-[#2978B5]'}`}>{progress}%</div>
                <div className="text-xs text-muted-foreground mt-1">任务完成率</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{execution.coaching_count || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">辅导次数</div>
              </div>
            </div>
          </section>

          {/* 闭环验证前后对比 */}
          {(execution.before_quadrant || execution.after_quadrant) && (
            <section className="border border-border/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">闭环验证</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">赋能前:</span>
                  {execution.before_quadrant ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold"
                      style={{ backgroundColor: (QUADRANT_COLOR[execution.before_quadrant] || '#999') + '20', color: QUADRANT_COLOR[execution.before_quadrant] || '#999' }}
                    >
                      {execution.before_quadrant}类·{QUADRANT_LABEL[execution.before_quadrant] || ''}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">--</span>}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <div className="w-8 h-px bg-border" />
                  <ArrowRight className="w-4 h-4" />
                  <div className="w-8 h-px bg-border" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">赋能后:</span>
                  {execution.after_quadrant ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold"
                      style={{ backgroundColor: (QUADRANT_COLOR[execution.after_quadrant] || '#999') + '20', color: QUADRANT_COLOR[execution.after_quadrant] || '#999' }}
                    >
                      {execution.after_quadrant}类·{QUADRANT_LABEL[execution.after_quadrant] || ''}
                    </span>
                  ) : <span className="text-xs text-muted-foreground/50 italic">待验证</span>}
                </div>
                {execution.improvement_pct != null && (
                  <div className="ml-auto flex items-center gap-1 text-xs">
                    <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
                    <span className="text-[#22c55e] font-medium">+{execution.improvement_pct}%</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 带教点评 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#2978B5]" />
              <span className="text-sm font-semibold text-foreground">带教点评</span>
            </div>
            {execution.mentor_notes && (
              <div className="bg-[#2978B5]/5 rounded-md p-3 mb-3 border border-[#2978B5]/10">
                <p className="text-sm text-foreground">{execution.mentor_notes}</p>
              </div>
            )}
            {canOperate && (
              <div className="flex gap-2">
                <input
                  value={mentorNote}
                  onChange={e => setMentorNote(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  placeholder="输入带教点评..."
                />
                <button
                  onClick={submitNote}
                  disabled={saving || !mentorNote.trim()}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />{saving ? '...' : '点评'}
                </button>
              </div>
            )}
          </section>

          {/* 辅导记录 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-sm font-semibold text-foreground">辅导记录</span>
                <span className="text-xs text-muted-foreground">({coachingRecords.length}条)</span>
              </div>
              {canOperate && (
                <button
                  onClick={() => setShowNewCoaching(true)}
                  className="text-xs text-[#2978B5] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />新增辅导
                </button>
              )}
            </div>
            {coachingRecords.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">暂无辅导记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {coachingRecords.map(record => (
                  <div key={record.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{record.session_date}</span>
                        <span>{record.duration_minutes}分钟</span>
                      </div>
                      {record.mentor?.real_name && (
                        <span className="text-xs text-[#2978B5]">带教老师: {record.mentor.real_name}</span>
                      )}
                    </div>
                    {record.content && (
                      <p className="text-sm text-foreground">{record.content}</p>
                    )}
                    {record.mentor_comment && (
                      <div className="bg-[#2978B5]/5 rounded p-2">
                        <span className="text-xs font-semibold text-[#2978B5]">带教评语: </span>
                        <span className="text-xs text-foreground">{record.mentor_comment}</span>
                      </div>
                    )}
                    {record.next_steps && (
                      <div className="bg-primary/5 rounded p-2">
                        <span className="text-xs font-semibold text-primary">后续行动: </span>
                        <span className="text-xs text-foreground">{record.next_steps}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 新建辅导记录表单 */}
          {showNewCoaching && (
            <NewCoachingForm
              executionId={Number(execution.id)}
              traineeId={execution.user_id}
              mentorId={userId}
              onClose={() => setShowNewCoaching(false)}
              onSaved={onRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NewCoachingForm: 新建辅导记录表单                                    */
/* ------------------------------------------------------------------ */

function NewCoachingForm({ executionId, traineeId, mentorId, onClose, onSaved }: {
  executionId: number;
  traineeId: string;
  mentorId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [mentorComment, setMentorComment] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/empower/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          traineeId,
          mentorId,
          content,
          mentorComment,
          nextSteps,
          durationMinutes: duration,
          sessionDate: new Date().toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        await onSaved();
        onClose();
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-foreground">新增辅导记录</h4>
      <div>
        <label className="text-xs font-medium text-muted-foreground">辅导内容 *</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="记录本次辅导的具体内容..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">带教评语</label>
        <textarea value={mentorComment} onChange={e => setMentorComment(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="对学员表现的评估..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">后续行动</label>
        <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="下一步计划..." />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">时长(分钟)</label>
          <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} className="w-20 px-2 py-1 rounded-md border border-border bg-background text-foreground text-sm" min={5} max={180} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">取消</button>
          <button onClick={handleSubmit} disabled={saving || !content.trim()} className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CoachingTab: 辅导记录Tab（联动执行记录）                             */
/* ------------------------------------------------------------------ */

function CoachingTab({ coachingRecords, executions, onOpenExecution, onRefresh, userId, userRole }: {
  coachingRecords: CoachingRecord[];
  executions: Execution[];
  onOpenExecution: (exec: Execution) => void;
  onRefresh: () => Promise<void>;
  userId: string;
  userRole: string;
}) {
  const [showNewCoaching, setShowNewCoaching] = useState(false);
  const canCreate = userRole === 'mentor' || userRole === 'training_manager' || userRole === 'boss';

  // Group coaching records by execution_id
  const groupedByExecution: Record<string, CoachingRecord[]> = {};
  const unlinkedRecords: CoachingRecord[] = [];
  coachingRecords.forEach(record => {
    if (record.execution_id) {
      const key = String(record.execution_id);
      if (!groupedByExecution[key]) groupedByExecution[key] = [];
      groupedByExecution[key].push(record);
    } else {
      unlinkedRecords.push(record);
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">带教老师与学员的一对一辅导记录，关联赋能方案追踪</p>
        {canCreate && (
          <button onClick={() => setShowNewCoaching(true)} className="text-xs text-[#2978B5] hover:underline inline-flex items-center gap-1">
            <Plus className="w-3 h-3" />新增辅导
          </button>
        )}
      </div>

      {/* 按执行记录分组展示 */}
      {Object.entries(groupedByExecution).map(([execId, records]) => {
        const execution = executions.find(e => e.id === execId);
        const plan = execution?.plan || (execution ? null : null);
        return (
          <div key={execId} className="bg-card rounded-lg shadow-sm border border-border/50 overflow-hidden">
            {/* 关联的执行记录头部 - 可点击跳转 */}
            <div
              className="px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
              onClick={() => execution && onOpenExecution(execution)}
            >
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-[#2978B5]" />
                <div>
                  <span className="text-sm font-semibold text-foreground">{plan?.name || `方案 #${execId}`}</span>
                  <span className="text-xs text-muted-foreground ml-2">赋能对象: {execution?.trainee_name || '未知'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{records.length}次辅导</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
            </div>
            {/* 辅导记录列表 */}
            <div className="p-4 space-y-3">
              {records.map(record => (
                <div key={record.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{record.session_date}</span>
                      <span>{record.duration_minutes}分钟</span>
                    </div>
                    {record.mentor?.real_name && (
                      <span className="text-xs text-[#2978B5]">带教老师: {record.mentor.real_name}</span>
                    )}
                  </div>
                  {record.content && <p className="text-sm text-foreground">{record.content}</p>}
                  {record.mentor_comment && (
                    <div className="bg-[#2978B5]/5 rounded p-2">
                      <span className="text-xs font-semibold text-[#2978B5]">带教评语: </span>
                      <span className="text-xs text-foreground">{record.mentor_comment}</span>
                    </div>
                  )}
                  {record.next_steps && (
                    <div className="bg-primary/5 rounded p-2">
                      <span className="text-xs font-semibold text-primary">后续行动: </span>
                      <span className="text-xs text-foreground">{record.next_steps}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 未关联执行记录的辅导 */}
      {unlinkedRecords.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">其他辅导记录</h3>
          {unlinkedRecords.map(record => (
            <div key={record.id} className="bg-card rounded-lg shadow-sm p-4 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{record.session_date}</span>
                  <span>{record.duration_minutes}分钟</span>
                  {record.trainee?.real_name && <span>学员: {record.trainee.real_name}</span>}
                </div>
                {record.mentor?.real_name && (
                  <span className="text-xs text-[#2978B5]">带教老师: {record.mentor.real_name}</span>
                )}
              </div>
              {record.content && <p className="text-sm text-foreground">{record.content}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 无记录 */}
      {coachingRecords.length === 0 && !showNewCoaching && (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无辅导记录</p>
          <p className="text-xs text-muted-foreground/60 mt-1">在方案执行详情中可直接新增辅导记录</p>
        </div>
      )}

      {/* 独立新增辅导表单 */}
      {showNewCoaching && (
        <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">新增辅导记录</h4>
            <button onClick={() => setShowNewCoaching(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <StandaloneCoachingForm
            mentorId={userId}
            trainees={[]}
            executions={executions}
            onSaved={async () => { setShowNewCoaching(false); await onRefresh(); }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StandaloneCoachingForm: 独立辅导记录表单（可关联执行记录）            */
/* ------------------------------------------------------------------ */

function StandaloneCoachingForm({ mentorId, executions, onSaved }: {
  mentorId: string;
  trainees: { id: string; name: string }[];
  executions: Execution[];
  onSaved: () => Promise<void>;
}) {
  const [traineeId, setTraineeId] = useState('');
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [mentorComment, setMentorComment] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  // Filter executions by selected trainee
  const traineeExecutions = executions.filter(e => e.user_id === traineeId && (e.status === 'in_progress' || e.status === 'assigned'));

  async function handleSubmit() {
    if (!traineeId || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/empower/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          traineeId,
          mentorId,
          content,
          mentorComment,
          nextSteps,
          durationMinutes: duration,
          sessionDate: new Date().toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        await onSaved();
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">学员ID *</label>
          <input value={traineeId} onChange={e => { setTraineeId(e.target.value); setExecutionId(null); }} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="输入学员ID" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">关联方案（可选）</label>
          <select
            value={executionId || ''}
            onChange={e => setExecutionId(e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          >
            <option value="">不关联</option>
            {traineeExecutions.map(exec => (
              <option key={exec.id} value={exec.id}>{exec.plan?.name || `方案 #${exec.id}`}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">辅导内容 *</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="记录本次辅导的具体内容..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">带教评语</label>
        <textarea value={mentorComment} onChange={e => setMentorComment(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="对学员表现的评估..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">后续行动</label>
        <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="下一步计划..." />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">时长(分钟)</label>
          <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} className="w-20 px-2 py-1 rounded-md border border-border bg-background text-foreground text-sm" min={5} max={180} />
        </div>
        <button onClick={handleSubmit} disabled={saving || !traineeId || !content.trim()} className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AlertCard: 待推送预警卡片                                           */
/* ------------------------------------------------------------------ */

function AlertCard({ alert, plans, onPreview, onPush, pushing }: {
  alert: AlertItem;
  plans: EmpowerPlan[];
  onPreview: (plan: EmpowerPlan) => void;
  onPush: (planId: string) => void;
  pushing: boolean;
}) {
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 flex items-center justify-between gap-4 border border-border/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-foreground">{alert.userName}</span>
          {alert.unqualifiedIndicators.map(ind => (
            <span key={ind.key} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#ef4444]/15 text-[#ef4444]">
              {ind.label}不合格
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">推荐方案：</span>
          {alert.recommendedPlans.map(rp => {
            const plan = plans.find(p => p.id === rp.planId);
            return (
              <button
                key={rp.planId}
                onClick={() => plan && onPreview(plan)}
                className="text-xs font-medium text-[#2978B5] hover:underline"
              >
                {rp.planName}
                {rp.alreadyPushed && <span className="ml-1 text-[#22c55e]">(已推送)</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {alert.recommendedPlans.filter(rp => !rp.alreadyPushed).map(rp => (
          <button
            key={rp.planId}
            onClick={() => onPush(rp.planId)}
            disabled={pushing}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Send className="w-3 h-3" />一键推送
          </button>
        ))}
        {alert.recommendedPlans.filter(rp => !rp.alreadyPushed).length > 0 && (
          <button
            onClick={() => {
              const plan = plans.find(p => p.id === alert.recommendedPlans.find(rp => !rp.alreadyPushed)?.planId);
              if (plan) onPreview(plan);
            }}
            className="bg-muted text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />查看方案
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PlanCardExpandable: 可展开方案卡片（方案库）                          */
/* ------------------------------------------------------------------ */

function PlanCardExpandable({ plan, expanded, onToggle, onPreview, onEdit, onDelete }: {
  plan: EmpowerPlan; expanded: boolean; onToggle: () => void; onPreview: () => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const typeConfig = PLAN_TYPE_LABELS[plan.indicator_key || ''] || { label: '专项提升', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/15' };
  const content = plan.content;

  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-border/50">
      {/* 折叠头部 */}
      <div className="p-5 cursor-pointer flex items-center justify-between hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-base font-semibold text-foreground">{plan.name}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
              {INDICATOR_LABELS[plan.indicator_key || ''] || plan.indicator_key || '综合提升'}
            </span>
            {content.analysis && (
              <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{content.analysis}</span>
            )}
            {plan.created_at && (
              <span className="text-xs text-muted-foreground">创建于 {new Date(plan.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="编辑方案">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="删除方案">
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronDown className={`w-5 h-5 text-muted-foreground/50 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* 展开详情：4段式处方 */}
      {expanded && (
        <div className="border-t border-border/20 px-5 pb-5 pt-4 space-y-4">
          {/* 病情分析 */}
          {content.analysis && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">病情分析</span>
              </div>
              <div className="bg-muted rounded-md p-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{content.analysis}</p>
              </div>
            </div>
          )}

          {/* 调理方向 */}
          {content.direction && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">调理方向</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-[#2978B5]" />
                <span className="text-sm font-medium text-[#2978B5]">{content.direction}</span>
              </div>
            </div>
          )}

          {/* 具体药方 */}
          {content.prescription && Array.isArray(content.prescription) && content.prescription.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">具体药方</span>
              </div>
              <div className="space-y-0">
                {content.prescription.map((item, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-[#2978B5] text-white flex items-center justify-center text-xs font-bold">{i + 1}</div>
                      {i < content.prescription!.length - 1 && <div className="w-0.5 flex-1 bg-border/30 my-1" />}
                    </div>
                    <div className={i < content.prescription!.length - 1 ? 'pb-4' : ''}>
                      <div className="text-sm font-semibold text-foreground mb-1">{item.step}</div>
                      <div className="text-xs text-muted-foreground mb-1">{item.detail}</div>
                      <div className="flex items-center gap-2">
                        {item.duration && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.duration}</span>
                        )}
                        {item.responsible && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">负责人：{item.responsible}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 达标标准 */}
          {Boolean(content.standard) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">达标标准</span>
              </div>
              <div className="space-y-1.5">
                {content.standard!.split(/[；;\n]/).filter(s => s.trim()).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                    <span className="text-sm text-foreground">{s.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 兼容旧格式 steps */}
          {!content.analysis && !content.prescription && content.steps && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">方案内容</h3>
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

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/20">
            <button
              onClick={(e) => { e.stopPropagation(); onPreview(); }}
              className="bg-muted text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />预览处方
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PrescriptionPreviewModal: 处方预览弹窗                              */
/* ------------------------------------------------------------------ */

function PrescriptionPreviewModal({ plan, traineeName, onClose, onPush, pushing }: {
  plan: EmpowerPlan;
  traineeName?: string;
  onClose: () => void;
  onPush?: (planId: string) => void;
  pushing: boolean;
}) {
  const content = plan.content;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              {traineeName && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">推送对象：</span>
                  <span className="text-xs font-medium text-foreground">{traineeName}</span>
                </div>
              )}
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#2978B5]/15 text-[#2978B5]">
                  {INDICATOR_LABELS[plan.indicator_key || ''] || plan.indicator_key || '综合提升'}
                </span>
                {plan.estimated_hours && (
                  <span className="text-xs text-muted-foreground">预计 {plan.estimated_hours} 学时</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 4段式处方 */}
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
                    {content.prescription.map((item, i: number) => (
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
                <div className="mb-4">
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
            {onPush && (
              <button
                onClick={() => onPush(plan.id)}
                disabled={pushing}
                className="px-5 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />{pushing ? '推送中...' : '一键推送'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MyPrescriptionCard: 新人视角处方卡片（含步骤勾选）                    */
/* ------------------------------------------------------------------ */

function MyPrescriptionCard({ execution, onToggleStep }: {
  execution: Execution;
  onToggleStep: (stepIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const plan = execution.plan;
  const content = (execution.prescription_content || plan?.content || {}) as Record<string, unknown>;
  const completedSteps = execution.completed_steps || [];
  const prescriptionSteps = (content.prescription || []) as { step: string; detail: string; duration?: string; responsible?: string }[];
  const totalSteps = prescriptionSteps.length;
  const doneSteps = completedSteps.length;
  const progress = calcProgress(execution);
  const sc = STATUS_CONFIG[execution.status] || STATUS_CONFIG.assigned;

  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-border/50">
      <div className="p-5 cursor-pointer flex items-center justify-between hover:bg-muted/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-base font-semibold text-foreground">{plan?.name || '赋能方案'}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{INDICATOR_LABELS[plan?.indicator_key || ''] || plan?.indicator_key || '综合提升'}</span>
            <span>开始: {new Date(execution.started_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#E6E1D8" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={progress >= 100 ? '#22c55e' : '#2978B5'} strokeWidth="3" strokeDasharray={`${progress * 0.942} 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{progress}%</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground/50 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/20 px-5 pb-5 pt-4 space-y-4">
          {content.analysis ? (
            <div className="bg-[#102A43]/5 rounded-lg p-3 border border-[#102A43]/10">
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-4 h-4 text-[#102A43]/50" />
                <span className="text-sm font-semibold text-[#102A43]">病情分析</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{String(content.analysis)}</p>
            </div>
          ) : null}
          {content.direction ? (
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#2978B5]" />
              <span className="text-sm font-medium text-[#2978B5]">{String(content.direction)}</span>
            </div>
          ) : null}
          {prescriptionSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-sm font-semibold text-foreground">药方步骤</span>
                <span className="text-xs text-muted-foreground">{doneSteps}/{totalSteps} 已完成</span>
              </div>
              <div className="space-y-0">
                {prescriptionSteps.map((item, i: number) => {
                  const isCompleted = completedSteps.includes(i);
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleStep(i); }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isCompleted ? 'bg-[#22c55e] text-white' : 'bg-muted text-muted-foreground border-2 border-border hover:border-[#2978B5]'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                        </button>
                        {i < prescriptionSteps.length - 1 && <div className={`w-0.5 flex-1 my-1 ${isCompleted ? 'bg-[#22c55e]/30' : 'bg-border/30'}`} />}
                      </div>
                      <div className={`flex-1 pb-4 ${isCompleted ? 'opacity-60' : ''}`}>
                        <div className={`text-sm font-semibold ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.step}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {item.duration && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.duration}</span>}
                          {item.responsible && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.responsible}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {content.standard ? (
            <div className="bg-[#22c55e]/5 rounded-lg p-3 border border-[#22c55e]/10">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[#22c55e]" />
                <span className="text-sm font-semibold text-[#22c55e]">达标标准</span>
              </div>
              <div className="space-y-1">
                {String(content.standard).split(/[；;\n]/).filter(s => s.trim()).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]/60" />
                    <span className="text-sm text-foreground">{s.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {execution.mentor_notes ? (
            <div className="bg-[#2978B5]/5 rounded-lg p-3 border border-[#2978B5]/10">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-[#2978B5]" />
                <span className="text-sm font-semibold text-[#2978B5]">带教点评</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{execution.mentor_notes}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EditPlanDialog: 编辑赋能方案弹窗                                     */
/* ------------------------------------------------------------------ */

function EditPlanDialog({ plan, onClose, onSaved }: { plan: EmpowerPlan; onClose: () => void; onSaved: () => void }) {
  const content = plan.content as Record<string, unknown>;
  const prescriptionArr = Array.isArray(content?.prescription) ? content.prescription as Array<Record<string, string>> : [];
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [duration, setDuration] = useState(plan.duration_days);
  const [targetMetrics, setTargetMetrics] = useState<string[]>(plan.target_indicators || []);
  const [analysis, setAnalysis] = useState(String(content?.analysis || ''));
  const [direction, setDirection] = useState(String(content?.direction || ''));
  const [prescriptionSteps, setPrescriptionSteps] = useState(
    prescriptionArr.length > 0
      ? prescriptionArr.map(s => ({ step: String(s.step || ''), detail: String(s.detail || ''), duration: String(s.duration || ''), responsible: String(s.responsible || '') }))
      : [{ step: '', detail: '', duration: '', responsible: '' }]
  );
  const [standard, setStandard] = useState(String(content?.standard || ''));
  const [saving, setSaving] = useState(false);

  const metricOptions = [
    { key: 'wechatAddRate', label: '加V率' },
    { key: 'consultationRate', label: '面诊率' },
    { key: 'receptionRate', label: '接诊率' },
    { key: 'deliveryRate', label: '签收率' },
    { key: 'medicationRate', label: '用药率' },
    { key: 'appointmentRate', label: '挂号率' },
    { key: 'qcScore', label: '质检分数' },
    { key: 'qc_communication', label: '沟通表达' },
    { key: 'qc_professional', label: '流程规范' },
    { key: 'qc_service', label: '服务态度' },
    { key: 'general', label: '综合提升' },
  ];

  function addStep() { setPrescriptionSteps(prev => [...prev, { step: '', detail: '', duration: '', responsible: '' }]); }
  function removeStep(index: number) { setPrescriptionSteps(prev => prev.filter((_, i) => i !== index)); }
  function updateStep(index: number, field: string, value: string) {
    setPrescriptionSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const newContent = {
        analysis: analysis || undefined,
        direction: direction || undefined,
        prescription: prescriptionSteps.filter(s => s.step.trim()).map(s => ({
          step: s.step, detail: s.detail,
          ...(s.duration ? { duration: s.duration } : {}),
          ...(s.responsible ? { responsible: s.responsible } : {}),
        })),
        standard: standard || undefined,
      };
      const res = await fetch('/api/empower', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, name, description, durationDays: duration, targetMetrics, planType: targetMetrics[0] || plan.plan_type, content: newContent }),
      });
      if (res.ok) onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">编辑赋能方案</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">方案名称 *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：加V率提升方案" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">预计天数</label>
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 7)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" min={1} max={30} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">对标指标（可多选）</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {metricOptions.map(opt => (
                  <button key={opt.key} onClick={() => setTargetMetrics(prev => prev.includes(opt.key) ? prev.filter(m => m !== opt.key) : [...prev, opt.key])}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${targetMetrics.includes(opt.key) ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Search className="w-3.5 h-3.5 text-[#102A43]" />病情分析（根本原因）</label>
              <textarea value={analysis} onChange={e => setAnalysis(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="如：加V率低于60%，说明首通电话未能有效传递价值..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-primary" />调理方向</label>
              <input value={direction} onChange={e => setDirection(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：强化首通电话安全感建立能力" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-[#F59E0B]" />具体药方</label>
                <button onClick={addStep} className="text-xs text-[#2978B5] hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />添加步骤</button>
              </div>
              <div className="space-y-3">
                {prescriptionSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-6 h-6 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-2">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input value={step.step} onChange={e => updateStep(i, 'step', e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="步骤名称" />
                      <input value={step.detail} onChange={e => updateStep(i, 'detail', e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="具体说明" />
                      <input value={step.duration} onChange={e => updateStep(i, 'duration', e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：3天" />
                      <div className="flex gap-2">
                        <input value={step.responsible} onChange={e => updateStep(i, 'responsible', e.target.value)} className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="负责人：如带教老师" />
                        {prescriptionSteps.length > 1 && (
                          <button onClick={() => removeStep(i)} className="text-[#ef4444] hover:text-[#ef4444]/70 px-2"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-[#22c55e]" />达标标准</label>
              <textarea value={standard} onChange={e => setStandard(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="如：连续2周加V率≥60%" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">方案描述（补充说明）</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="描述方案内容与目标..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NewPlanDialog: 新建方案弹窗（4段式处方）                             */
/* ------------------------------------------------------------------ */

function NewPlanDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(7);
  const [targetMetrics, setTargetMetrics] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [direction, setDirection] = useState('');
  const [prescriptionSteps, setPrescriptionSteps] = useState([{ step: '', detail: '', duration: '', responsible: '' }]);
  const [standard, setStandard] = useState('');
  const [saving, setSaving] = useState(false);

  const metricOptions = [
    { key: 'wechatAddRate', label: '加V率' },
    { key: 'consultationRate', label: '面诊率' },
    { key: 'receptionRate', label: '接诊率' },
    { key: 'deliveryRate', label: '签收率' },
    { key: 'medicationRate', label: '用药率' },
    { key: 'appointmentRate', label: '挂号率' },
    { key: 'qcScore', label: '质检分数' },
    { key: 'qc_communication', label: '沟通表达' },
    { key: 'qc_professional', label: '流程规范' },
    { key: 'qc_service', label: '服务态度' },
    { key: 'general', label: '综合提升' },
  ];

  function addStep() { setPrescriptionSteps(prev => [...prev, { step: '', detail: '', duration: '', responsible: '' }]); }
  function removeStep(index: number) { setPrescriptionSteps(prev => prev.filter((_, i) => i !== index)); }
  function updateStep(index: number, field: string, value: string) {
    setPrescriptionSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const content = {
        analysis: analysis || undefined,
        direction: direction || undefined,
        prescription: prescriptionSteps.filter(s => s.step.trim()).map(s => ({
          step: s.step, detail: s.detail,
          ...(s.duration ? { duration: s.duration } : {}),
          ...(s.responsible ? { responsible: s.responsible } : {}),
        })),
        standard: standard || undefined,
      };
      const res = await fetch('/api/empower', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, durationDays: duration, targetMetrics, planType: targetMetrics[0] || 'general', content }),
      });
      if (res.ok) onCreated();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">新建赋能方案</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">方案名称 *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：加V率提升方案" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">预计天数</label>
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 7)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" min={1} max={30} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">对标指标（可多选）</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {metricOptions.map(opt => (
                  <button key={opt.key} onClick={() => setTargetMetrics(prev => prev.includes(opt.key) ? prev.filter(m => m !== opt.key) : [...prev, opt.key])}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${targetMetrics.includes(opt.key) ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Search className="w-3.5 h-3.5 text-[#102A43]" />病情分析（根本原因）</label>
              <textarea value={analysis} onChange={e => setAnalysis(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="如：加V率低于60%，说明首通电话未能有效传递价值..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-primary" />调理方向</label>
              <input value={direction} onChange={e => setDirection(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：强化首通电话安全感建立能力" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-[#F59E0B]" />具体药方</label>
                <button onClick={addStep} className="text-xs text-[#2978B5] hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />添加步骤</button>
              </div>
              <div className="space-y-3">
                {prescriptionSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-6 h-6 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-2">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input value={step.step} onChange={e => updateStep(i, 'step', e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="步骤名称" />
                      <input value={step.detail} onChange={e => updateStep(i, 'detail', e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="具体说明" />
                      <input value={step.duration} onChange={e => updateStep(i, 'duration', e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：3天" />
                      <div className="flex gap-2">
                        <input value={step.responsible} onChange={e => updateStep(i, 'responsible', e.target.value)} className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="负责人：如带教老师" />
                        {prescriptionSteps.length > 1 && (
                          <button onClick={() => removeStep(i)} className="text-[#ef4444] hover:text-[#ef4444]/70 px-2"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-[#22c55e]" />达标标准</label>
              <textarea value={standard} onChange={e => setStandard(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="如：连续2周加V率≥60%；首通电话质检评分≥4分" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">方案描述（补充说明）</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} placeholder="描述方案内容与目标..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? '保存中...' : '创建方案'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
