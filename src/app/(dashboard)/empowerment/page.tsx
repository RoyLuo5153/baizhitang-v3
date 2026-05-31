'use client';

import { useEffect, useState } from 'react';
import {
  Zap, Plus, Library, PlayCircle, CheckCircle2, Clock, Users, Target,
  MessageCirclePlus, Pill, Mic, BookOpen, ChevronRight,
} from 'lucide-react';

interface EmpowerPlan {
  id: string;
  name: string;
  description: string;
  plan_type: string;
  duration_days: number;
  target_metrics: string[];
  target_quadrants: string[];
  content: any;
  is_active: boolean;
}

interface Execution {
  id: string;
  plan_id: string;
  user_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  verification_result: any;
  plan?: EmpowerPlan;
}

type TabType = 'plans' | 'executing' | 'verified';

const PLAN_ICONS: Record<string, any> = {
  wechatAddRate: MessageCirclePlus,
  medicationRate: Pill,
  qcScore: Mic,
  learning: BookOpen,
  default: Target,
};

export default function EmpowermentPage() {
  const [plans, setPlans] = useState<EmpowerPlan[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('plans');
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/empower');
      if (res.ok) {
        const json = await res.json();
        setPlans(json.plans || []);
        setExecutions(json.executions || []);
      }
    } catch {
      // Use empty state
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
        <button
          onClick={() => setShowNewPlanDialog(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />新建方案
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'plans', label: '方案库', icon: Library },
          { key: 'executing', label: `执行中 (${executingExecs.length})`, icon: PlayCircle },
          { key: 'verified', label: `已验证 (${verifiedExecs.length})`, icon: CheckCircle2 },
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
              <PlanCard key={plan.id} plan={plan} />
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

      {/* New Plan Dialog */}
      {showNewPlanDialog && (
        <NewPlanDialog onClose={() => setShowNewPlanDialog(false)} onCreated={() => fetchData()} />
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: EmpowerPlan }) {
  const primaryMetric = plan.target_metrics?.[0] || 'default';
  const Icon = PLAN_ICONS[primaryMetric] || Target;

  return (
    <div className="bg-card rounded-lg shadow-card p-5 hover:shadow-float transition-shadow border border-border/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
        </div>
        {plan.target_metrics?.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-destructive/15 text-destructive">
            {plan.target_metrics[0]}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />预计{plan.duration_days}天
        </span>
        <span className="inline-flex items-center gap-1">
          <Target className="w-3.5 h-3.5" />{(plan.target_metrics || []).join(', ')}
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

  return (
    <div className="bg-card rounded-lg shadow-card p-4 flex items-center gap-4 border border-border/50">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Zap className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
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
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
              placeholder="如：加微话术专项训练"
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
