'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SlidersHorizontal, Users, GitBranch, Save, Loader2,
  CheckCircle2, AlertCircle, Shield, ArrowRight, AlertTriangle,
  ClipboardCheck, Clock, UserCheck, XCircle, Calendar,
  Plus, Trash2, Pencil, X, ChevronDown, ChevronRight,
  KeyRound, UserX, UserCheck2, Lock,
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
  realName: string;
  roleId: number;
  roleName: string;
  isSuperAdmin?: boolean;
  stage: number | null;
  cohort: string | null;
  position: string | null;
  department: string | null;
  mentorName: string | null;
  status: string;
  createdAt: string;
}

interface StageRule {
  id: number;
  from_stage: number;
  to_stage: number;
  rule_type: string;
  rule_config: Record<string, unknown> | null;
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

// === Default Threshold Configs ===

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

// === Helpers ===

const ROLE_OPTIONS = [
  { id: 1, name: 'trainee', displayName: '新人' },
  { id: 2, name: 'mentor', displayName: '带教老师' },
  { id: 3, name: 'teacher', displayName: '培训老师' },
  { id: 4, name: 'training_manager', displayName: '培训负责人' },
  { id: 5, name: 'boss', displayName: '总经理' },
];

const ROLE_BADGE_MAP: Record<string, { bg: string; text: string }> = {
  trainee: { bg: 'bg-primary/15', text: 'text-primary' },
  mentor: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]' },
  teacher: { bg: 'bg-primary/15', text: 'text-primary' },
  training_manager: { bg: 'bg-destructive/15', text: 'text-destructive' },
  boss: { bg: 'bg-amber-500/15', text: 'text-amber-600' },
};

const STAGE_LABELS: Record<number, string> = { 1: '阶段一', 2: '阶段二', 3: '阶段三', 4: '阶段四' };

function getStageLabel(stage: number | null): string {
  if (stage === null || stage === undefined) return '未分配';
  return STAGE_LABELS[stage] || `阶段${stage}`;
}

function getRoleDisplayName(roleName: string): string {
  const found = ROLE_OPTIONS.find(r => r.name === roleName);
  return found ? found.displayName : roleName;
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

// === User Dialog Component ===

function UserDialog({
  mode,
  user,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  user: Partial<UserRecord> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    username: user?.username || '',
    realName: user?.realName || '',
    password: '',
    roleId: user?.roleId || 1,
    stage: user?.stage ?? 1,
    cohort: user?.cohort || '',
    position: user?.position || '',
    department: user?.department || '',
    status: user?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.realName.trim()) {
      setError('用户名和姓名不能为空');
      return;
    }
    if (mode === 'add' && !form.password.trim()) {
      setError('新增用户需要设置密码');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'add') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username,
            realName: form.realName,
            password: form.password || 'bt2026',
            roleId: form.roleId,
            stage: form.roleId === 1 ? form.stage : undefined,
            cohort: form.roleId === 1 ? form.cohort : undefined,
            position: form.roleId === 1 ? form.position : undefined,
            department: form.roleId === 1 ? form.department : undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || '创建失败');
        }
      } else if (mode === 'edit' && user?.id) {
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            realName: form.realName,
            roleId: form.roleId,
            stage: form.roleId === 1 ? form.stage : undefined,
            cohort: form.roleId === 1 ? form.cohort : undefined,
            position: form.roleId === 1 ? form.position : undefined,
            department: form.roleId === 1 ? form.department : undefined,
            status: form.status,
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || '更新失败');
        }
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">
            {mode === 'add' ? '添加用户' : '编辑用户'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'add' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">用户名</label>
              <input
                value={form.username}
                onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="登录用户名"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">姓名</label>
            <input
              value={form.realName}
              onChange={e => setForm(prev => ({ ...prev, realName: e.target.value }))}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="真实姓名"
            />
          </div>
          {mode === 'add' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="登录密码"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">角色</label>
            <select
              value={form.roleId}
              onChange={e => setForm(prev => ({ ...prev, roleId: Number(e.target.value) }))}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>{r.displayName} ({r.name})</option>
              ))}
            </select>
          </div>
          {form.roleId === 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">期数</label>
              <input
                value={form.cohort}
                onChange={e => setForm(prev => ({ ...prev, cohort: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="如：第1期、2026年3月期"
              />
            </div>
          )}
          {form.roleId === 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">职位</label>
              <input
                value={form.position}
                onChange={e => setForm(prev => ({ ...prev, position: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="如：健康顾问、高级顾问"
                list="position-suggestions"
              />
              <datalist id="position-suggestions">
                <option value="健康顾问" />
                <option value="高级顾问" />
                <option value="资深顾问" />
                <option value="见习顾问" />
              </datalist>
            </div>
          )}
          {form.roleId === 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">部门</label>
              <input
                value={form.department}
                onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="如：糖尿病管理一部"
                list="department-suggestions"
              />
              <datalist id="department-suggestions">
                <option value="糖尿病管理一部" />
                <option value="糖尿病管理二部" />
                <option value="糖尿病管理三部" />
              </datalist>
            </div>
          )}
          {form.roleId === 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">当前阶段</label>
              <select
                value={form.stage ?? 1}
                onChange={e => setForm(prev => ({ ...prev, stage: Number(e.target.value) }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.entries(STAGE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          )}
          {mode === 'edit' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">状态</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="active">在职</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'add' ? '创建' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// === Stage Rule Dialog Component ===

function StageRuleDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: Partial<StageRule> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!rule?.id;
  const [form, setForm] = useState({
    from_stage: rule?.from_stage ?? 1,
    to_stage: rule?.to_stage ?? 2,
    rule_type: rule?.rule_type ?? 'promotion',
    description: rule?.description ?? '',
    is_active: rule?.is_active ?? true,
    // Config fields
    required_passes: (rule?.rule_config as Record<string, unknown>)?.required_passes as number ?? 7,
    total_levels: (rule?.rule_config as Record<string, unknown>)?.total_levels as number ?? 7,
    quadrant: (rule?.rule_config as Record<string, unknown>)?.quadrant as string ?? 'A',
    consecutive_weeks: (rule?.rule_config as Record<string, unknown>)?.consecutive_weeks as number ?? 4,
    action: (rule?.rule_config as Record<string, unknown>)?.action as string ?? 'retrain',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const buildRuleConfig = (): Record<string, unknown> => {
    if (form.rule_type === 'promotion' && form.from_stage === 1 && form.to_stage === 2) {
      return { required_passes: form.required_passes, total_levels: form.total_levels };
    }
    if (form.rule_type === 'promotion' && form.from_stage === 2 && form.to_stage === 3) {
      return { quadrant: form.quadrant, consecutive_weeks: form.consecutive_weeks };
    }
    if (form.rule_type === 'warning') {
      return { quadrant: form.quadrant, consecutive_weeks: form.consecutive_weeks, action: form.action };
    }
    if (form.rule_type === 'demotion') {
      return { quadrant: form.quadrant, consecutive_weeks: form.consecutive_weeks };
    }
    return {};
  };

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      setError('规则描述不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = '/api/stage-rules';
      const method = isEdit ? 'PUT' : 'POST';
      const body: Record<string, unknown> = isEdit
        ? { id: rule!.id, description: form.description, is_active: form.is_active, rule_config: buildRuleConfig() }
        : { from_stage: form.from_stage, to_stage: form.to_stage, rule_type: form.rule_type, rule_config: buildRuleConfig(), description: form.description };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || '操作失败');
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">
            {isEdit ? '编辑规则' : '新增规则'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {!isEdit && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">规则类型</label>
                <select
                  value={form.rule_type}
                  onChange={e => setForm(prev => ({ ...prev, rule_type: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="promotion">晋升规则</option>
                  <option value="warning">预警规则</option>
                  <option value="demotion">降级规则</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">起始阶段</label>
                  <select
                    value={form.from_stage}
                    onChange={e => setForm(prev => ({ ...prev, from_stage: Number(e.target.value) }))}
                    className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(STAGE_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">目标阶段</label>
                  <select
                    value={form.to_stage}
                    onChange={e => setForm(prev => ({ ...prev, to_stage: Number(e.target.value) }))}
                    className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(STAGE_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">规则描述</label>
            <input
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="例：闯关7关全通过"
            />
          </div>

          {/* Dynamic config fields based on rule_type */}
          {(form.rule_type === 'promotion' && form.from_stage === 1 && form.to_stage === 2) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">通关数</label>
                <input
                  type="number"
                  value={form.required_passes}
                  onChange={e => setForm(prev => ({ ...prev, required_passes: Number(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">总关数</label>
                <input
                  type="number"
                  value={form.total_levels}
                  onChange={e => setForm(prev => ({ ...prev, total_levels: Number(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {(form.rule_type === 'promotion' && form.from_stage !== 1) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">象限要求</label>
                <select
                  value={form.quadrant}
                  onChange={e => setForm(prev => ({ ...prev, quadrant: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="A">A类（全合格）</option>
                  <option value="B">B类及以上</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">连续周数</label>
                <input
                  type="number"
                  value={form.consecutive_weeks}
                  onChange={e => setForm(prev => ({ ...prev, consecutive_weeks: Number(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {form.rule_type === 'warning' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">触发象限</label>
                <select
                  value={form.quadrant}
                  onChange={e => setForm(prev => ({ ...prev, quadrant: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="D">D类</option>
                  <option value="C">C类</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">连续周数</label>
                <input
                  type="number"
                  value={form.consecutive_weeks}
                  onChange={e => setForm(prev => ({ ...prev, consecutive_weeks: Number(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">处理方式</label>
                <select
                  value={form.action}
                  onChange={e => setForm(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="retrain">复训</option>
                  <option value="warning">警告</option>
                  <option value="mentor_assign">指派带教老师</option>
                </select>
              </div>
            </div>
          )}

          {form.rule_type === 'demotion' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">触发象限</label>
                <select
                  value={form.quadrant}
                  onChange={e => setForm(prev => ({ ...prev, quadrant: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="D">D类</option>
                  <option value="C">C类</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">连续周数</label>
                <input
                  type="number"
                  value={form.consecutive_weeks}
                  onChange={e => setForm(prev => ({ ...prev, consecutive_weeks: Number(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-border"
              />
              <label className="text-sm text-muted-foreground">规则生效中</label>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
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
  const [userDialog, setUserDialog] = useState<{ mode: 'add' | 'edit'; user: Partial<UserRecord> | null } | null>(null);
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [batchCohort, setBatchCohort] = useState('');
  const [batchStage, setBatchStage] = useState<number>(1);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [mentorList, setMentorList] = useState<{id: string; realName: string; username: string}[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [userSubTab, setUserSubTab] = useState<'trainees' | 'staff'>('trainees');

  // 修改密码弹窗
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [changePwdForm, setChangePwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changePwdError, setChangePwdError] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState(false);

  const [stageRules, setStageRules] = useState<StageRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [ruleDialog, setRuleDialog] = useState<Partial<StageRule> | null>(null);
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

  // --- Fetch users from real API ---
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
        setUsersLoading(false);
        return;
      }
    } catch {
      // fallback
    }
    setUsers([]);
    setUsersLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); fetchMentorList(); }, [fetchUsers]);

  // --- Fetch mentor list for assignment ---
  const fetchMentorList = useCallback(async () => {
    try {
      const res = await fetch('/api/users?roleId=2');
      if (res.ok) {
        const json = await res.json();
        setMentorList((json.users || []).map((u: UserRecord) => ({ id: u.id, realName: u.realName, username: u.username })));
      }
    } catch { /* ignore */ }
  }, []);

  // --- Cohort filter + batch operations ---
  const cohortOptions = [...new Set(users.filter(u => u.cohort).map(u => u.cohort!))].sort();
  const filteredUsers = cohortFilter === 'all' ? users : users.filter(u => u.cohort === cohortFilter);
  const traineeUsers = filteredUsers.filter(u => u.roleId === 1);
  const staffUsers = users.filter(u => u.roleId !== 1);

  const toggleSelectAll = () => {
    if (selectedUserIds.size === traineeUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(traineeUsers.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchAction = async () => {
    if (selectedUserIds.size === 0) return;
    setBatchProcessing(true);
    try {
      if (batchAction === 'mentor' && selectedMentorId) {
        // 分配导师：调用mentor-trainees API
        const res = await fetch('/api/mentor-trainees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mentorId: selectedMentorId, traineeIds: Array.from(selectedUserIds) }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.error || '分配导师失败'); return; }
      } else {
        const updates: Promise<Response>[] = [];
        for (const userId of selectedUserIds) {
          const body: Record<string, unknown> = { userId };
          if (batchAction === 'cohort' && batchCohort) body.cohort = batchCohort;
          if (batchAction === 'stage') body.stage = batchStage;
          if (Object.keys(body).length > 1) {
            updates.push(fetch('/api/users', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }));
          }
        }
        await Promise.all(updates);
      }
      setSelectedUserIds(new Set());
      setBatchAction(null);
      setBatchCohort('');
      setSelectedMentorId('');
      await fetchUsers();
    } catch {
      alert('批量操作失败');
    } finally {
      setBatchProcessing(false);
    }
  };

  // --- Fetch stage rules from real API ---
  const fetchStageRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/stage-rules');
      if (res.ok) {
        const json = await res.json();
        setStageRules(json.all || []);
        setRulesLoading(false);
        return;
      }
    } catch {
      // fallback
    }
    setStageRules([]);
    setRulesLoading(false);
  }, []);

  useEffect(() => { fetchStageRules(); }, [fetchStageRules]);

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
      setStageApplications([]);
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

  // --- User delete handler ---
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可恢复。')) return;
    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchUsers();
      } else {
        const json = await res.json();
        alert(json.error || '删除失败');
      }
    } catch {
      alert('删除失败，请检查网络连接');
    }
  };

  const handleResetPassword = async (userId: string, realName: string) => {
    if (!confirm(`确定要将 ${realName} 的密码重置为默认密码吗？重置后该用户下次登录需修改密码。`)) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: 'bt2026', resetPassword: true }),
      });
      if (res.ok) {
        alert(`${realName} 的密码已重置，该用户下次登录需修改密码`);
      } else {
        const json = await res.json();
        alert(json.error || '重置密码失败');
      }
    } catch {
      alert('重置密码失败，请检查网络连接');
    }
  };

  const handleToggleStatus = async (userId: string, realName: string, newStatus: string) => {
    const action = newStatus === 'active' ? '启用' : '禁用';
    if (!confirm(`确定要${action} ${realName} 的账号吗？`)) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const json = await res.json();
        alert(json.error || `${action}失败`);
      }
    } catch {
      alert(`${action}失败，请检查网络连接`);
    }
  };

  // --- Stage rule delete handler ---
  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('确定要删除此规则吗？')) return;
    try {
      const res = await fetch(`/api/stage-rules?id=${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchStageRules();
      } else {
        const json = await res.json();
        alert(json.error || '删除失败');
      }
    } catch {
      alert('删除失败，请检查网络连接');
    }
  };

  // --- Derived data ---
  const processThresholds = thresholds.filter(t => t.category === 'process');
  const resultThresholds = thresholds.filter(t => t.category === 'result');

  const promotionRules = stageRules.filter(r => r.rule_type === 'promotion');
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
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">配置阈值、管理用户与阶段规则</p>
          <button
            onClick={() => setShowChangePwd(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Lock className="w-4 h-4" />
            修改密码
          </button>
        </div>
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
                          <ThresholdInput label="合格" value={t.qualified_value} color="red" onChange={(v) => updateThreshold(t.id, 'qualified_value', v)} />
                          <ThresholdInput label="良好" value={t.good_value} color="amber" onChange={(v) => updateThreshold(t.id, 'good_value', v)} />
                          <ThresholdInput label="优秀" value={t.excellent_value} color="green" onChange={(v) => updateThreshold(t.id, 'excellent_value', v)} />
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
                          <ThresholdInput label="合格" value={t.qualified_value} color="red" onChange={(v) => updateThreshold(t.id, 'qualified_value', v)} />
                          <ThresholdInput label="良好" value={t.good_value} color="amber" onChange={(v) => updateThreshold(t.id, 'good_value', v)} />
                          <ThresholdInput label="优秀" value={t.excellent_value} color="green" onChange={(v) => updateThreshold(t.id, 'excellent_value', v)} />
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
                  {thresholdsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </button>
                {saveMessage && (
                  <div className={`flex items-center gap-1.5 text-sm ${
                    saveMessage.type === 'success' ? 'text-[#22c55e]' : 'text-destructive'
                  }`}>
                    {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {saveMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========== Tab: 用户管理 =========== */}
          {activeTab === 'users' && (
            <div className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">用户管理</h2>
                  <span className="text-xs text-muted-foreground ml-1">{users.length} 位用户</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUserDialog({ mode: 'add', user: null })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加用户
                  </button>
                </div>
              </div>

              {/* 子Tab: 新人管理 / 团队管理 */}
              <div className="px-5 pt-3 pb-0 flex items-center gap-1 border-b border-border">
                <button
                  onClick={() => { setUserSubTab('trainees'); setSelectedUserIds(new Set()); setBatchAction(null); }}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    userSubTab === 'trainees'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  新人管理
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/10 text-[10px] text-primary">
                    {traineeUsers.length}
                  </span>
                </button>
                <button
                  onClick={() => { setUserSubTab('staff'); setSelectedUserIds(new Set()); setBatchAction(null); }}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    userSubTab === 'staff'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  团队管理
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-[10px] text-muted-foreground">
                    {staffUsers.length}
                  </span>
                </button>
              </div>

              {/* 新人管理 Tab 内容 */}
              {userSubTab === 'trainees' && (
              <>
              {/* Cohort筛选 + 批量操作栏 */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={cohortFilter}
                    onChange={e => setCohortFilter(e.target.value)}
                    className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="all">全部期数</option>
                    {cohortOptions.map(c => (
                      <option key={c} value={c}>{c}期</option>
                    ))}
                  </select>
                </div>
                {selectedUserIds.size > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-primary">
                      已选择 {selectedUserIds.size} 位学员
                    </span>
                    <button
                      onClick={() => setBatchAction('cohort')}
                      className="h-7 px-3 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      批量分配期数
                    </button>
                    <button
                      onClick={() => setBatchAction('stage')}
                      className="h-7 px-3 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      批量调整阶段
                    </button>
                    <button
                      onClick={() => setBatchAction('mentor')}
                      className="h-7 px-3 rounded-md border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      分配导师
                    </button>
                    <button
                      onClick={() => { setSelectedUserIds(new Set()); setBatchAction(null); }}
                      className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      取消选择
                    </button>
                  </div>
                )}
              </div>

              {/* 批量操作输入区 */}
              {batchAction && selectedUserIds.size > 0 && (
                <div className="px-5 py-3 bg-muted/50 border-b border-border flex items-center gap-3">
                  {batchAction === 'cohort' && (
                    <>
                      <label className="text-xs text-muted-foreground">目标期数：</label>
                      <input
                        type="text"
                        value={batchCohort}
                        onChange={e => setBatchCohort(e.target.value)}
                        placeholder="如：2026-Q3"
                        className="h-8 w-40 rounded-md border border-border bg-transparent px-3 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </>
                  )}
                  {batchAction === 'stage' && (
                    <>
                      <label className="text-xs text-muted-foreground">目标阶段：</label>
                      <select
                        value={batchStage}
                        onChange={e => setBatchStage(Number(e.target.value))}
                        className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value={1}>阶段1-学习期</option>
                        <option value={2}>阶段2-练习期</option>
                        <option value={3}>阶段3-独立期</option>
                        <option value={4}>阶段4-熟练期</option>
                      </select>
                    </>
                  )}
                  {batchAction === 'mentor' && (
                    <>
                      <label className="text-xs text-muted-foreground">选择导师：</label>
                      <select
                        value={selectedMentorId}
                        onChange={e => setSelectedMentorId(e.target.value)}
                        className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="">-- 请选择 --</option>
                        {mentorList.map(m => (
                          <option key={m.id} value={m.id}>{m.realName} ({m.username})</option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    onClick={handleBatchAction}
                    disabled={batchProcessing || (batchAction === 'cohort' && !batchCohort) || (batchAction === 'mentor' && !selectedMentorId)}
                    className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {batchProcessing ? '执行中...' : '确认执行'}
                  </button>
                  <button
                    onClick={() => setBatchAction(null)}
                    className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}

              {usersLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : traineeUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">暂无新人数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={traineeUsers.length > 0 && selectedUserIds.size === traineeUsers.length}
                            onChange={toggleSelectAll}
                            className="rounded border-border"
                          />
                        </th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">姓名</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">用户名</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">角色</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">阶段</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">期数</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">职位</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">部门</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">带教老师</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">状态</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {traineeUsers.map(user => {
                        const roleStyle = ROLE_BADGE_MAP[user.roleName] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                        const displayName = getRoleDisplayName(user.roleName);
                        return (
                          <tr key={user.id} className={`hover:bg-muted/50 transition-colors ${selectedUserIds.has(user.id) ? 'bg-primary/5' : ''}`}>
                            <td className="px-3 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(user.id)}
                                onChange={() => toggleSelectUser(user.id)}
                                className="rounded border-border"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                                  {(user.realName || '?').charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-foreground">{user.realName}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-sm text-muted-foreground font-mono">{user.username}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                                {displayName}
                              </span>
                              {user.isSuperAdmin && (
                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b]">
                                  超管
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                                {getStageLabel(user.stage)}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${
                                user.cohort ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>
                                {user.cohort || '未分配'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${
                                user.position ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-muted text-muted-foreground'
                              }`}>
                                {user.position || '未设置'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${
                                user.department ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>
                                {user.department || '未设置'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${
                                user.mentorName ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>
                                {user.mentorName || '未分配'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                user.status === 'active' ? 'text-[#22c55e]' : 'text-muted-foreground'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  user.status === 'active' ? 'bg-[#22c55e]' : 'bg-muted-foreground/40'
                                }`} />
                                {user.status === 'active' ? '在职' : '停用'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setUserDialog({ mode: 'edit', user })}
                                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                  title="编辑"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleResetPassword(user.id, user.realName)}
                                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                  title="重置密码"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                {user.status === 'active' ? (
                                  <button
                                    onClick={() => handleToggleStatus(user.id, user.realName, 'inactive')}
                                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="禁用账号"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleStatus(user.id, user.realName, 'active')}
                                    className="p-1.5 rounded-md hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"
                                    title="启用账号"
                                  >
                                    <UserCheck2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </>
              )}

              {/* 团队管理 Tab 内容 */}
              {userSubTab === 'staff' && (
              <>
              {usersLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : staffUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">暂无团队成员数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">姓名</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">用户名</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">角色</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">状态</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {staffUsers.map(user => {
                        const roleStyle = ROLE_BADGE_MAP[user.roleName] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                        const displayName = getRoleDisplayName(user.roleName);
                        return (
                          <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                                  {(user.realName || '?').charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-foreground">{user.realName}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-sm text-muted-foreground font-mono">{user.username}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                                {displayName}
                              </span>
                              {user.isSuperAdmin && (
                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b]">
                                  超管
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                user.status === 'active' ? 'text-[#22c55e]' : 'text-muted-foreground'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  user.status === 'active' ? 'bg-[#22c55e]' : 'bg-muted-foreground/40'
                                }`} />
                                {user.status === 'active' ? '在职' : '停用'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setUserDialog({ mode: 'edit', user })}
                                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                  title="编辑"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleResetPassword(user.id, user.realName)}
                                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                  title="重置密码"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(user.id, user.status, user.realName)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    user.status === 'active'
                                      ? 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                                      : 'hover:bg-[#22c55e]/10 text-muted-foreground hover:text-[#22c55e]'
                                  }`}
                                  title={user.status === 'active' ? '停用' : '启用'}
                                >
                                  {user.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </>
              )}
            </div>
          )}

          {/* =========== Tab: 阶段规则 =========== */}
          {activeTab === 'stages' && (
            <div className="space-y-6">
              {/* 晋升规则 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#22c55e]" />
                    <h2 className="text-base font-semibold text-foreground">晋升规则</h2>
                    <span className="text-xs text-muted-foreground ml-1">{promotionRules.length} 条</span>
                  </div>
                  <button
                    onClick={() => setRuleDialog({ rule_type: 'promotion', from_stage: 1, to_stage: 2 })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#22c55e] text-white text-xs font-medium hover:bg-[#22c55e]/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增
                  </button>
                </div>
                <div className="p-5">
                  {rulesLoading ? (
                    <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
                  ) : promotionRules.length === 0 ? (
                    <div className="py-8 text-center">
                      <GitBranch className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无晋升规则</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {promotionRules.map(rule => (
                        <div key={rule.id} className="flex items-center gap-4 p-4 rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5">
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#22c55e]/15 text-[#22c55e] text-sm font-bold">{rule.from_stage}</span>
                            <ArrowRight className="w-5 h-5 text-[#22c55e]/60" />
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#22c55e]/15 text-[#22c55e] text-sm font-bold">{rule.to_stage}</span>
                          </div>
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${rule.is_active ? 'text-[#22c55e]' : 'text-muted-foreground'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${rule.is_active ? 'bg-[#22c55e]' : 'bg-muted-foreground/40'}`} />
                              {rule.is_active ? '生效中' : '已停用'}
                            </span>
                            <button onClick={() => setRuleDialog(rule)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="编辑">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 预警规则 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                    <h2 className="text-base font-semibold text-foreground">预警规则</h2>
                    <span className="text-xs text-muted-foreground ml-1">{warningRules.length} 条</span>
                  </div>
                  <button
                    onClick={() => setRuleDialog({ rule_type: 'warning', from_stage: 0, to_stage: 0 })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#f59e0b] text-white text-xs font-medium hover:bg-[#f59e0b]/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增
                  </button>
                </div>
                <div className="p-5">
                  {rulesLoading ? (
                    <div className="space-y-3">{[1].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
                  ) : warningRules.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无预警规则</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {warningRules.map(rule => (
                        <div key={rule.id} className="flex items-start gap-4 p-4 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/5">
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#f59e0b]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                              生效中
                            </span>
                            <button onClick={() => setRuleDialog(rule)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="编辑">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 降级规则 */}
              <div className="bg-card rounded-lg shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <h2 className="text-base font-semibold text-foreground">降级规则</h2>
                    <span className="text-xs text-muted-foreground ml-1">{demotionRules.length} 条</span>
                  </div>
                  <button
                    onClick={() => setRuleDialog({ rule_type: 'demotion', from_stage: 3, to_stage: 2 })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增
                  </button>
                </div>
                <div className="p-5">
                  {demotionRules.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">暂无降级规则</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {demotionRules.map(rule => (
                        <div key={rule.id} className="flex items-start gap-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15 text-destructive text-sm font-bold">{rule.from_stage}</span>
                            <ArrowRight className="w-5 h-5 text-destructive/60" />
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15 text-destructive text-sm font-bold">{rule.to_stage}</span>
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                              生效中
                            </span>
                            <button onClick={() => setRuleDialog(rule)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="编辑">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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

      {/* === Dialogs === */}
      {userDialog && (
        <UserDialog
          mode={userDialog.mode}
          user={userDialog.user}
          onClose={() => setUserDialog(null)}
          onSaved={() => { setUserDialog(null); fetchUsers(); }}
        />
      )}
      {ruleDialog !== null && (
        <StageRuleDialog
          rule={ruleDialog}
          onClose={() => setRuleDialog(null)}
          onSaved={() => { setRuleDialog(null); fetchStageRules(); }}
        />
      )}

      {/* 修改密码弹窗 */}
      {showChangePwd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">修改密码</h3>
              <button onClick={() => { setShowChangePwd(false); setChangePwdError(''); setChangePwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' }); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setChangePwdError('');
              if (!changePwdForm.oldPassword || !changePwdForm.newPassword || !changePwdForm.confirmPassword) {
                setChangePwdError('请填写所有字段');
                return;
              }
              if (changePwdForm.newPassword.length < 6) {
                setChangePwdError('新密码至少6位');
                return;
              }
              if (changePwdForm.newPassword !== changePwdForm.confirmPassword) {
                setChangePwdError('两次输入的新密码不一致');
                return;
              }
              if (changePwdForm.oldPassword === changePwdForm.newPassword) {
                setChangePwdError('新密码不能与旧密码相同');
                return;
              }
              setChangePwdLoading(true);
              try {
                const res = await fetch('/api/auth/change-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ oldPassword: changePwdForm.oldPassword, newPassword: changePwdForm.newPassword }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setChangePwdError(data.error || '修改密码失败');
                  return;
                }
                setShowChangePwd(false);
                setChangePwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                alert('密码修改成功');
              } catch {
                setChangePwdError('网络错误，请重试');
              } finally {
                setChangePwdLoading(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">旧密码</label>
                <input type="password" value={changePwdForm.oldPassword} onChange={e => setChangePwdForm(prev => ({ ...prev, oldPassword: e.target.value }))} placeholder="请输入旧密码" className="w-full px-4 py-2.5 rounded-md border border-border bg-muted text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">新密码</label>
                <input type="password" value={changePwdForm.newPassword} onChange={e => setChangePwdForm(prev => ({ ...prev, newPassword: e.target.value }))} placeholder="请输入新密码（至少6位）" className="w-full px-4 py-2.5 rounded-md border border-border bg-muted text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">确认新密码</label>
                <input type="password" value={changePwdForm.confirmPassword} onChange={e => setChangePwdForm(prev => ({ ...prev, confirmPassword: e.target.value }))} placeholder="请再次输入新密码" className="w-full px-4 py-2.5 rounded-md border border-border bg-muted text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm" required />
              </div>
              {changePwdError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-2.5 text-sm text-destructive">{changePwdError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowChangePwd(false); setChangePwdError(''); setChangePwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' }); }} className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">取消</button>
                <button type="submit" disabled={changePwdLoading} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {changePwdLoading ? '提交中...' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
