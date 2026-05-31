'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SlidersHorizontal, Users, GitBranch, Save, Loader2,
  CheckCircle2, AlertCircle, Shield, ArrowRight, AlertTriangle,
  ClipboardCheck, Clock, UserCheck, XCircle, ChevronRight, Calendar,
} from 'lucide-react';

// === Types ===

interface ThresholdConfig {
  id: string;
  metric_key: string;
  metric_name: string;
  category: string;
  qualified_value: number;
  good_value: number;
  excellent_value: number;
  unit?: string;
}

interface UserRecord {
  id: string;
  username: string;
  real_name: string;
  role_name: string;
  role_display_name: string;
  stage: number;
  is_active: boolean;
}

interface StageRule {
  id: number;
  from_stage: number;
  to_stage: number;
  rule_type: string;
  rule_config: Record<string, any> | null;
  description: string | null;
  is_active: boolean;
}

type TabKey = 'thresholds' | 'users' | 'stages' | 'stage-applications';

interface StageApplication {
  id: number;
  trainee_id: string;
  trainee_name: string;
  current_stage: number;
  target_stage: number;
  status: string;
  reason: string;
  evidence: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  review_comment: string | null;
  applied_at: string;
  reviewed_at: string | null;
}

const MOCK_APPLICATIONS: StageApplication[] = [
  { id: 1, trainee_id: '1', trainee_name: '张小红', current_stage: 1, target_stage: 2, status: 'pending', reason: '已通过7关闯关学习', evidence: '闯关成绩全部合格，双轨诊断连续2周B类以上', reviewer_id: null, reviewer_name: null, review_comment: null, applied_at: '2025-06-06T10:00:00Z', reviewed_at: null },
  { id: 2, trainee_id: '2', trainee_name: '李大伟', current_stage: 1, target_stage: 2, status: 'approved', reason: '闯关7关全部通过', evidence: '闯关成绩全部合格，质检4维度均达良好以上', reviewer_id: '9', reviewer_name: '郑管理', review_comment: '表现优秀，同意升级', applied_at: '2025-06-01T09:00:00Z', reviewed_at: '2025-06-02T14:00:00Z' },
  { id: 3, trainee_id: '3', trainee_name: '王美玲', current_stage: 2, target_stage: 3, status: 'rejected', reason: '连续4周A类，申请阶段三', evidence: '连续4周双轨诊断A类', reviewer_id: '9', reviewer_name: '郑管理', review_comment: '连续4周A类要求未完全满足（第3周为B类），请继续努力', applied_at: '2025-05-28T11:00:00Z', reviewed_at: '2025-05-29T16:00:00Z' },
];

// === Mock Data Fallbacks ===

const DEFAULT_PROCESS_THRESHOLDS: ThresholdConfig[] = [
  { id: 'p1', metric_key: 'passing_score', metric_name: '闯关成绩', category: 'process', qualified_value: 60, good_value: 80, excellent_value: 95, unit: '分' },
  { id: 'p2', metric_key: 'qc_completeness', metric_name: '质检·服务态度', category: 'process', qualified_value: 70, good_value: 85, excellent_value: 95, unit: '分' },
  { id: 'p3', metric_key: 'qc_professionalism', metric_name: '质检·专业能力', category: 'process', qualified_value: 70, good_value: 85, excellent_value: 95, unit: '分' },
  { id: 'p4', metric_key: 'qc_communication', metric_name: '质检·沟通技巧', category: 'process', qualified_value: 70, good_value: 85, excellent_value: 95, unit: '分' },
  { id: 'p5', metric_key: 'qc_compliance', metric_name: '质检·规范执行', category: 'process', qualified_value: 70, good_value: 85, excellent_value: 95, unit: '分' },
];

const DEFAULT_RESULT_THRESHOLDS: ThresholdConfig[] = [
  { id: 'r1', metric_key: 'wechat_add_rate', metric_name: '加V率', category: 'result', qualified_value: 90, good_value: 95, excellent_value: 98, unit: '%' },
  { id: 'r2', metric_key: 'consultation_rate', metric_name: '面诊率', category: 'result', qualified_value: 85, good_value: 90, excellent_value: 95, unit: '%' },
  { id: 'r3', metric_key: 'reception_rate', metric_name: '接诊率', category: 'result', qualified_value: 80, good_value: 88, excellent_value: 95, unit: '%' },
  { id: 'r4', metric_key: 'delivery_rate', metric_name: '签收率', category: 'result', qualified_value: 85, good_value: 90, excellent_value: 95, unit: '%' },
  { id: 'r5', metric_key: 'medication_rate', metric_name: '用药率', category: 'result', qualified_value: 90, good_value: 95, excellent_value: 98, unit: '%' },
  { id: 'r6', metric_key: 'appointment_rate', metric_name: '挂号率', category: 'result', qualified_value: 80, good_value: 88, excellent_value: 95, unit: '%' },
];

const MOCK_USERS: UserRecord[] = [
  { id: '1', username: 'zhangml', real_name: '张美丽', role_name: 'trainee', role_display_name: '新人', stage: 2, is_active: true },
  { id: '2', username: 'chensy', real_name: '陈思远', role_name: 'trainee', role_display_name: '新人', stage: 2, is_active: true },
  { id: '3', username: 'liuxf', real_name: '刘小芳', role_name: 'trainee', role_display_name: '新人', stage: 1, is_active: true },
  { id: '4', username: 'wangjm', real_name: '王建明', role_name: 'mentor', role_display_name: '带教导师', stage: 3, is_active: true },
  { id: '5', username: 'liyl', real_name: '李云龙', role_name: 'trainer', role_display_name: '培训师', stage: 3, is_active: true },
  { id: '6', username: 'zhaodl', real_name: '赵大力', role_name: 'trainee', role_display_name: '新人', stage: 1, is_active: false },
  { id: '7', username: 'sunhw', real_name: '孙慧文', role_name: 'training_manager', role_display_name: '培训负责人', stage: 3, is_active: true },
  { id: '8', username: 'zhougm', real_name: '周国民', role_name: 'general_manager', role_display_name: '总经理', stage: 3, is_active: true },
];

const MOCK_STAGE_RULES: StageRule[] = [
  {
    id: 1, from_stage: 1, to_stage: 2, rule_type: 'passing',
    rule_config: { required_passes: 7, total_levels: 7 },
    description: '闯关7关全通过', is_active: true,
  },
  {
    id: 2, from_stage: 2, to_stage: 3, rule_type: 'quadrant_sustained',
    rule_config: { quadrant: 'A', consecutive_weeks: 4 },
    description: '连续4周A类', is_active: true,
  },
  {
    id: 3, from_stage: 0, to_stage: 0, rule_type: 'warning',
    rule_config: { quadrant: 'D', consecutive_weeks: 2, action: 'retrain' },
    description: '连续2周D类触发复训', is_active: true,
  },
  {
    id: 4, from_stage: 3, to_stage: 2, rule_type: 'demotion',
    rule_config: { quadrant: 'D', consecutive_weeks: 3 },
    description: '阶段三人连续3周D类降回阶段二', is_active: true,
  },
];

// === Helpers ===

const ROLE_BADGE_MAP: Record<string, { bg: string; text: string }> = {
  trainee: { bg: 'bg-primary/15', text: 'text-primary' },
  mentor: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]' },
  trainer: { bg: 'bg-primary/15', text: 'text-primary' },
  training_manager: { bg: 'bg-destructive/15', text: 'text-destructive' },
  general_manager: { bg: 'bg-amber-500/15', text: 'text-amber-600' },
};

const STAGE_LABELS: Record<number, string> = { 1: '阶段一', 2: '阶段二', 3: '阶段三' };

function getStageLabel(stage: number): string {
  return STAGE_LABELS[stage] || `阶段${stage}`;
}

// === Sub-components ===

function ThresholdInput({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: 'red' | 'amber' | 'green';
  onChange: (v: number) => void;
}) {
  const colorMap = {
    red: 'border-[#ef4444]/30 focus-visible:border-[#ef4444] focus-visible:ring-[#ef4444]/20',
    amber: 'border-[#f59e0b]/30 focus-visible:border-[#f59e0b] focus-visible:ring-[#f59e0b]/20',
    green: 'border-[#22c55e]/30 focus-visible:border-[#22c55e] focus-visible:ring-[#22c55e]/20',
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] ${colorMap[color]} md:text-sm`}
        min={0}
        max={100}
        step={1}
      />
    </div>
  );
}

// === Main Component ===

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('thresholds');
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>([]);
  const [thresholdsLoading, setThresholdsLoading] = useState(true);
  const [thresholdsSaving, setThresholdsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userToggling, setUserToggling] = useState<string | null>(null);

  const [stageRules, setStageRules] = useState<StageRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [stageApplications, setStageApplications] = useState<StageApplication[]>([]);

  // --- Fetch thresholds ---
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/thresholds');
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json || [];
          if (data.length > 0) {
            setThresholds(data);
            setThresholdsLoading(false);
            return;
          }
        }
      } catch {
        // fallback below
      }
      setThresholds([...DEFAULT_PROCESS_THRESHOLDS, ...DEFAULT_RESULT_THRESHOLDS]);
      setThresholdsLoading(false);
    }
    load();
  }, []);

  // --- Fetch users ---
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          // Attempt to fetch users list
          const usersRes = await fetch('/api/auth/me'); // Placeholder; real endpoint may differ
          if (!usersRes.ok) throw new Error();
        }
      } catch {
        // Use mock data
      }
      setUsers(MOCK_USERS);
      setUsersLoading(false);
    }
    load();
  }, []);

  // --- Fetch stage rules ---
  useEffect(() => {
    async function load() {
      try {
        // Future: fetch from /api/stage-rules
      } catch {
        // fallback
      }
      setStageRules(MOCK_STAGE_RULES);
      setRulesLoading(false);
    }
    load();
  }, []);

  // --- Fetch stage applications ---
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/stage-applications');
        if (res.ok) {
          const json = await res.json();
          setStageApplications(json.applications || []);
          return;
        }
      } catch {}
      setStageApplications(MOCK_APPLICATIONS);
    }
    load();
  }, []);

  // --- Threshold handlers ---
  const updateThreshold = useCallback((id: string, field: 'qualified_value' | 'good_value' | 'excellent_value', value: number) => {
    setThresholds(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }, []);

  const saveThresholds = async () => {
    setThresholdsSaving(true);
    setSaveMessage(null);
    try {
      // Save each changed threshold
      const results = await Promise.allSettled(
        thresholds.map(t =>
          fetch('/api/thresholds', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: t.id,
              qualified_value: t.qualified_value,
              good_value: t.good_value,
              excellent_value: t.excellent_value,
            }),
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        setSaveMessage({ type: 'error', text: `${failed.length} 项保存失败，请重试` });
      } else {
        setSaveMessage({ type: 'success', text: '阈值配置已保存' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: '保存失败，请检查网络连接' });
    }
    setThresholdsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // --- User toggle handler ---
  const toggleUserActive = async (userId: string) => {
    setUserToggling(userId);
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u)
    );
    // Future: PATCH /api/users/{id} to persist
    setTimeout(() => setUserToggling(null), 300);
  };

  // --- Derived data ---
  const processThresholds = thresholds.filter(t => t.category === 'process');
  const resultThresholds = thresholds.filter(t => t.category === 'result');

  const promotionRules = stageRules.filter(r => r.from_stage > 0 && r.to_stage > 0 && r.rule_type !== 'warning' && r.rule_type !== 'demotion');
  const warningRules = stageRules.filter(r => r.rule_type === 'warning');
  const demotionRules = stageRules.filter(r => r.rule_type === 'demotion');

  // --- Tab config ---
  const tabs: { key: TabKey; label: string; icon: typeof SlidersHorizontal }[] = [
    { key: 'thresholds', label: '阈值配置', icon: SlidersHorizontal },
    { key: 'users', label: '用户管理', icon: Users },
    { key: 'stages', label: '阶段规则', icon: GitBranch },
    { key: 'stage-applications', label: '升级审批', icon: ClipboardCheck },
  ];

  // === Loading skeleton ===
  if (thresholdsLoading && activeTab === 'thresholds') {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="flex gap-6">
          <div className="w-44 shrink-0 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />)}
          </div>
          <div className="flex-1 space-y-4">
            {[1, 2].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-0">
      {/* === Page Header === */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">系统设置</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">配置阈值、管理用户与阶段规则</p>
      </div>

      {/* === Left Tabs + Right Content Layout === */}
      <div className="flex gap-6">
        {/* --- Left Vertical Tabs --- */}
        <nav className="w-44 shrink-0 bg-card rounded-lg shadow-card p-2" aria-label="设置导航">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* --- Right Content Area --- */}
        <div className="flex-1 min-w-0">
          {/* =========== Tab: 阈值配置 =========== */}
          {activeTab === 'thresholds' && (
            <div className="space-y-6">
              {/* 过程线阈值配置 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">过程线阈值配置</h2>
                  <span className="text-xs text-muted-foreground ml-1">闯关成绩与质检4维度</span>
                </div>
                <div className="p-5 space-y-4">
                  {processThresholds.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无过程线指标</p>
                    </div>
                  ) : (
                    processThresholds.map(t => (
                      <div key={t.id} className="grid grid-cols-[140px_1fr] gap-4 items-start">
                        <div className="pt-1">
                          <p className="text-sm font-medium text-foreground">{t.metric_name}</p>
                          {t.unit && <p className="text-xs text-muted-foreground mt-0.5">单位: {t.unit}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <ThresholdInput
                            label="合格"
                            value={t.qualified_value}
                            color="red"
                            onChange={(v) => updateThreshold(t.id, 'qualified_value', v)}
                          />
                          <ThresholdInput
                            label="良好"
                            value={t.good_value}
                            color="amber"
                            onChange={(v) => updateThreshold(t.id, 'good_value', v)}
                          />
                          <ThresholdInput
                            label="优秀"
                            value={t.excellent_value}
                            color="green"
                            onChange={(v) => updateThreshold(t.id, 'excellent_value', v)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 结果线阈值配置 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#f59e0b]" />
                  <h2 className="text-base font-semibold text-foreground">结果线阈值配置</h2>
                  <span className="text-xs text-muted-foreground ml-1">6项核心业务指标</span>
                </div>
                <div className="p-5 space-y-4">
                  {resultThresholds.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无结果线指标</p>
                    </div>
                  ) : (
                    resultThresholds.map(t => (
                      <div key={t.id} className="grid grid-cols-[140px_1fr] gap-4 items-start">
                        <div className="pt-1">
                          <p className="text-sm font-medium text-foreground">{t.metric_name}</p>
                          {t.unit && <p className="text-xs text-muted-foreground mt-0.5">单位: {t.unit}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <ThresholdInput
                            label="合格"
                            value={t.qualified_value}
                            color="red"
                            onChange={(v) => updateThreshold(t.id, 'qualified_value', v)}
                          />
                          <ThresholdInput
                            label="良好"
                            value={t.good_value}
                            color="amber"
                            onChange={(v) => updateThreshold(t.id, 'good_value', v)}
                          />
                          <ThresholdInput
                            label="优秀"
                            value={t.excellent_value}
                            color="green"
                            onChange={(v) => updateThreshold(t.id, 'excellent_value', v)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-4">
                <button
                  id="btn-save-thresholds"
                  onClick={saveThresholds}
                  disabled={thresholdsSaving}
                  className="inline-flex items-center gap-2 h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {thresholdsSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  保存配置
                </button>
                {saveMessage && (
                  <div className={`flex items-center gap-1.5 text-sm ${
                    saveMessage.type === 'success' ? 'text-[#22c55e]' : 'text-destructive'
                  }`}>
                    {saveMessage.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4" />
                      : <AlertCircle className="w-4 h-4" />
                    }
                    {saveMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========== Tab: 用户管理 =========== */}
          {activeTab === 'users' && (
            <div className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">用户管理</h2>
                <span className="text-xs text-muted-foreground ml-1">{users.length} 位用户</span>
              </div>

              {usersLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">暂无用户数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">姓名</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">用户名</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">角色</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">阶段</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">状态</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {users.map(user => {
                        const roleStyle = ROLE_BADGE_MAP[user.role_name] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                        return (
                          <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                            {/* 姓名 */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                                  {user.real_name.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-foreground">{user.real_name}</span>
                              </div>
                            </td>
                            {/* 用户名 */}
                            <td className="px-5 py-4">
                              <span className="text-sm text-muted-foreground font-mono">{user.username}</span>
                            </td>
                            {/* 角色 */}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                                {user.role_display_name}
                              </span>
                            </td>
                            {/* 阶段 */}
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                                {getStageLabel(user.stage)}
                              </span>
                            </td>
                            {/* 状态 */}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                user.is_active ? 'text-[#22c55e]' : 'text-muted-foreground'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  user.is_active ? 'bg-[#22c55e]' : 'bg-muted-foreground/40'
                                }`} />
                                {user.is_active ? '在职' : '停用'}
                              </span>
                            </td>
                            {/* 操作 - 状态切换 */}
                            <td className="px-5 py-4 text-center">
                              <button
                                id={`toggle-user-${user.id}`}
                                onClick={() => toggleUserActive(user.id)}
                                disabled={userToggling === user.id}
                                className={`relative inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
                                  user.is_active
                                    ? 'bg-primary'
                                    : 'bg-input'
                                }`}
                                role="switch"
                                aria-checked={user.is_active}
                                aria-label={`切换 ${user.real_name} 状态`}
                              >
                                <span
                                  className={`pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform ${
                                    user.is_active
                                      ? 'translate-x-[calc(100%-2px)]'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =========== Tab: 阶段规则 =========== */}
          {activeTab === 'stages' && (
            <div className="space-y-6">
              {/* 晋升规则 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#22c55e]" />
                  <h2 className="text-base font-semibold text-foreground">晋升规则</h2>
                </div>
                <div className="p-5">
                  {rulesLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                    </div>
                  ) : promotionRules.length === 0 ? (
                    <div className="py-8 text-center">
                      <GitBranch className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无晋升规则</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {promotionRules.map(rule => (
                        <div
                          key={rule.id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5"
                        >
                          {/* Stage badge from */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#22c55e]/15 text-[#22c55e] text-sm font-bold">
                              {rule.from_stage}
                            </span>
                            <ArrowRight className="w-5 h-5 text-[#22c55e]/60" />
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#22c55e]/15 text-[#22c55e] text-sm font-bold">
                              {rule.to_stage}
                            </span>
                          </div>
                          {/* Rule description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{rule.description}</p>
                            {rule.rule_config && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {Object.entries(rule.rule_config).map(([key, val]) => (
                                  <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                                    {key === 'required_passes' && '通关数'}
                                    {key === 'total_levels' && '总关数'}
                                    {key === 'quadrant' && '象限'}
                                    {key === 'consecutive_weeks' && '连续周数'}
                                    {!['required_passes', 'total_levels', 'quadrant', 'consecutive_weeks'].includes(key) && key}
                                    : {String(val)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Active status */}
                          <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium ${
                            rule.is_active ? 'text-[#22c55e]' : 'text-muted-foreground'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.is_active ? 'bg-[#22c55e]' : 'bg-muted-foreground/40'}`} />
                            {rule.is_active ? '生效中' : '已停用'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 预警规则 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                  <h2 className="text-base font-semibold text-foreground">预警规则</h2>
                </div>
                <div className="p-5">
                  {rulesLoading ? (
                    <div className="space-y-3">
                      {[1].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                    </div>
                  ) : warningRules.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无预警规则</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {warningRules.map(rule => (
                        <div
                          key={rule.id}
                          className="flex items-start gap-4 p-4 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/5"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#f59e0b]/15 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{rule.description}</p>
                            {rule.rule_config && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {Object.entries(rule.rule_config).map(([key, val]) => (
                                  <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                                    {key === 'quadrant' && '触发象限'}
                                    {key === 'consecutive_weeks' && '连续周数'}
                                    {key === 'action' && '处理方式'}
                                    {!['quadrant', 'consecutive_weeks', 'action'].includes(key) && key}
                                    : {String(val)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#f59e0b]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                            生效中
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 降级规则 */}
              {demotionRules.length > 0 && (
                <div className="bg-card rounded-lg shadow-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <h2 className="text-base font-semibold text-foreground">降级规则</h2>
                  </div>
                  <div className="p-5">
                    <div className="space-y-4">
                      {demotionRules.map(rule => (
                        <div
                          key={rule.id}
                          className="flex items-start gap-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5"
                        >
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15 text-destructive text-sm font-bold">
                              {rule.from_stage}
                            </span>
                            <ArrowRight className="w-5 h-5 text-destructive/60" />
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15 text-destructive text-sm font-bold">
                              {rule.to_stage}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{rule.description}</p>
                            {rule.rule_config && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {Object.entries(rule.rule_config).map(([key, val]) => (
                                  <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                                    {key === 'quadrant' && '触发象限'}
                                    {key === 'consecutive_weeks' && '连续周数'}
                                    {!['quadrant', 'consecutive_weeks'].includes(key) && key}
                                    : {String(val)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                            生效中
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========== Tab: 升级审批 =========== */}
          {activeTab === 'stage-applications' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '待审批', value: stageApplications.filter(a => a.status === 'pending').length, icon: Clock, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
                  { label: '已通过', value: stageApplications.filter(a => a.status === 'approved').length, icon: UserCheck, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
                  { label: '已驳回', value: stageApplications.filter(a => a.status === 'rejected').length, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
                ].map((s, i) => (
                  <div key={i} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                    <div><div className="text-xl font-bold text-foreground">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
                  </div>
                ))}
              </div>

              {/* Application list */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">阶段升级申请</h2>
                  <span className="text-xs text-muted-foreground ml-1">{stageApplications.length} 条申请</span>
                </div>
                {stageApplications.length === 0 ? (
                  <div className="py-12 text-center">
                    <ClipboardCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">暂无升级申请</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {stageApplications.map(app => {
                      const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                        pending: { label: '待审批', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
                        approved: { label: '已通过', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
                        rejected: { label: '已驳回', color: 'text-destructive', bg: 'bg-destructive/10' },
                      };
                      const sc = statusConfig[app.status] || statusConfig.pending;
                      return (
                        <div key={app.id} className="p-5 hover:bg-muted/20 transition">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                                {app.trainee_name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-foreground">{app.trainee_name}</h4>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <span>{getStageLabel(app.current_stage)}</span>
                                  <ArrowRight className="w-3 h-3" />
                                  <span>{getStageLabel(app.target_stage)}</span>
                                  <span className="flex items-center gap-1 ml-2"><Calendar className="w-3 h-3" />{new Date(app.applied_at).toLocaleDateString('zh-CN')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 ml-13">
                            <div className="p-2.5 bg-muted/50 rounded-lg">
                              <span className="text-xs text-muted-foreground">申请理由：</span>
                              <span className="text-sm text-foreground ml-1">{app.reason}</span>
                            </div>
                            <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg">
                              <span className="text-xs text-primary">达标证据：</span>
                              <span className="text-sm text-foreground ml-1">{app.evidence}</span>
                            </div>
                            {app.review_comment && (
                              <div className={`p-2.5 rounded-lg ${app.status === 'approved' ? 'bg-[#22c55e]/5 border border-[#22c55e]/10' : 'bg-destructive/5 border border-destructive/10'}`}>
                                <span className={`text-xs ${app.status === 'approved' ? 'text-[#22c55e]' : 'text-destructive'}`}>审批意见：</span>
                                <span className="text-sm text-foreground ml-1">{app.review_comment}</span>
                                {app.reviewer_name && <span className="text-xs text-muted-foreground ml-2">— {app.reviewer_name}</span>}
                              </div>
                            )}
                            {app.status === 'pending' && (
                              <div className="flex items-center gap-3 pt-2">
                                <button className="px-4 py-1.5 bg-[#22c55e] text-white rounded-md text-sm font-medium hover:bg-[#22c55e]/90 transition">通过</button>
                                <button className="px-4 py-1.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition">驳回</button>
                                <input placeholder="审批意见" className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
