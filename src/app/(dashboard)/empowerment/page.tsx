'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  Zap, Plus, Library, PlayCircle, CheckCircle2, Clock, Users, Target,
  MessageCirclePlus, Pill, Mic, BookOpen, ChevronRight, ArrowRight, TrendingUp,
  MessageSquare, User, Calendar, Star, X,
} from 'lucide-react';

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
    prescription?: { step: string; detail: string }[];
    standard?: string;
    steps?: string[];
    [key: string]: unknown;
  };
  is_active: boolean;
  estimated_hours?: number;
  indicator_key?: string;
  target_indicators?: string[];
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
  verification_result: any;
  plan?: EmpowerPlan;
}

type TabType = 'plans' | 'executing' | 'verified' | 'coaching';

interface CoachingRecord {
  id: number;
  mentor_id: string;
  mentor_name: string;
  trainee_id: string;
  trainee_name: string;
  coaching_date: string;
  topic: string;
  content: string;
  action_items: string;
  next_date: string | null;
  created_at: string;
}

const MOCK_COACHING: CoachingRecord[] = [
  { id: 1, mentor_id: '6', mentor_name: '陈带教老师', trainee_id: '1', trainee_name: '张小红', coaching_date: '2025-06-05', topic: '微信加V沟通改善', content: '分析了近一周微信沟通记录，发现开场白过于生硬，需调整为更自然的问候方式', action_items: '1. 练习自然开场白服务用语\n2. 录制3段加V沟通演练\n3. 下周提交改进效果', next_date: '2025-06-12', created_at: '2025-06-05T10:00:00Z' },
  { id: 2, mentor_id: '6', mentor_name: '陈带教老师', trainee_id: '2', trainee_name: '李大伟', coaching_date: '2025-06-04', topic: '质检扣分项分析', content: '梳理了最近3次质检扣分点，主要集中在规范执行维度，需要加强流程合规意识', action_items: '1. 复习质检标准细则\n2. 每日自查清单\n3. 连续2周规范执行评分达85+', next_date: '2025-06-11', created_at: '2025-06-04T14:00:00Z' },
  { id: 3, mentor_id: '7', mentor_name: '周带教老师', trainee_id: '3', trainee_name: '王美玲', coaching_date: '2025-06-03', topic: '面诊邀约率提升', content: '面诊邀约率连续2周不达标，分析原因为邀约服务用语不够有说服力', action_items: '1. 学习优秀面诊邀约服务用语模板\n2. 角色扮演练习\n3. 记录每日邀约结果', next_date: '2025-06-10', created_at: '2025-06-03T09:00:00Z' },
];

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

const PLAN_ICONS: Record<string, any> = {
  wechatAddRate: MessageCirclePlus,
  medicationRate: Pill,
  qcScore: Mic,
  learning: BookOpen,
  default: Target,
};

export default function EmpowermentPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<EmpowerPlan[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [coachingRecords, setCoachingRecords] = useState<CoachingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('plans');
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [showNewCoachingDialog, setShowNewCoachingDialog] = useState(false);
  const [showTempTaskDialog, setShowTempTaskDialog] = useState(false);
  const [tempTask, setTempTask] = useState({ title: '', description: '', taskTag: '', assignedTo: '', deadline: '' });
  const [trainees, setTrainees] = useState<{id: string; name: string}[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EmpowerPlan | null>(null);

  useEffect(() => {
    fetchData();
    fetchTrainees();
  }, []);

  async function fetchTrainees() {
    try {
      const res = await fetch('/api/trainee-profiles');
      if (res.ok) {
        const json = await res.json();
        setTrainees((json.profiles || []).map((p: Record<string, unknown>) => ({ id: String(p.user_id || p.id), name: String(p.realName || p.real_name || '') })));
      }
    } catch { /* ignore */ }
  }

  async function fetchData() {
    try {
      const [plansRes, execRes, coachingRes] = await Promise.all([
        fetch('/api/empower'),
        fetch('/api/empower/executions'),
        fetch('/api/empower/coaching'),
      ]);
      if (plansRes.ok) {
        const json = await plansRes.json();
        setPlans(json.plans || []);
      }
      if (execRes.ok) {
        const json = await execRes.json();
        setExecutions(json.executions || []);
      }
      if (coachingRes.ok) {
        const json = await coachingRes.json();
        setCoachingRecords(json.records || []);
      }
    } catch {
      // Use mock data
      setCoachingRecords(MOCK_COACHING);
    }
    setLoading(false);
  }

  const executingExecs = executions.filter(e => e.status === 'in_progress' || e.status === 'assigned');
  const verifiedExecs = executions.filter(e => e.status === 'completed' || e.status === 'verified');

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTempTaskDialog(true)}
            className="border border-primary text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/5 active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            <Mic className="w-3.5 h-3.5" />创建临时演练任务
          </button>
          <button
            onClick={() => setShowNewPlanDialog(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />新建方案
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'plans', label: '方案库', icon: Library },
          { key: 'executing', label: `执行中 (${executingExecs.length})`, icon: PlayCircle },
          { key: 'verified', label: `已验证 (${verifiedExecs.length})`, icon: CheckCircle2 },
          { key: 'coaching', label: `辅导记录 (${coachingRecords.length})`, icon: MessageSquare },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-2 gap-4">
          {plans.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <Library className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无赋能方案</p>
            </div>
          ) : (
            plans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onSelect={(p) => setSelectedPlan(p)} />
            ))
          )}
        </div>
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
              <ExecutionCard key={exec.id} execution={exec} plans={plans} />
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">带教老师与学员的一对一辅导记录，包含问题分析与行动计划</p>
            <button
              onClick={() => setShowNewCoachingDialog(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />新建辅导记录
            </button>
          </div>

          {coachingRecords.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无辅导记录</p>
            </div>
          ) : (
            coachingRecords.map(record => (
              <div key={record.id} className="bg-card rounded-lg shadow-card p-5 border border-border/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-[#f59e0b]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{record.topic}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />带教老师: {record.mentor_name}</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />学员: {record.trainee_name}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{record.coaching_date}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">辅导内容</span>
                    <p className="text-sm text-foreground mt-1">{record.content}</p>
                  </div>

                  <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">行动项</span>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{record.action_items}</p>
                  </div>

                  {record.next_date && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>下次辅导: {record.next_date}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {showNewCoachingDialog && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowNewCoachingDialog(false)}>
              <div className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-foreground mb-4">新建辅导记录</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">带教老师</label>
                      <select className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm">
                        <option>陈带教老师</option><option>周带教老师</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">学员</label>
                      <select className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm">
                        <option>张小红</option><option>李大伟</option><option>王美玲</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">辅导主题</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" placeholder="如：微信加V沟通改善" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">辅导内容</label>
                    <textarea className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={3} placeholder="描述辅导过程中发现的问题与分析" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">行动项</label>
                    <textarea className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={3} placeholder="1. ...\n2. ...\n3. ..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">下次辅导日期</label>
                    <input type="date" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowNewCoachingDialog(false)} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">取消</button>
                  <button onClick={() => setShowNewCoachingDialog(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90">保存记录</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Plan Dialog */}
      {showNewPlanDialog && (
        <NewPlanDialog onClose={() => setShowNewPlanDialog(false)} onCreated={() => fetchData()} />
      )}

      {/* 创建临时演练任务弹窗 */}
      {showTempTaskDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTempTaskDialog(false)}>
          <div className="bg-card rounded-lg shadow-lg p-6 w-full max-w-lg" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">创建临时演练任务</h3>
              <button onClick={() => setShowTempTaskDialog(false)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">任务名称 *</label>
                <input
                  value={tempTask.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="如：异议处理专项演练"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">指派新人 *</label>
                <select
                  value={tempTask.assignedTo}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTempTask(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">选择新人</option>
                  {trainees.map((t: {id: string; name: string}) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">知识点标签</label>
                <input
                  value={tempTask.taskTag}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempTask(prev => ({ ...prev, taskTag: e.target.value }))}
                  placeholder="如：异议处理、首通电话"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">演练要求</label>
                <textarea
                  value={tempTask.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTempTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述演练的具体要求和达标标准"
                  rows={3}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">截止时间</label>
                <input
                  type="datetime-local"
                  value={tempTask.deadline}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempTask(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTempTaskDialog(false)}
                className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!tempTask.title || !tempTask.assignedTo) return;
                  try {
                    const res = await fetch('/api/practice/tasks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: tempTask.title,
                        description: tempTask.description,
                        taskTag: tempTask.taskTag,
                        assignedTo: tempTask.assignedTo,
                        deadline: tempTask.deadline || null,
                      }),
                    });
                    if (res.ok) {
                      setShowTempTaskDialog(false);
                      setTempTask({ title: '', description: '', taskTag: '', assignedTo: '', deadline: '' });
                    }
                  } catch { /* ignore */ }
                }}
                className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={!tempTask.title || !tempTask.assignedTo}
              >
                派发任务
              </button>
            </div>
          </div>
        </div>
      )}

        {/* 方案详情弹窗 - 处方式展示 */}
        {selectedPlan && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSelectedPlan(null)}>
            <div className="bg-card rounded-xl shadow-float max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {INDICATOR_LABELS[selectedPlan.indicator_key || ''] || selectedPlan.indicator_key || '综合提升'}
                      </span>
                      {selectedPlan.estimated_hours && (
                        <span className="text-sm text-muted-foreground">预计 {selectedPlan.estimated_hours} 学时</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{selectedPlan.name}</h2>
                  </div>
                  <button onClick={() => setSelectedPlan(null)} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 关联指标 */}
                {selectedPlan.target_indicators && Array.isArray(selectedPlan.target_indicators) && selectedPlan.target_indicators.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">关联指标</h3>
                    <div className="flex flex-wrap gap-2">
                      {(selectedPlan.target_indicators as unknown[]).map((m: unknown, i: number) => {
                        const key = typeof m === 'string' ? m : String((m as Record<string, unknown>)?.key ?? (m as Record<string, unknown>)?.name ?? '');
                        return (
                          <span key={i} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {INDICATOR_LABELS[key] || key}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4段式处方式内容 */}
                {selectedPlan.content && typeof selectedPlan.content === 'object' && (
                  <div className="space-y-4">
                    {/* 病情分析 */}
                    {selectedPlan.content.analysis && (
                      <div className="bg-[#102A43]/5 rounded-lg p-4 border border-[#102A43]/10">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-[#102A43]/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-[#102A43]">诊</span>
                          </div>
                          <h3 className="text-sm font-semibold text-[#102A43]">病情分析</h3>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed pl-8">{selectedPlan.content.analysis}</p>
                      </div>
                    )}

                    {/* 调理方向 */}
                    {selectedPlan.content.direction && (
                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">向</span>
                          </div>
                          <h3 className="text-sm font-semibold text-primary">调理方向</h3>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed pl-8">{selectedPlan.content.direction}</p>
                      </div>
                    )}

                    {/* 具体药方 */}
                    {selectedPlan.content.prescription && Array.isArray(selectedPlan.content.prescription) && (
                      <div className="bg-[#f59e0b]/5 rounded-lg p-4 border border-[#f59e0b]/10">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-[#f59e0b]/15 flex items-center justify-center">
                            <span className="text-xs font-bold text-[#f59e0b]">方</span>
                          </div>
                          <h3 className="text-sm font-semibold text-[#f59e0b]">具体药方</h3>
                        </div>
                        <div className="space-y-3 pl-8">
                          {selectedPlan.content.prescription.map((item, i: number) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="w-6 h-6 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{item.step}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 达标标准 */}
                    {selectedPlan.content.standard && (
                      <div className="bg-[#22c55e]/5 rounded-lg p-4 border border-[#22c55e]/10">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-[#22c55e]/15 flex items-center justify-center">
                            <span className="text-xs font-bold text-[#22c55e]">标</span>
                          </div>
                          <h3 className="text-sm font-semibold text-[#22c55e]">达标标准</h3>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed pl-8">{selectedPlan.content.standard}</p>
                      </div>
                    )}

                    {/* 兼容旧格式 steps */}
                    {!selectedPlan.content.analysis && !selectedPlan.content.prescription && selectedPlan.content.steps && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-foreground mb-2">方案内容</h3>
                        <div className="space-y-3">
                          {(selectedPlan.content.steps as string[]).map((step: string, i: number) => (
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
                  <button onClick={() => setSelectedPlan(null)} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">
                    关闭
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/empower', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ planId: selectedPlan.id, userIds: [], assignedBy: user?.id })
                        });
                        const data = await res.json();
                        if (data.success || data.execution) {
                          alert('方案已启动执行！');
                          setSelectedPlan(null);
                          fetchData();
                        } else {
                          alert(data.error || '启动失败');
                        }
                      } catch { alert('操作失败'); }
                    }}
                    className="px-5 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90"
                  >
                    立即执行
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function PlanCard({ plan, onSelect }: { plan: EmpowerPlan; onSelect: (plan: EmpowerPlan) => void }) {
  const primaryMetric = plan.target_metrics?.[0] || plan.indicator_key || 'default';
  const Icon = PLAN_ICONS[primaryMetric] || Target;

  // 获取处方式的简要信息
  const content = plan.content as Record<string, unknown> | null;
  const analysis = content?.analysis as string | undefined;
  const direction = content?.direction as string | undefined;

  return (
    <div
      className="bg-card rounded-lg shadow-card p-5 hover:shadow-float transition-shadow border border-border/50 cursor-pointer"
      onClick={() => onSelect(plan)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-primary/10 text-primary">
          {INDICATOR_LABELS[plan.indicator_key || ''] || plan.indicator_key || '综合提升'}
        </span>
      </div>
      {/* 处方式预览：病情分析 + 调理方向 */}
      {analysis && (
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{analysis}</p>
      )}
      {direction && (
        <p className="text-xs text-primary/70 mb-3 line-clamp-1">调理方向：{direction}</p>
      )}
      {!analysis && !direction && plan.description && (
        <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />预计{plan.duration_days}天
          </span>
          <span className="inline-flex items-center gap-1">
            <Target className="w-3.5 h-3.5" />
            {(plan.target_indicators as unknown[] | undefined)?.length || 0}个关联指标
          </span>
        </div>
        <span className="text-xs font-medium text-[#f59e0b] inline-flex items-center gap-1">
          查看详情 <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}

function ExecutionCard({ execution, plans }: { execution: Execution; plans: EmpowerPlan[] }) {
  const plan = plans.find(p => p.id === execution.plan_id) || execution.plan;
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    assigned: { label: '已分配', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/15' },
    in_progress: { label: '进行中', color: 'text-primary', bg: 'bg-primary/15' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
    verified: { label: '已验证', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/15' },
  };
  const sc = statusConfig[execution.status] || statusConfig.assigned;

  const quadrantColor: Record<string, string> = { A: '#22c55e', B: 'text-primary', C: '#f59e0b', D: '#ef4444' };
  const quadrantLabel: Record<string, string> = { A: '达标', B: '机制问题', C: '运气型', D: '能力不足' };

  return (
    <div className="bg-card rounded-lg shadow-card p-5 border border-border/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{plan?.name || '未知方案'}</h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${sc.bg} ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              用户ID: {execution.user_id} · 开始: {new Date(execution.started_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* 闭环验证前后对比 */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4">
          {/* 赋能前 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">赋能前:</span>
            {execution.before_quadrant && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold"
                style={{
                  backgroundColor: (quadrantColor[execution.before_quadrant] || '#999') + '20',
                  color: quadrantColor[execution.before_quadrant] || '#999',
                }}
              >
                {execution.before_quadrant}类·{quadrantLabel[execution.before_quadrant] || ''}
              </span>
            )}
          </div>

          {/* 箭头 */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <div className="w-8 h-px bg-border" />
            <ArrowRight className="w-4 h-4" />
            <div className="w-8 h-px bg-border" />
          </div>

          {/* 赋能后 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">赋能后:</span>
            {execution.after_quadrant ? (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold"
                style={{
                  backgroundColor: (quadrantColor[execution.after_quadrant] || '#999') + '20',
                  color: quadrantColor[execution.after_quadrant] || '#999',
                }}
              >
                {execution.after_quadrant}类·{quadrantLabel[execution.after_quadrant] || ''}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">待验证</span>
            )}
          </div>

          {/* 改善百分比 */}
          {execution.improvement_pct != null && (
            <div className="ml-auto flex items-center gap-1 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
              <span className="text-[#22c55e] font-medium">+{execution.improvement_pct}%</span>
              <span className="text-muted-foreground">改善</span>
            </div>
          )}
        </div>

        {/* 进度条 */}
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
                  backgroundColor: (execution.progress ?? 0) >= 80 ? '#22c55e' : (execution.progress ?? 0) >= 40 ? '#2978B5' : '#f59e0b',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewPlanDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(7);
  const [targetMetrics, setTargetMetrics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const metricOptions = [
    { key: 'wechatAddRate', label: '加V率' },
    { key: 'consultationRate', label: '面诊率' },
    { key: 'receptionRate', label: '接诊率' },
    { key: 'deliveryRate', label: '签收率' },
    { key: 'medicationRate', label: '用药率' },
    { key: 'appointmentRate', label: '挂号率' },
    { key: 'learning', label: '闯关进度' },
    { key: 'qcScore', label: '质检分数' },
  ];

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/empower', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          durationDays: duration,
          targetMetrics,
          planType: 'training',
        }),
      });
      if (res.ok) onCreated();
    } catch {
      // ignore
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold text-foreground mb-4">新建赋能方案</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">方案名称</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              placeholder="如：加微服务用语专项训练"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">方案描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              rows={3}
              placeholder="描述方案内容与目标..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">预计天数</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 7)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              min={1}
              max={30}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">对标指标（可多选）</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {metricOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setTargetMetrics(prev =>
                      prev.includes(opt.key)
                        ? prev.filter(m => m !== opt.key)
                        : [...prev, opt.key]
                    );
                  }}
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
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
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
  );
}
