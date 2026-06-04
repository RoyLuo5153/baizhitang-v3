'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import {
  BookOpen, Target, CheckCircle2, Clock, ChevronRight,
  Users, AlertTriangle, ClipboardCheck, BarChart3,
  PlayCircle, FileText, Settings, MessageSquare, Star,
  TrendingUp, Shield, Zap, Eye, Calendar, Pencil, Plus, Trash2, Send, Check, X, Lock
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
            当前: {currentStage.name || '学习期'} · 闯关通过 {passedLevels}/7
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

      {/* 7天排课概览 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>学习期7天排课</h2>
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
  const stageNames: Record<number, string> = { 1: '学习期', 2: '练习期', 3: '独立期', 4: '熟练期' };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <QuickStat icon={<Users className="w-5 h-5" />} label="带教新人" value={data.mentees?.length || 0} color="#2978B5" />
        <QuickStat icon={<ClipboardCheck className="w-5 h-5" />} label="待点评任务" value={data.pendingReviews?.length || 0} color="#F59E0B" />
        <QuickStat icon={<MessageSquare className="w-5 h-5" />} label="未读通知" value={data.alerts?.length || 0} color="#E65100" />
      </div>

      {/* 我带的新人 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" style={{ color: '#2978B5' }} />
          <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>我带的新人</h2>
        </div>
        <div className="space-y-3">
          {(data.mentees || []).map((m: any) => (
            <div key={m.id} className="flex items-center gap-4 p-4 rounded-lg border" style={{ borderColor: '#E6E1D8' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#2978B5' }}>
                {m.name?.slice(-1) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#102A43' }}>{m.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                    {stageNames[m.stage] || `阶段${m.stage}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: '#E6E1D8' }}>
                    <div className="h-full rounded-full" style={{ width: `${m.planProgress}%`, backgroundColor: m.planProgress >= 80 ? '#2E7D32' : m.planProgress >= 50 ? '#F59E0B' : '#E65100' }} />
                  </div>
                  <span className="text-xs" style={{ color: '#667085' }}>{m.planProgress}%</span>
                </div>
              </div>
              <Link href={`/trainee-board`} className="text-xs px-3 py-1.5 rounded-md"
                style={{ backgroundColor: '#2978B5', color: '#fff' }}>详情</Link>
            </div>
          ))}
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
  const stageNames: Record<number, string> = { 1: '学习期', 2: '练习期', 3: '独立期', 4: '熟练期' };
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
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <QuickStat icon={<Users className="w-5 h-5" />} label="在培新人" value={data.totalTrainees || 0} color="#2978B5" />
        <QuickStat icon={<AlertTriangle className="w-5 h-5" />} label="预警新人" value={data.alertTrainees || 0} color="#E65100" />
        <QuickStat icon={<ClipboardCheck className="w-5 h-5" />} label="待审核" value={data.pendingReviews || 0} color="#F59E0B" />
        <QuickStat icon={<TrendingUp className="w-5 h-5" />} label="整体通过率" value={`${data.overallPassRate || 0}%`} color="#2E7D32" />
      </div>

      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>新人状态概览</h2>
          <Link href="/trainee-board" className="text-xs" style={{ color: '#2978B5' }}>查看看板 →</Link>
        </div>
        {data.traineeSummary?.length > 0 ? (
          <div className="space-y-2">
            {data.traineeSummary.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: '#E6E1D8' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: t.status === 'normal' ? '#2978B5' : t.status === 'warning' ? '#F59E0B' : '#E65100' }}>
                  {t.name?.slice(-1) || '?'}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium" style={{ color: '#102A43' }}>{t.name}</span>
                  <span className="text-xs ml-2" style={{ color: '#667085' }}>{t.stageName}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full`} style={{
                  backgroundColor: t.status === 'normal' ? '#2E7D3215' : t.status === 'warning' ? '#F59E0B15' : '#E6510015',
                  color: t.status === 'normal' ? '#2E7D32' : t.status === 'warning' ? '#F59E0B' : '#E65100'
                }}>
                  {t.statusLabel}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm" style={{ color: '#667085' }}>暂无新人数据</div>
        )}
      </div>

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
            {roleName === 'trainee' ? `学习期 · Day${homeData.currentDayIndex || 1}` : `${roleLabels[roleName]}`}
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
