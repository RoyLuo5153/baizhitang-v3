'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import {
  BookOpen, Target, CheckCircle2, Clock, ChevronRight, ChevronDown, ChevronUp,
  Users, AlertTriangle, ClipboardCheck, BarChart3,
  PlayCircle, FileText, Settings, MessageSquare, Star,
  TrendingUp, Shield, Zap, Eye, Calendar, Pencil, Plus, Trash2, Send, Check, X, Lock, Activity
} from 'lucide-react';

interface TodayPlan {
  id: number;
  dayIndex: number;
  taskType: string;
  taskTitle: string;
  taskDescription: string;
  standard: string;
  deadlineType: string;
  deadlineTime: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  relatedLevelId: number | null;
  sortOrder: number;
  isUnlocked: boolean;
  isSuggested: boolean;
  suggestedBy: string | null;
  reviewStatus: string;
}

interface WeekDay {
  day: number;
  total: number;
  completed: number;
  isToday: boolean;
  isFuture: boolean;
  isUnlocked: boolean;
}

// ========== 赋能任务卡片 ==========
interface EmpowerTask {
  id: number;
  planName: string;
  status: string;
  assignedAt: string;
  deadline: string | null;
  progress: number;
}

function EmpowerTasksCard({ userId }: { userId?: string }) {
  const [tasks, setTasks] = useState<EmpowerTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`/api/empower/executions?traineeId=${userId}&status=assigned,in_progress`);
        if (res.ok) {
          const result = await res.json();
          setTasks(result.executions || []);
        }
      } catch {
        // 静默失败
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>我的赋能任务</h2>
        </div>
        <div className="text-sm" style={{ color: '#667085' }}>加载中...</div>
      </div>
    );
  }

  if (tasks.length === 0) return null;

  const statusLabel: Record<string, string> = { assigned: '待开始', in_progress: '进行中', completed: '已完成' };
  const statusColor: Record<string, string> = { assigned: '#F59E0B', in_progress: '#2978B5', completed: '#2E7D32' };

  return (
    <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>我的赋能任务</h2>
        </div>
        <Link href="/empowerment" className="text-xs flex items-center gap-1" style={{ color: '#2978B5' }}>
          查看全部 <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#F8F6F0' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: '#102A43' }}>{task.planName}</div>
              <div className="text-xs mt-1" style={{ color: '#667085' }}>
                {task.deadline && `截止: ${task.deadline.slice(0, 10)}`}
                {task.progress > 0 && ` · 进度 ${task.progress}%`}
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full ml-3 whitespace-nowrap" style={{
              backgroundColor: `${statusColor[task.status] || '#667085'}15`,
              color: statusColor[task.status] || '#667085'
            }}>
              {statusLabel[task.status] || task.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== 新人成长计划首页 ==========
function TraineeHome({ data }: { data: any }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<TodayPlan[]>(data.todayPlans || []);
  const [selectedDay, setSelectedDay] = useState(data.currentDayIndex || 1);
  const [dayPlansLoading, setDayPlansLoading] = useState(false);

  // 切换天数时重新获取数据
  const fetchDayPlans = useCallback(async (dayIndex: number) => {
    setDayPlansLoading(true);
    try {
      const res = await fetch(`/api/growth-plan?userId=${data.userId || user?.id}&dayIndex=${dayIndex}`);
      if (res.ok) {
        const result = await res.json();
        setPlans(result.todayPlans || []);
      }
    } catch (e) {
      console.error('Failed to fetch day plans:', e);
    } finally {
      setDayPlansLoading(false);
    }
  }, [data.userId, user?.id]);

  const handleDayChange = useCallback((day: number) => {
    setSelectedDay(day);
    fetchDayPlans(day);
  }, [fetchDayPlans]);

  const toggleComplete = useCallback(async (planId: number, isCompleted: boolean, isUnlocked: boolean) => {
    if (!isUnlocked) return; // 未解锁不可操作
    try {
      const res = await fetch('/api/growth-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, isCompleted: !isCompleted }),
      });
      if (res.ok) {
        setPlans(prev => prev.map(p => p.id === planId ? { ...p, isCompleted: !isCompleted, completedAt: !isCompleted ? new Date().toISOString() : null } : p));
      }
    } catch (e) {
      console.error('Failed to toggle plan:', e);
    }
  }, []);

  const weekOverview: WeekDay[] = data.weekOverview || [];
  const currentStage = data.currentStage || {};
  const passedLevels = data.passedLevels || 0;
  const role = user?.role || '';

  // 判断是否为管理模式（培训负责人可编辑，带教/培训老师可建议）
  const canEdit = role === 'training_manager';
  const canSuggest = role === 'mentor' || role === 'teacher';

  return (
    <div className="space-y-6">
      {/* 成长阶段进度 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color: '#2978B5' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>成长阶段</h2>
          </div>
          <span className="text-sm" style={{ color: '#667085' }}>
            当前: {currentStage.name || '首通电话'} · 闯关通过 {passedLevels}/7
          </span>
        </div>
        <div className="flex gap-2">
          {(data.stages || []).map((s: any, idx: number) => (
            <div key={idx} className="flex-1 p-3 rounded-lg text-center" style={{
              backgroundColor: s.isActive ? '#2978B5' : s.isCompleted ? '#2E7D3215' : '#F0EDE6',
              color: s.isActive ? '#fff' : s.isCompleted ? '#2E7D32' : '#667085'
            }}>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs mt-1 opacity-80">{s.requirement}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 双线状态卡 */}
      {data.dualTrackStatus && (
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" style={{ color: '#102A43' }} />
              <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>双线状态</h2>
            </div>
            <Link href="/diagnosis" className="text-xs flex items-center gap-1" style={{ color: '#2978B5' }}>
              查看诊断 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#102A4308' }}>
              <div className="text-xs mb-1" style={{ color: '#667085' }}>当前阶段</div>
              <div className="text-sm font-semibold" style={{ color: '#102A43' }}>
                {({ foundation: '首通电话', practice: '三天回访', independent: '五天预约', proficient: '面诊当天' } as Record<string, string>)[data.dualTrackStatus.stage] || '首通电话'}
              </div>
              <div className="text-xs mt-1" style={{ color: '#667085' }}>通关 {data.dualTrackStatus.moduleProgress}</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#2978B508' }}>
              <div className="text-xs mb-1" style={{ color: '#667085' }}>过程线</div>
              <div className="text-sm font-semibold" style={{
                color: ({ not_started: '#667085', monitoring: '#2978B5', flagged: '#E65100', passed: '#2E7D32' } as Record<string, string>)[data.dualTrackStatus.processStatus] || '#667085'
              }}>
                {({ not_started: '未开始', monitoring: '监控中', flagged: '预警', passed: '已通过' } as Record<string, string>)[data.dualTrackStatus.processStatus] || '未开始'}
              </div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#F59E0B08' }}>
              <div className="text-xs mb-1" style={{ color: '#667085' }}>结果线</div>
              <div className="text-sm font-semibold" style={{
                color: ({ not_started: '#667085', insufficient_data: '#667085', monitoring: '#2978B5', yellow_alert: '#E65100', red_alert: '#E53935', passed: '#2E7D32' } as Record<string, string>)[data.dualTrackStatus.resultStatus] || '#667085'
              }}>
                {({ not_started: '未开始', insufficient_data: '数据不足', monitoring: '监控中', yellow_alert: '黄灯', red_alert: '红灯', passed: '已通过' } as Record<string, string>)[data.dualTrackStatus.resultStatus] || '未开始'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 我的赋能任务 */}
      <EmpowerTasksCard userId={data.userId || user?.id} />

      {/* 7天排课概览 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>首通电话7天排课</h2>
          </div>
          {(canEdit || canSuggest) && (
            <span className="text-xs px-2 py-1 rounded-full" style={{
              backgroundColor: canEdit ? '#2978B515' : '#F59E0B15',
              color: canEdit ? '#2978B5' : '#F59E0B'
            }}>
              {canEdit ? '编辑模式' : '建议模式'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {weekOverview.map((wd: WeekDay) => (
            <button key={wd.day} onClick={() => handleDayChange(wd.day)}
              className="flex-1 p-3 rounded-lg text-center transition-colors relative" style={{
                backgroundColor: selectedDay === wd.day ? '#2978B5' :
                  wd.isToday ? '#2978B515' : '#F0EDE6',
                color: selectedDay === wd.day ? '#fff' :
                  wd.isToday ? '#2978B5' : '#667085',
                opacity: wd.isFuture && !wd.isUnlocked ? 0.6 : 1
              }}>
              <div className="text-sm font-medium">Day{wd.day}</div>
              <div className="text-xs mt-1">{wd.completed}/{wd.total}</div>
              {!wd.isUnlocked && wd.isFuture && (
                <Lock className="w-3 h-3 absolute top-1 right-1" style={{ color: selectedDay === wd.day ? '#fff' : '#667085' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 当日任务列表 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" style={{ color: '#2978B5' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>
              Day{selectedDay} 任务
            </h2>
          </div>
          <span className="text-sm" style={{ color: '#667085' }}>
            {plans.filter(p => p.isCompleted).length}/{plans.length} 已完成
          </span>
        </div>

        {dayPlansLoading ? (
          <div className="text-center py-8 text-sm" style={{ color: '#667085' }}>加载中...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: '#667085' }}>当天暂无任务安排</div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => (
              <TaskCard
                key={plan.id}
                plan={plan}
                role={role}
                canEdit={canEdit}
                canSuggest={canSuggest}
                onToggleComplete={toggleComplete}
                onPlanUpdate={() => fetchDayPlans(selectedDay)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 快捷操作台 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#102A43' }}>快捷操作</h2>
        <div className="grid grid-cols-3 gap-3">
          {(data.quickActions || []).map((action: any) => (
            <Link key={action.href} href={action.href}
              className="flex items-center gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow"
              style={{ borderColor: '#E6E1D8' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                <ChevronRight className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium" style={{ color: '#102A43' }}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 任务卡片组件（支持编辑/建议/只读） ==========
function TaskCard({ plan, role, canEdit, canSuggest, onToggleComplete, onPlanUpdate }: {
  plan: TodayPlan;
  role: string;
  canEdit: boolean;
  canSuggest: boolean;
  onToggleComplete: (id: number, completed: boolean, unlocked: boolean) => void;
  onPlanUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(plan.taskTitle);
  const [editDesc, setEditDesc] = useState(plan.taskDescription);
  const [editStandard, setEditStandard] = useState(plan.standard);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestReason, setSuggestReason] = useState('');
  const isTrainee = role === 'trainee';
  const isLocked = !plan.isUnlocked && !canEdit;

  // 保存编辑（培训负责人）
  const handleSaveEdit = async () => {
    try {
      const res = await fetch('/api/growth-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          taskTitle: editTitle,
          taskDescription: editDesc,
          standard: editStandard,
        }),
      });
      if (res.ok) {
        setEditing(false);
        onPlanUpdate();
      }
    } catch (e) {
      console.error('Failed to update plan:', e);
    }
  };

  // 提交建议（带教老师/培训老师）
  const handleSubmitSuggestion = async () => {
    if (!suggestTitle.trim()) return;
    try {
      const res = await fetch('/api/growth-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest',
          replacePlanId: plan.id,
          userId: plan.dayIndex ? undefined : undefined, // same user
          dayIndex: plan.dayIndex,
          taskTitle: suggestTitle,
          taskDescription: suggestReason,
          taskType: plan.taskType,
          standard: plan.standard,
          sortOrder: plan.sortOrder,
        }),
      });
      if (res.ok) {
        setSuggesting(false);
        setSuggestTitle('');
        setSuggestReason('');
        onPlanUpdate();
      }
    } catch (e) {
      console.error('Failed to submit suggestion:', e);
    }
  };

  // 审核建议（培训负责人）
  const handleReview = async (approved: boolean) => {
    try {
      const res = await fetch('/api/growth-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          planId: plan.id,
          approved,
        }),
      });
      if (res.ok) {
        onPlanUpdate();
      }
    } catch (e) {
      console.error('Failed to review suggestion:', e);
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${isLocked ? 'opacity-60' : ''}`} style={{
      borderColor: plan.isCompleted ? '#2E7D3240' : '#E6E1D8',
      backgroundColor: plan.isCompleted ? '#2E7D3208' :
        plan.reviewStatus === 'pending' ? '#F59E0B08' : '#fff'
    }}>
      <div className="flex items-start gap-3">
        {/* 完成状态指示 */}
        <button
          onClick={() => !isLocked && onToggleComplete(plan.id, plan.isCompleted, plan.isUnlocked)}
          disabled={isLocked || (isTrainee && isLocked)}
          className="mt-0.5 flex-shrink-0"
        >
          {plan.isCompleted ? (
            <CheckCircle2 className="w-5 h-5" style={{ color: '#2E7D32' }} />
          ) : isLocked ? (
            <Lock className="w-5 h-5" style={{ color: '#667085' }} />
          ) : (
            <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: '#E6E1D8' }} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            /* 编辑模式 */
            <div className="space-y-2">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded border text-sm" style={{ borderColor: '#E6E1D8' }} />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                className="w-full px-3 py-1.5 rounded border text-sm" rows={2} style={{ borderColor: '#E6E1D8' }} />
              <input value={editStandard} onChange={e => setEditStandard(e.target.value)}
                className="w-full px-3 py-1.5 rounded border text-sm" style={{ borderColor: '#E6E1D8' }} />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit}
                  className="text-xs px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: '#2978B5' }}>保存</button>
                <button onClick={() => setEditing(false)}
                  className="text-xs px-3 py-1.5 rounded-md" style={{ color: '#667085' }}>取消</button>
              </div>
            </div>
          ) : (
            /* 展示模式 */
            <>
              <div className="flex items-center gap-2 mb-1">
                <TaskTypeBadge type={plan.taskType} />
                <span className="text-sm font-medium" style={{ color: '#102A43' }}>{plan.taskTitle}</span>
                {plan.isSuggested && plan.reviewStatus === 'pending' && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F59E0B15', color: '#F59E0B' }}>待审核</span>
                )}
                {plan.isSuggested && plan.reviewStatus === 'approved' && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2E7D3215', color: '#2E7D32' }}>已采纳</span>
                )}
              </div>
              {plan.taskDescription && (
                <p className="text-xs mb-1" style={{ color: '#667085' }}>{plan.taskDescription}</p>
              )}
              {plan.standard && (
                <p className="text-xs mb-1" style={{ color: '#2978B5' }}>达标: {plan.standard}</p>
              )}
              {plan.deadlineTime && (
                <div className="flex items-center gap-1 text-xs" style={{ color: '#667085' }}>
                  <Clock className="w-3 h-3" /> 截止 {plan.deadlineTime}
                </div>
              )}
            </>
          )}
        </div>

        {/* 操作按钮 */}
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && (
              <>
                <button onClick={() => setEditing(true)}
                  className="p-1.5 rounded hover:bg-muted" title="编辑任务">
                  <Pencil className="w-3.5 h-3.5" style={{ color: '#2978B5' }} />
                </button>
                {plan.isSuggested && plan.reviewStatus === 'pending' && (
                  <>
                    <button onClick={() => handleReview(true)}
                      className="p-1.5 rounded hover:bg-muted" title="采纳建议">
                      <Check className="w-3.5 h-3.5" style={{ color: '#2E7D32' }} />
                    </button>
                    <button onClick={() => handleReview(false)}
                      className="p-1.5 rounded hover:bg-muted" title="拒绝建议">
                      <X className="w-3.5 h-3.5" style={{ color: '#E65100' }} />
                    </button>
                  </>
                )}
              </>
            )}
            {canSuggest && !plan.isSuggested && (
              <button onClick={() => setSuggesting(true)}
                className="p-1.5 rounded hover:bg-muted" title="建议修改">
                <Send className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
              </button>
            )}
            {plan.relatedLevelId && (
              <Link href="/learning"
                className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                去闯关
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 建议弹窗 */}
      {suggesting && (
        <div className="mt-3 p-3 rounded-lg border" style={{ borderColor: '#F59E0B40', backgroundColor: '#FFF8E1' }}>
          <div className="text-xs font-medium mb-2" style={{ color: '#F59E0B' }}>提交任务修改建议（由培训负责人审核）</div>
          <input value={suggestTitle} onChange={e => setSuggestTitle(e.target.value)}
            placeholder="建议的任务名称" className="w-full px-3 py-1.5 rounded border text-sm mb-2" style={{ borderColor: '#E6E1D8' }} />
          <textarea value={suggestReason} onChange={e => setSuggestReason(e.target.value)}
            placeholder="修改原因说明" className="w-full px-3 py-1.5 rounded border text-sm" rows={2} style={{ borderColor: '#E6E1D8' }} />
          <div className="flex gap-2 mt-2">
            <button onClick={handleSubmitSuggestion}
              className="text-xs px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: '#F59E0B' }}>提交建议</button>
            <button onClick={() => setSuggesting(false)}
              className="text-xs px-3 py-1.5 rounded-md" style={{ color: '#667085' }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 带教老师看板 ==========
function MentorHome({ data }: { data: any }) {
  const [pushingPlanId, setPushingPlanId] = useState<string | null>(null);
  const [pushedPlans, setPushedPlans] = useState<Set<string>>(new Set());

  const stageNames: Record<string, string> = { foundation: '首通电话', practice: '三天回访', independent: '五天预约', proficient: '面诊当天' };
  const processLabels: Record<string, { text: string; bg: string; color: string }> = {
    not_started: { text: '未开始', bg: '#E6E1D830', color: '#667085' },
    monitoring: { text: '监控中', bg: '#2978B515', color: '#2978B5' },
    flagged: { text: '预警', bg: '#F59E0B20', color: '#E65100' },
    passed: { text: '已通过', bg: '#2E7D3215', color: '#2E7D32' },
  };
  const resultLabels: Record<string, { text: string; bg: string; color: string }> = {
    not_started: { text: '未开始', bg: '#E6E1D830', color: '#667085' },
    insufficient_data: { text: '数据不足', bg: '#E6E1D830', color: '#667085' },
    monitoring: { text: '监控中', bg: '#2978B515', color: '#2978B5' },
    yellow_alert: { text: '黄灯', bg: '#F59E0B20', color: '#E65100' },
    red_alert: { text: '红灯', bg: '#E5393520', color: '#E53935' },
    passed: { text: '已通过', bg: '#2E7D3215', color: '#2E7D32' },
  };

  const handlePushPlan = async (planId: string, traineeId: string) => {
    setPushingPlanId(planId);
    try {
      const res = await fetch('/api/empower/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, traineeId }),
      });
      if (res.ok) {
        setPushedPlans(prev => new Set([...prev, `${planId}:${traineeId}`]));
      }
    } catch { /* ignore */ }
    setPushingPlanId(null);
  };

  // 预警学员数
  const alertMentees = (data.mentees || []).filter((m: any) => m.hasAlert);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <QuickStat icon={<Users className="w-5 h-5" />} label="带教新人" value={data.mentees?.length || 0} color="#2978B5" />
        <QuickStat icon={<ClipboardCheck className="w-5 h-5" />} label="待点评任务" value={data.pendingReviews?.length || 0} color="#F59E0B" />
        <QuickStat icon={<AlertTriangle className="w-5 h-5" />} label="预警学员" value={alertMentees.length} color="#E65100" />
      </div>

      {/* 预警学员赋能面板 — 只显示有异常的学员及其推荐赋能方案 */}
      {alertMentees.length > 0 && (
        <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ borderLeft: '4px solid #E65100' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5" style={{ color: '#E65100' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>待赋能学员</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E6510015', color: '#E65100' }}>{alertMentees.length}人</span>
          </div>
          <div className="space-y-3">
            {alertMentees.map((m: any) => {
              const ps = processLabels[m.processStatus] || processLabels.not_started;
              const rs = resultLabels[m.resultStatus] || resultLabels.not_started;
              return (
                <div key={m.id} className="p-4 rounded-lg border" style={{ borderColor: '#F59E0B40', backgroundColor: '#FFF8E130' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: '#E65100' }}>
                      {m.name?.slice(-1) || '?'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#102A43' }}>{m.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ps.bg, color: ps.color }}>过程: {ps.text}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: rs.bg, color: rs.color }}>结果: {rs.text}</span>
                  </div>
                  {/* 推荐赋能方案列表 */}
                  {m.recommendedPlans && m.recommendedPlans.length > 0 ? (
                    <div className="space-y-2 ml-10">
                      {m.recommendedPlans.map((rp: any, idx: number) => {
                        const alreadyPushed = rp.alreadyPushed || pushedPlans.has(`${rp.planId}:${m.id}`);
                        return (
                          <div key={idx} className="flex items-center gap-3 p-2.5 rounded-md" style={{ backgroundColor: '#F8F6F0' }}>
                            <Activity className="w-4 h-4 shrink-0" style={{ color: '#2978B5' }} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium" style={{ color: '#102A43' }}>{rp.planName}</span>
                            </div>
                            {alreadyPushed ? (
                              <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: '#2E7D3215', color: '#2E7D32' }}>
                                <Check className="w-3 h-3 inline mr-0.5" />已推送
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePushPlan(rp.planId, m.id)}
                                disabled={pushingPlanId === rp.planId}
                                className="text-xs px-3 py-1 rounded-md font-medium"
                                style={{ backgroundColor: '#2978B5', color: '#fff' }}>
                                <Send className="w-3 h-3 inline mr-0.5" />{pushingPlanId === rp.planId ? '推送中...' : '推送方案'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ml-10 text-xs" style={{ color: '#667085' }}>暂无匹配赋能方案</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 我带的新人 — 双线状态卡片 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: '#2978B5' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>我带的新人</h2>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#667085' }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#2978B5' }} />过程线</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#F59E0B' }} />结果线</span>
          </div>
        </div>
        <div className="space-y-3">
          {(data.mentees || []).map((m: any) => {
            const ps = processLabels[m.processStatus] || processLabels.not_started;
            const rs = resultLabels[m.resultStatus] || resultLabels.not_started;
            const isFlagged = m.processStatus === 'flagged' || m.resultStatus === 'yellow_alert' || m.resultStatus === 'red_alert';
            return (
              <div key={m.id} className={`flex items-center gap-4 p-4 rounded-lg border`}
                style={{ borderColor: isFlagged ? '#F59E0B60' : '#E6E1D8', backgroundColor: isFlagged ? '#FFF8E140' : 'transparent' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: isFlagged ? '#E65100' : '#2978B5' }}>
                  {m.name?.slice(-1) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: '#102A43' }}>{m.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                      {stageNames[m.stage] || m.stage || '首通电话'}
                    </span>
                    {/* 双线状态标签 */}
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ps.bg, color: ps.color }}>
                      过程: {ps.text}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: rs.bg, color: rs.color }}>
                      结果: {rs.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    {/* 模块进度 */}
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#667085' }}>
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>通关 {m.moduleProgress || '0/8'}</span>
                    </div>
                    {/* 成长计划进度 */}
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: '#E6E1D8' }}>
                        <div className="h-full rounded-full" style={{ width: `${m.planProgress}%`, backgroundColor: m.planProgress >= 80 ? '#2E7D32' : m.planProgress >= 50 ? '#F59E0B' : '#E65100' }} />
                      </div>
                      <span className="text-xs" style={{ color: '#667085' }}>{m.planProgress}%</span>
                    </div>
                  </div>
                </div>
                <Link href={`/trainee-board?userId=${m.id}`} className="text-xs px-3 py-1.5 rounded-md shrink-0"
                  style={{ backgroundColor: '#2978B5', color: '#fff' }}>详情</Link>
              </div>
            );
          })}
          {(!data.mentees || data.mentees.length === 0) && (
            <div className="text-center py-8 text-sm" style={{ color: '#667085' }}>暂无带教新人</div>
          )}
        </div>
      </div>

      {/* 待点评 */}
      {data.pendingReviews?.length > 0 && (
        <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>待点评任务</h2>
          </div>
          <div className="space-y-2">
            {data.pendingReviews.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#FFF8E1' }}>
                <FileText className="w-4 h-4" style={{ color: '#F59E0B' }} />
                <span className="text-sm" style={{ color: '#102A43' }}>{r.taskTitle}</span>
                <span className="text-xs ml-auto" style={{ color: '#667085' }}>
                  {new Date(r.submittedAt).toLocaleDateString()}
                </span>
                <Link href="/practice" className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#F59E0B', color: '#fff' }}>去点评</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 老师教务工作台 ==========
function TeacherHome({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <QuickStat icon={<ClipboardCheck className="w-5 h-5" />} label="待审核质检" value={data.pendingQcCount || 0} color="#F59E0B" />
        <QuickStat icon={<BookOpen className="w-5 h-5" />} label="今日课程" value={data.todaySessions?.length || 0} color="#2978B5" />
        <QuickStat icon={<BarChart3 className="w-5 h-5" />} label="已完成质检" value={0} color="#2E7D32" />
      </div>

      {/* 待审核质检 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>待审核质检</h2>
          </div>
          <Link href="/qc-review" className="text-xs" style={{ color: '#2978B5' }}>查看全部 →</Link>
        </div>
        {data.pendingQc?.length > 0 ? (
          <div className="space-y-2">
            {data.pendingQc.map((q: any) => (
              <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: '#E6E1D8' }}>
                <FileText className="w-4 h-4" style={{ color: '#2978B5' }} />
                <span className="text-sm" style={{ color: '#102A43' }}>质检 #{q.id}</span>
                <span className="text-xs ml-auto" style={{ color: '#667085' }}>{q.qcDate}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm" style={{ color: '#667085' }}>暂无待审核质检</div>
        )}
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-3 gap-4">
        {(data.quickActions || []).map((action: any) => (
          <Link key={action.href} href={action.href}
            className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow text-center">
            <div className="text-sm font-medium" style={{ color: '#102A43' }}>{action.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ========== 总经理概览 ==========
function BossHome({ data }: { data: any }) {
  const stageNames: Record<number, string> = { 1: '首通电话', 2: '三天回访', 3: '五天预约', 4: '面诊当天' };
  const metricLabels: Record<string, string> = {
    wechat_add_rate: '加V率', consultation_rate: '面诊率', reception_rate: '接诊率',
    delivery_rate: '签收率', medication_rate: '用药率', appointment_rate: '挂号率',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <QuickStat icon={<Users className="w-5 h-5" />} label="在培新人" value={data.totalTrainees || 0} color="#2978B5" />
        <QuickStat icon={<TrendingUp className="w-5 h-5" />} label="业务指标" value={`${Object.keys(data.avgMetrics || {}).length}项`} color="#F59E0B" />
      </div>

      {/* 阶段分布 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#102A43' }}>团队阶段分布</h2>
        <div className="flex gap-4">
          {Object.entries(data.stageDistribution || {}).map(([stage, count]: [string, any]) => (
            <div key={stage} className="flex-1 rounded-lg p-4 text-center" style={{ backgroundColor: '#2978B515' }}>
              <div className="text-2xl font-bold" style={{ color: '#2978B5' }}>{count}</div>
              <div className="text-xs mt-1" style={{ color: '#667085' }}>{stageNames[Number(stage)] || `阶段${stage}`}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 平均业务指标 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#102A43' }}>团队平均业务指标</h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(data.avgMetrics || {}).map(([key, val]: [string, any]) => (
            <div key={key} className="p-4 rounded-lg text-center" style={{ backgroundColor: '#F0F9FF' }}>
              <div className="text-xl font-bold" style={{ color: '#2978B5' }}>{val}%</div>
              <div className="text-xs mt-1" style={{ color: '#667085' }}>{metricLabels[key] || key}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Link href="/overview" className="text-sm" style={{ color: '#2978B5' }}>查看全局概览 →</Link>
      </div>
    </div>
  );
}

// ========== 通用组件 ==========
function TaskTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    study: { label: '学习', bg: '#E3F2FD', color: '#1565C0' },
    practice: { label: '实操', bg: '#FFF3E0', color: '#E65100' },
    quiz: { label: '考核', bg: '#FCE4EC', color: '#C62828' },
    review: { label: '复盘', bg: '#E8F5E9', color: '#2E7D32' },
  };
  const c = config[type] || config.study;
  return <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.color }}>{c.label}</span>;
}

function QuickStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
          {icon}
        </div>
        <span className="text-xs" style={{ color: '#667085' }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

// ========== 培训管理驾驶舱 ==========
function TrainingManagerHome({ data }: { data: any }) {
  const layer1 = data.layer1 || {};
  const layer2 = data.layer2 || {};
  const layer3 = data.layer3 || {};
  const [drillLayer2, setDrillLayer2] = useState(false);
  const [drillLayer3, setDrillLayer3] = useState(false);
  const stageNames: Record<number, string> = { 1: '首通电话', 2: '三天回访', 3: '五天预约', 4: '面诊当天' };
  const stageDist = layer1.stageDistribution || data.stats?.stageDistribution || {};
  const stageColors: Record<number, string> = { 1: '#2978B5', 2: '#F59E0B', 3: '#22C55E', 4: '#102A43' };
  const totalTrainees = data.stats?.totalTrainees || 0;

  const getStatusColor = (status: string) => {
    if (status === 'excellent' || status === 'good') return '#22C55E';
    if (status === 'warning') return '#F59E0B';
    return '#EF4444';
  };
  const getStatusLabel = (status: string) => {
    if (status === 'excellent') return '优秀';
    if (status === 'good') return '达标';
    if (status === 'warning') return '预警';
    return '不达标';
  };

  return (
    <div className="space-y-6">
      {/* 顶部概览统计 */}
      <div className="grid grid-cols-4 gap-4">
        <QuickStat icon={<Users className="w-5 h-5" />} label="在培新人" value={totalTrainees} color="#2978B5" />
        <QuickStat icon={<AlertTriangle className="w-5 h-5" />} label="质检预警" value={layer2.lowScoreWarnings?.length || 0} color="#E65100" />
        <QuickStat icon={<CheckCircle2 className="w-5 h-5" />} label="19动作通过率" value={`${layer2.actionPassRate || 0}%`} color={layer2.actionPassRate >= 80 ? '#2E7D32' : '#F59E0B'} />
        <QuickStat icon={<TrendingUp className="w-5 h-5" />} label="结果达标率" value={`${(layer3.resultMetrics || []).filter((m: any) => m.status === 'excellent' || m.status === 'good').length}/6`} color="#2978B5" />
      </div>

      {/* 三层递进质量把控 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 第一层：培训过程 */}
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2978B515' }}>
              <BookOpen className="w-4 h-4" style={{ color: '#2978B5' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#102A43' }}>第一层 · 培训过程</h3>
              <p className="text-xs" style={{ color: '#667085' }}>确保新人从不会做到会做</p>
            </div>
          </div>

          {/* 4阶段进度条 */}
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: (stageDist[s] || 0) > 0 ? stageColors[s] : '#E6E1D8' }} />
                <span className="text-xs" style={{ color: '#667085' }}>{stageNames[s]}</span>
              </div>
            ))}
          </div>

          {/* 阶段分布数字 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="text-center">
                <div className="text-lg font-bold" style={{ color: stageColors[s] }}>{stageDist[s] || 0}</div>
                <div className="text-xs" style={{ color: '#667085' }}>{stageNames[s]}</div>
              </div>
            ))}
          </div>

          {/* 课程完成率 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: '#667085' }}>课程完成率</span>
              <span className="text-xs font-bold" style={{ color: '#2978B5' }}>{layer1.courseCompletionRate || 0}%</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E6E1D8' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${layer1.courseCompletionRate || 0}%`, backgroundColor: '#2978B5' }} />
            </div>
          </div>

          {/* 阶段进阶待审批 */}
          {layer1.pendingStageApprovals?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: '#102A43' }}>进阶待审批</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#F59E0B15', color: '#F59E0B' }}>
                  {layer1.pendingStageApprovals.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {layer1.pendingStageApprovals.slice(0, 3).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#F8F6F0' }}>
                    <span className="text-xs font-medium" style={{ color: '#102A43' }}>{a.traineeName}</span>
                    <span className="text-xs" style={{ color: '#667085' }}>{stageNames[a.currentStage] || '首通电话'}→{stageNames[a.currentStage + 1] || '下一阶段'}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ backgroundColor: '#22C55E15', color: '#22C55E' }}
                        onClick={async () => {
                          const res = await fetch('/api/stage-promotion', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: a.userId, fromStage: a.currentStage, toStage: a.currentStage + 1, action: 'approve' }),
                          });
                          const result = await res.json();
                          if (result.success) {
                            window.location.reload();
                          } else {
                            alert(result.error || '进阶条件未满足');
                          }
                        }}
                      >审批</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href="/trainee-board" className="flex items-center gap-1 mt-3 text-xs" style={{ color: '#2978B5' }}>
            查看新人看板 <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* 第二层：过程质检 */}
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F59E0B15' }}>
              <Shield className="w-4 h-4" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#102A43' }}>第二层 · 过程质检</h3>
              <p className="text-xs" style={{ color: '#667085' }}>检查服务流程是否达标</p>
            </div>
          </div>

          {/* 4节点服务流程 */}
          <div className="flex items-center gap-0 mb-4">
            {[
              { name: '首通电话', score: layer2.avgScores?.communication || 0, weight: '30%' },
              { name: '第三天回访', score: layer2.avgScores?.service || 0, weight: '25%' },
              { name: '第五天预约', score: layer2.avgScores?.process || 0, weight: '30%' },
              { name: '面诊当天', score: layer2.avgScores?.business || 0, weight: '15%' },
            ].map((node, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="text-xs mb-1" style={{ color: '#667085' }}>{node.name}</div>
                <div className="text-lg font-bold" style={{ color: node.score >= 4 ? '#22C55E' : node.score >= 3 ? '#F59E0B' : '#EF4444' }}>
                  {node.score || '--'}
                </div>
                <div className="text-xs" style={{ color: '#667085' }}>{node.weight}</div>
                {i < 3 && <ChevronRight className="w-3 h-3 mx-auto mt-1" style={{ color: '#E6E1D8' }} />}
              </div>
            ))}
          </div>

          {/* 19动作通过率 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: '#667085' }}>19动作通过率</span>
              <span className="text-xs font-bold" style={{ color: layer2.actionPassRate >= 80 ? '#22C55E' : '#F59E0B' }}>
                {layer2.actionPassRate || 0}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E6E1D8' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${layer2.actionPassRate || 0}%`,
                backgroundColor: layer2.actionPassRate >= 80 ? '#22C55E' : layer2.actionPassRate >= 60 ? '#F59E0B' : '#EF4444'
              }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: '#667085' }}>目标: 80%</span>
              <span className="text-xs" style={{ color: layer2.actionPassRate >= 80 ? '#22C55E' : '#EF4444' }}>
                {layer2.actionPassRate >= 80 ? '已达标' : '未达标'}
              </span>
            </div>
          </div>

          {/* 低分预警 */}
          {layer2.lowScoreWarnings?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: '#102A43' }}>低分预警</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EF444415', color: '#EF4444' }}>
                  {layer2.lowScoreWarnings.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {layer2.lowScoreWarnings.map((w: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
                    <span className="text-xs font-medium" style={{ color: '#102A43' }}>{w.name}</span>
                    <span className="text-xs font-bold" style={{ color: '#EF4444' }}>{w.avgScore}分</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href="/qc-flow" className="flex items-center gap-1 mt-3 text-xs" style={{ color: '#2978B5' }}>
            服务质量追踪 <ChevronRight className="w-3 h-3" />
          </Link>

          {/* 下钻按钮 */}
          <button
            onClick={() => setDrillLayer2(!drillLayer2)}
            className="flex items-center gap-1 mt-2 text-xs w-full justify-center py-1.5 rounded-lg transition-colors"
            style={{ color: drillLayer2 ? '#2978B5' : '#667085', backgroundColor: drillLayer2 ? '#2978B510' : 'transparent' }}
          >
            {drillLayer2 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {drillLayer2 ? '收起新人明细' : '查看新人过程明细'}
          </button>

          {/* 过程线下钻：新人明细 */}
          {drillLayer2 && (layer2.traineeBreakdown || []).length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium mb-1" style={{ color: '#102A43' }}>新人过程质量明细</div>
              {(layer2.traineeBreakdown || []).map((t: any) => (
                <div key={t.userId} className="p-2.5 rounded-lg border" style={{
                  borderColor: t.bottlenecks.length > 0 ? '#EF444430' : '#E6E1D8',
                  backgroundColor: t.bottlenecks.length > 0 ? '#FEF2F2' : '#F8F6F0'
                }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: '#102A43' }}>{t.name}</span>
                      <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                        {stageNames[t.stage] || '首通电话'}
                      </span>
                    </div>
                    {t.bottlenecks.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EF444415', color: '#EF4444' }}>
                        {t.bottlenecks.length}个卡点
                      </span>
                    )}
                  </div>
                  {/* 4维度得分 */}
                  <div className="grid grid-cols-4 gap-1 mb-1.5">
                    {[
                      { name: '首通', val: t.qcScores.communication },
                      { name: '回访', val: t.qcScores.service },
                      { name: '预约', val: t.qcScores.process },
                      { name: '面诊', val: t.qcScores.business },
                    ].map((d, i) => (
                      <div key={i} className="text-center">
                        <div className="text-xs" style={{ color: '#667085' }}>{d.name}</div>
                        <div className="text-sm font-bold" style={{ color: d.val >= 4 ? '#22C55E' : d.val >= 3 ? '#F59E0B' : d.val > 0 ? '#EF4444' : '#999' }}>
                          {d.val || '--'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 动作通过率 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#667085' }}>动作通过率 {t.actionPassRate}%</span>
                    <div className="flex-1 mx-2 h-1 rounded-full" style={{ backgroundColor: '#E6E1D8' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${t.actionPassRate}%`,
                        backgroundColor: t.actionPassRate >= 80 ? '#22C55E' : t.actionPassRate >= 60 ? '#F59E0B' : '#EF4444'
                      }} />
                    </div>
                  </div>
                  {/* 卡点提示 */}
                  {t.bottlenecks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.bottlenecks.map((b: string, i: number) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#EF444410', color: '#EF4444' }}>{b}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 第三层：结果倒推 */}
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#22C55E15' }}>
              <Target className="w-4 h-4" style={{ color: '#22C55E' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#102A43' }}>第三层 · 结果倒推</h3>
              <p className="text-xs" style={{ color: '#667085' }}>用结果指标倒推问题</p>
            </div>
          </div>

          {/* 6个结果指标 */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(layer3.resultMetrics || []).map((m: any) => (
              <div key={m.key} className="text-center p-2 rounded-lg" style={{ backgroundColor: '#F8F6F0' }}>
                <div className="text-lg font-bold" style={{ color: getStatusColor(m.status) }}>{m.value}%</div>
                <div className="text-xs" style={{ color: '#667085' }}>{m.name}</div>
                <div className="text-xs mt-0.5" style={{ color: getStatusColor(m.status) }}>{getStatusLabel(m.status)}</div>
              </div>
            ))}
          </div>

          {/* 结果触发赋能 */}
          {layer3.resultEmpowerments?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: '#102A43' }}>结果触发赋能</span>
                <Zap className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
              </div>
              <div className="space-y-1.5">
                {layer3.resultEmpowerments.slice(0, 4).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: e.status === 'in_progress' ? '#FEF3C7' : '#F0FDF4' }}>
                    <span className="text-xs font-medium" style={{ color: '#102A43' }}>{e.traineeName}</span>
                    <span className="text-xs" style={{ color: '#667085' }}>{e.planName}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto" style={{
                      backgroundColor: e.status === 'in_progress' ? '#F59E0B15' : '#22C55E15',
                      color: e.status === 'in_progress' ? '#F59E0B' : '#22C55E'
                    }}>
                      {e.status === 'in_progress' ? '执行中' : '已完成'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href="/diagnosis" className="flex items-center gap-1 mt-3 text-xs" style={{ color: '#2978B5' }}>
            双轨诊断 <ChevronRight className="w-3 h-3" />
          </Link>

          {/* 下钻按钮 */}
          <button
            onClick={() => setDrillLayer3(!drillLayer3)}
            className="flex items-center gap-1 mt-2 text-xs w-full justify-center py-1.5 rounded-lg transition-colors"
            style={{ color: drillLayer3 ? '#2978B5' : '#667085', backgroundColor: drillLayer3 ? '#2978B510' : 'transparent' }}
          >
            {drillLayer3 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {drillLayer3 ? '收起新人明细' : '查看新人结果明细'}
          </button>

          {/* 结果线下钻：新人明细 */}
          {drillLayer3 && (layer3.traineeBreakdown || []).length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium mb-1" style={{ color: '#102A43' }}>新人结果指标明细</div>
              {(layer3.traineeBreakdown || []).map((t: any) => (
                <div key={t.userId} className="p-2.5 rounded-lg border" style={{
                  borderColor: t.unqualifiedIndicators.length > 0 ? '#F59E0B30' : '#E6E1D8',
                  backgroundColor: t.unqualifiedIndicators.length > 0 ? '#FFFBEB' : '#F8F6F0'
                }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: '#102A43' }}>{t.name}</span>
                      <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                        {stageNames[t.stage] || '首通电话'}
                      </span>
                    </div>
                    {t.unqualifiedIndicators.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#F59E0B15', color: '#F59E0B' }}>
                        {t.unqualifiedIndicators.length}项不达标
                      </span>
                    )}
                    {t.unqualifiedIndicators.length === 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#22C55E15', color: '#22C55E' }}>全部达标</span>
                    )}
                  </div>
                  {/* 6指标网格 */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(t.indicators || []).map((ind: any) => (
                      <div key={ind.key} className="text-center p-1.5 rounded" style={{ backgroundColor: ind.status === 'excellent' || ind.status === 'good' ? '#F0FDF4' : ind.status === 'warning' ? '#FFFBEB' : '#FEF2F2' }}>
                        <div className="text-sm font-bold" style={{ color: ind.status === 'excellent' || ind.status === 'good' ? '#22C55E' : ind.status === 'warning' ? '#F59E0B' : '#EF4444' }}>
                          {ind.value > 0 ? `${ind.value}%` : '--'}
                        </div>
                        <div className="text-xs" style={{ color: '#667085' }}>{ind.name}</div>
                      </div>
                    ))}
                  </div>
                  {/* 不达标指标 */}
                  {t.unqualifiedIndicators.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.unqualifiedIndicators.map((name: string, i: number) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F59E0B10', color: '#F59E0B' }}>{name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部联动提示 */}
      <div className="bg-card rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" style={{ color: '#2978B5' }} />
            <span className="text-xs font-medium" style={{ color: '#102A43' }}>培训不合格</span>
          </div>
          <ChevronRight className="w-3 h-3" style={{ color: '#E6E1D8' }} />
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <span className="text-xs font-medium" style={{ color: '#102A43' }}>质检触发赋能</span>
          </div>
          <ChevronRight className="w-3 h-3" style={{ color: '#E6E1D8' }} />
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4" style={{ color: '#22C55E' }} />
            <span className="text-xs font-medium" style={{ color: '#102A43' }}>结果倒推问题</span>
          </div>
          <ChevronRight className="w-3 h-3" style={{ color: '#E6E1D8' }} />
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4" style={{ color: '#E65100' }} />
            <span className="text-xs font-medium" style={{ color: '#102A43' }}>自动推送赋能方案</span>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#102A43' }}>快捷操作</h2>
        <div className="grid grid-cols-3 gap-3">
          {(data.quickActions || []).map((action: any) => (
            <Link key={action.href} href={action.href}
              className="flex items-center gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow"
              style={{ borderColor: '#E6E1D8' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                <ChevronRight className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium" style={{ color: '#102A43' }}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 主页面 ==========
export default function HomePage() {
  const { user, loading } = useAuth();
  const [homeData, setHomeData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/home?userId=${user.id}`)
      .then(res => res.json())
      .then(data => { setHomeData(data); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, [user?.id]);

  if (loading || dataLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 rounded animate-pulse" style={{ backgroundColor: '#E6E1D8' }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: '#F0EDE6' }} />
        <div className="h-60 rounded-xl animate-pulse" style={{ backgroundColor: '#F0EDE6' }} />
      </div>
    );
  }

  if (!homeData) {
    return <div className="p-8 text-center" style={{ color: '#667085' }}>加载失败，请刷新重试</div>;
  }

  const role = user?.role;
  const roleName = homeData.role;

  // 顶部欢迎条
  const roleLabels: Record<string, string> = {
    trainee: '成长计划',
    training_manager: '培训管理驾驶舱',
    mentor: '带教老师工作台',
    teacher: '教务工作台',
    boss: '经营概览',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#102A43' }}>
            {user?.realName || '用户'}的工作台
          </h1>
          <p className="text-sm mt-1" style={{ color: '#667085' }}>{roleLabels[roleName] || '工作台'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" style={{ color: '#2978B5' }} />
          <span className="text-xs" style={{ color: '#667085' }}>
            {roleName === 'trainee' ? `首通电话 · Day${homeData.currentDayIndex || 1}` : `${roleLabels[roleName]}`}
          </span>
        </div>
      </div>

      {roleName === 'trainee' && <TraineeHome data={homeData} />}
      {roleName === 'training_manager' && <TrainingManagerHome data={homeData} />}
      {roleName === 'mentor' && <MentorHome data={homeData} />}
      {roleName === 'teacher' && <TeacherHome data={homeData} />}
      {roleName === 'boss' && <BossHome data={homeData} />}
    </div>
  );
}
