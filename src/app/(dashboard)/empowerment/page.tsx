'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { apiGet, apiPost } from '@/lib/api-client';
import {
  Zap, Plus, Library, PlayCircle, CheckCircle2, Clock, Users, Target,
  MessageCirclePlus, Pill, Mic, BookOpen, ChevronRight, ChevronDown, ArrowRight, TrendingUp,
  MessageSquare, User, Calendar, Star, X, Send, Eye, Search, Compass, BellRing,
  Pencil, Trash2,
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
}

interface AlertItem {
  userId: string;
  userName: string;
  unqualifiedIndicators: { key: string; label: string; value: number; unit: string; threshold: number }[];
  recommendedPlans: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[];
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EmpowermentPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<EmpowerPlan[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [coachingRecords, setCoachingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'myprescriptions' | 'plans' | 'executing' | 'verified' | 'coaching'>(user?.role === 'trainee' ? 'myprescriptions' : 'plans');
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

  useEffect(() => {
    fetchData();
    fetchTrainees();
    fetchMyExecutions();
  }, []);

  async function fetchTrainees() {
    const result = await apiGet<{ profiles: Record<string, unknown>[] }>('/api/trainee-profiles', { profiles: [] });
    setTrainees(result.profiles.map((p) => ({ id: String(p.user_id || p.id), name: String(p.realName || p.real_name || '') })));
  }

  async function fetchMyExecutions() {
    if (!user?.id) return;
    setMyExecLoading(true);
    const result = await apiGet<{ executions: any[] }>(`/api/empower/executions?userId=${user.id}`, { executions: [] });
    setMyExecutions(result.executions);
    setMyExecLoading(false);
  }

  async function toggleStep(executionId: string, stepIndex: number, currentSteps: number[]) {
    const newSteps = currentSteps.includes(stepIndex)
      ? currentSteps.filter(s => s !== stepIndex)
      : [...currentSteps, stepIndex];
    const content = myExecutions.find(e => e.id === executionId)?.prescription_content as Record<string, unknown> | undefined;
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
      }
    } catch { /* ignore */ }
  }

  async function fetchData() {
    const [plansResult, alertsResult, execResult, coachingResult] = await Promise.all([
      apiGet<{ plans: any[] }>('/api/empower', { plans: [] }),
      apiGet<{ alerts: any[] }>('/api/empower/alerts', { alerts: [] }),
      apiGet<{ executions: any[] }>('/api/empower/executions', { executions: [] }),
      apiGet<{ records: any[] }>('/api/empower/coaching', { records: [] }),
    ]);
    setPlans(plansResult.plans);
    setAlerts(alertsResult.alerts);
    setExecutions(execResult.executions);
    setCoachingRecords(coachingResult.records);
    setLoading(false);
  }

  const executingExecs = executions.filter(e => e.status === 'in_progress' || e.status === 'assigned');
  const verifiedExecs = executions.filter(e => e.status === 'completed' || e.status === 'verified');

  // 推送方案给新人
  async function handlePushPlan(planId: string, userId: string) {
    setPushingPlanId(planId);
    try {
      const res = await fetch('/api/empower/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, traineeId: userId, assignedBy: user?.id }),
      });
      if (res.ok) {
        // 刷新数据
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
          { key: 'plans' as const, label: `方案库 (${plans.length})`, icon: Library },
          { key: 'executing' as const, label: `执行中 (${executingExecs.length})`, icon: PlayCircle },
          { key: 'verified' as const, label: `已验证 (${verifiedExecs.length})`, icon: CheckCircle2 },
          { key: 'coaching' as const, label: `辅导记录 (${coachingRecords.length})`, icon: MessageSquare },
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

      {/* Content */}
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

      {activeTab === 'executing' && (
        <div className="space-y-3">
          {executingExecs.length === 0 ? (
            <div className="text-center py-12">
              <PlayCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无执行中的方案</p>
            </div>
          ) : (
            executingExecs.map(exec => (
              <MentorExecutionCard key={exec.id} execution={exec} plans={plans} />
            ))
          )}
        </div>
      )}

      {activeTab === 'verified' && (
        <div className="space-y-3">
          {verifiedExecs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无已验证的方案</p>
            </div>
          ) : (
            verifiedExecs.map(exec => (
              <ExecutionCard key={exec.id} execution={exec} plans={plans} />
            ))
          )}
        </div>
      )}

      {activeTab === 'coaching' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">带教老师与学员的一对一辅导记录</p>
          {coachingRecords.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无辅导记录</p>
            </div>
          ) : (
            coachingRecords.map((record: any) => (
              <div key={record.id} className="bg-card rounded-lg shadow-sm p-5 border border-border/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-[#F59E0B]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{record.topic}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>带教老师: {record.mentor_name}</span>
                        <span>学员: {record.trainee_name}</span>
                        <span>{record.coaching_date}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-xs font-semibold text-muted-foreground">辅导内容</span>
                    <p className="text-sm text-foreground mt-1">{record.content}</p>
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                    <span className="text-xs font-semibold text-primary">行动项</span>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{record.action_items}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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

  function addStep() {
    setPrescriptionSteps(prev => [...prev, { step: '', detail: '', duration: '', responsible: '' }]);
  }

  function removeStep(index: number) {
    setPrescriptionSteps(prev => prev.filter((_, i) => i !== index));
  }

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
          step: s.step,
          detail: s.detail,
          ...(s.duration ? { duration: s.duration } : {}),
          ...(s.responsible ? { responsible: s.responsible } : {}),
        })),
        standard: standard || undefined,
      };

      const res = await fetch('/api/empower', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plan.id,
          name,
          description,
          durationDays: duration,
          targetMetrics,
          planType: targetMetrics[0] || plan.plan_type,
          content: newContent,
        }),
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
                  <button
                    key={opt.key}
                    onClick={() => setTargetMetrics(prev => prev.includes(opt.key) ? prev.filter(m => m !== opt.key) : [...prev, opt.key])}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      targetMetrics.includes(opt.key)
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                    }`}
                  >
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
              <input value={direction} onChange={e => setDirection(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：强化首通电话价值传递能力" />
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
              {/* 病情分析 */}
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

              {/* 调理方向 */}
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

              {/* 具体药方 */}
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
                        <span className="w-6 h-6 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
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

              {/* 达标标准 */}
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

              {/* 兼容旧格式 */}
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

          {/* Footer */}
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
/*  MentorExecutionCard: 带教视角执行卡片（含带教点评+步骤追踪）          */
/* ------------------------------------------------------------------ */

function MentorExecutionCard({ execution, plans }: { execution: Execution; plans: EmpowerPlan[] }) {
  const [mentorNote, setMentorNote] = useState('');
  const [saving, setSaving] = useState(false);
  const plan = plans.find(p => p.id === execution.plan_id) || execution.plan;
  const content = (execution.prescription_content || plan?.content || {}) as Record<string, unknown>;
  const completedSteps = execution.completed_steps || [];
  const prescriptionSteps = (content.prescription || []) as { step: string; detail: string; duration?: string; responsible?: string }[];
  const doneSteps = completedSteps.length;
  const totalSteps = prescriptionSteps.length;
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : (execution.progress || 0);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    assigned: { label: '已分配', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
    in_progress: { label: '进行中', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/15' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
    verified: { label: '已验证', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
  };
  const sc = statusConfig[execution.status] || statusConfig.assigned;

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
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="bg-card rounded-lg shadow-sm p-5 border border-border/50">
      {/* 头部信息 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{plan?.name || '未知方案'}</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              开始: {new Date(execution.started_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#E6E1D8" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke={progress >= 100 ? '#22c55e' : '#2978B5'} strokeWidth="3" strokeDasharray={`${progress * 0.942} 100`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{progress}%</span>
        </div>
      </div>

      {/* 步骤进度 */}
      {prescriptionSteps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-xs font-semibold text-foreground">步骤进度</span>
            <span className="text-xs text-muted-foreground">{doneSteps}/{totalSteps}</span>
          </div>
          <div className="flex gap-1">
            {prescriptionSteps.map((_, i) => (
              <div key={i} className={`h-2 flex-1 rounded-full ${completedSteps.includes(i) ? 'bg-[#22c55e]' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
      )}

      {/* 带教点评 */}
      <div className="mt-3 pt-3 border-t border-border/50">
        {execution.mentor_notes && (
          <div className="bg-[#2978B5]/5 rounded-md p-3 mb-3 border border-[#2978B5]/10">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-[#2978B5]" />
              <span className="text-xs font-semibold text-[#2978B5]">带教点评</span>
            </div>
            <p className="text-sm text-foreground">{execution.mentor_notes}</p>
          </div>
        )}
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ExecutionCard: 执行记录卡片                                         */
/* ------------------------------------------------------------------ */

function ExecutionCard({ execution, plans }: { execution: Execution; plans: EmpowerPlan[] }) {
  const plan = plans.find(p => p.id === execution.plan_id) || execution.plan;
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    assigned: { label: '已分配', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
    in_progress: { label: '进行中', color: 'text-primary', bg: 'bg-primary/15' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
    verified: { label: '已验证', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
  };
  const sc = statusConfig[execution.status] || statusConfig.assigned;

  const quadrantColor: Record<string, string> = { A: '#22c55e', B: '#2978B5', C: '#F59E0B', D: '#ef4444' };
  const quadrantLabel: Record<string, string> = { A: '达标', B: '结果待提升', C: '过程待提升', D: '全面待提升' };

  return (
    <div className="bg-card rounded-lg shadow-sm p-5 border border-border/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{plan?.name || '未知方案'}</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              开始: {new Date(execution.started_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* 闭环验证前后对比 */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">赋能前:</span>
            {execution.before_quadrant && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold"
                style={{ backgroundColor: (quadrantColor[execution.before_quadrant] || '#999') + '20', color: quadrantColor[execution.before_quadrant] || '#999' }}
              >
                {execution.before_quadrant}类·{quadrantLabel[execution.before_quadrant] || ''}
              </span>
            )}
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
                style={{ backgroundColor: (quadrantColor[execution.after_quadrant] || '#999') + '20', color: quadrantColor[execution.after_quadrant] || '#999' }}
              >
                {execution.after_quadrant}类·{quadrantLabel[execution.after_quadrant] || ''}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">待验证</span>
            )}
          </div>
          {execution.improvement_pct != null && (
            <div className="ml-auto flex items-center gap-1 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
              <span className="text-[#22c55e] font-medium">+{execution.improvement_pct}%</span>
            </div>
          )}
        </div>

        {execution.status !== 'assigned' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">执行进度</span>
              <span className="font-medium text-foreground">{execution.progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${execution.progress ?? 0}%`,
                  backgroundColor: (execution.progress ?? 0) >= 80 ? '#22c55e' : (execution.progress ?? 0) >= 40 ? '#2978B5' : '#F59E0B',
                }}
              />
            </div>
          </div>
        )}
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
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : (execution.progress || 0);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    assigned: { label: '待执行', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
    in_progress: { label: '进行中', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/15' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
    verified: { label: '已验证', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
  };
  const sc = statusConfig[execution.status] || statusConfig.assigned;

  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-border/50">
      {/* 头部 */}
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
          {/* 进度环 */}
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

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t border-border/20 px-5 pb-5 pt-4 space-y-4">
          {/* 病情分析 */}
          {content.analysis ? (
            <div className="bg-[#102A43]/5 rounded-lg p-3 border border-[#102A43]/10">
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-4 h-4 text-[#102A43]/50" />
                <span className="text-sm font-semibold text-[#102A43]">病情分析</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{String(content.analysis)}</p>
            </div>
          ) : null}

          {/* 调理方向 */}
          {content.direction ? (
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#2978B5]" />
              <span className="text-sm font-medium text-[#2978B5]">{String(content.direction)}</span>
            </div>
          ) : null}

          {/* 药方步骤 - 可勾选 */}
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
                          {item.responsible && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.responsible}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 达标标准 */}
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

          {/* 带教点评 */}
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

  function addStep() {
    setPrescriptionSteps(prev => [...prev, { step: '', detail: '', duration: '', responsible: '' }]);
  }

  function removeStep(index: number) {
    setPrescriptionSteps(prev => prev.filter((_, i) => i !== index));
  }

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
          step: s.step,
          detail: s.detail,
          ...(s.duration ? { duration: s.duration } : {}),
          ...(s.responsible ? { responsible: s.responsible } : {}),
        })),
        standard: standard || undefined,
      };

      const res = await fetch('/api/empower', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          durationDays: duration,
          targetMetrics,
          planType: targetMetrics[0] || 'general',
          content,
        }),
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
            {/* 基础信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">方案名称 *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  placeholder="如：加V率提升方案"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">预计天数</label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value) || 7)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  min={1} max={30}
                />
              </div>
            </div>

            {/* 对标指标 */}
            <div>
              <label className="text-sm font-medium text-foreground">对标指标（可多选）</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {metricOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTargetMetrics(prev => prev.includes(opt.key) ? prev.filter(m => m !== opt.key) : [...prev, opt.key])}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      targetMetrics.includes(opt.key)
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 病情分析 */}
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#102A43]" />病情分析（根本原因）
              </label>
              <textarea
                value={analysis}
                onChange={e => setAnalysis(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                rows={2}
                placeholder="如：加V率低于60%，说明首通电话未能有效传递价值，患者缺乏信任感..."
              />
            </div>

            {/* 调理方向 */}
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-primary" />调理方向
              </label>
              <input
                value={direction}
                onChange={e => setDirection(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                placeholder="如：强化首通电话价值传递能力，提升患者信任度"
              />
            </div>

            {/* 具体药方 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-[#F59E0B]" />具体药方
                </label>
                <button onClick={addStep} className="text-xs text-[#2978B5] hover:underline inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" />添加步骤
                </button>
              </div>
              <div className="space-y-3">
                {prescriptionSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-6 h-6 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-2">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        value={step.step}
                        onChange={e => updateStep(i, 'step', e.target.value)}
                        className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                        placeholder="步骤名称"
                      />
                      <input
                        value={step.detail}
                        onChange={e => updateStep(i, 'detail', e.target.value)}
                        className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                        placeholder="具体说明"
                      />
                      <input
                        value={step.duration}
                        onChange={e => updateStep(i, 'duration', e.target.value)}
                        className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                        placeholder="如：3天"
                      />
                      <div className="flex gap-2">
                        <input
                          value={step.responsible}
                          onChange={e => updateStep(i, 'responsible', e.target.value)}
                          className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                          placeholder="负责人：如带教老师"
                        />
                        {prescriptionSteps.length > 1 && (
                          <button onClick={() => removeStep(i)} className="text-[#ef4444] hover:text-[#ef4444]/70 px-2">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 达标标准 */}
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#22c55e]" />达标标准
              </label>
              <textarea
                value={standard}
                onChange={e => setStandard(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                rows={2}
                placeholder="如：连续2周加V率≥60%；首通电话质检评分≥4分"
              />
            </div>

            {/* 方案描述 */}
            <div>
              <label className="text-sm font-medium text-foreground">方案描述（补充说明）</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                rows={2}
                placeholder="描述方案内容与目标..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">取消</button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? '保存中...' : '创建方案'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
