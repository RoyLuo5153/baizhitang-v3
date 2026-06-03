'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import {
  BookOpen, Target, CheckCircle2, Clock, ChevronRight,
  Users, AlertTriangle, ClipboardCheck, BarChart3,
  PlayCircle, FileText, Settings, MessageSquare, Star,
  TrendingUp, Shield, Zap, Eye, Calendar
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
}

interface WeekDay {
  day: number;
  total: number;
  completed: number;
  isToday: boolean;
  isFuture: boolean;
}

// ========== 新人成长计划首页 ==========
function TraineeHome({ data }: { data: any }) {
  const [plans, setPlans] = useState<TodayPlan[]>(data.todayPlans || []);
  const [selectedDay, setSelectedDay] = useState(data.currentDayIndex || 1);

  const toggleComplete = useCallback(async (planId: number, isCompleted: boolean) => {
    try {
      const res = await fetch('/api/growth-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, isCompleted: !isCompleted }),
      });
      if (res.ok) {
        setPlans(prev => prev.map(p => p.id === planId ? { ...p, isCompleted: !isCompleted, completedAt: !isCompleted ? new Date().toISOString() : null } : p));
      }
    } catch {}
  }, []);

  const stageColors = [
    { bg: '#E8F5E9', color: '#2E7D32' },
    { bg: '#FFF3E0', color: '#E65100' },
    { bg: '#E3F2FD', color: '#1565C0' },
    { bg: '#F3E5F5', color: '#6A1B9A' },
  ];

  return (
    <div className="space-y-6">
      {/* 阶段进度 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5" style={{ color: '#2978B5' }} />
          <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>我的成长阶段</h2>
        </div>
        <div className="flex items-center gap-2 mb-4">
          {data.stages?.map((stage: any, idx: number) => {
            const sc = stageColors[idx] || stageColors[0];
            return (
              <div key={stage.key} className="flex items-center gap-2 flex-1">
                <div className={`flex-1 rounded-lg p-3 text-center transition-all ${stage.isActive ? 'ring-2' : ''}`}
                  style={{ backgroundColor: stage.isCompleted ? sc.bg : stage.isActive ? sc.bg : '#F5F5F5', outlineColor: stage.isActive ? sc.color : 'transparent' }}>
                  <div className="text-xs font-medium" style={{ color: stage.isActive || stage.isCompleted ? sc.color : '#999' }}>
                    {stage.name}
                  </div>
                  {stage.isActive && <div className="text-xs mt-1" style={{ color: sc.color }}>当前</div>}
                  {stage.isCompleted && <div className="text-xs mt-1 text-green-600">已完成</div>}
                </div>
                {idx < (data.stages?.length || 0) - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
        {data.currentStage && (
          <div className="flex items-center gap-4 text-sm" style={{ color: '#667085' }}>
            <span>当前：<strong style={{ color: '#102A43' }}>{data.currentStage.name}</strong></span>
            <span>升级条件：<strong style={{ color: '#2978B5' }}>{data.currentStage.exitCondition}</strong></span>
            <span>闯关进度：<strong style={{ color: '#F59E0B' }}>{data.passedLevels}/7</strong></span>
          </div>
        )}
      </div>

      {/* 7天排课概览 */}
      {data.weekOverview?.length > 0 && (
        <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5" style={{ color: '#2978B5' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>学习期7天排课</h2>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {data.weekOverview.map((wd: WeekDay) => (
              <button key={wd.day} onClick={() => setSelectedDay(wd.day)}
                className={`rounded-lg p-3 text-center transition-all ${wd.isToday ? 'ring-2' : ''} ${selectedDay === wd.day ? 'shadow-md' : ''}`}
                style={{
                  backgroundColor: selectedDay === wd.day ? '#2978B5' : wd.isFuture ? '#F5F5F5' : '#F0F9FF',
                  outlineColor: wd.isToday ? '#F59E0B' : 'transparent',
                }}>
                <div className="text-xs font-medium" style={{ color: selectedDay === wd.day ? '#fff' : wd.isFuture ? '#999' : '#102A43' }}>
                  Day{wd.day}
                </div>
                <div className="text-xs mt-1" style={{ color: selectedDay === wd.day ? '#E0F0FF' : '#667085' }}>
                  {wd.completed}/{wd.total}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 今日任务 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>
              {selectedDay === data.currentDayIndex ? '今日任务' : `Day${selectedDay} 任务`}
            </h2>
          </div>
          <span className="text-sm" style={{ color: '#667085' }}>
            {plans.filter(p => p.isCompleted).length}/{plans.length} 已完成
          </span>
        </div>
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id}
              className={`rounded-lg p-4 border transition-all ${plan.isCompleted ? 'opacity-60' : ''}`}
              style={{ borderColor: '#E6E1D8', backgroundColor: plan.isCompleted ? '#FAFAFA' : '#FFFFFF' }}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleComplete(plan.id, plan.isCompleted)}
                  className="mt-0.5 shrink-0">
                  {plan.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#2E7D32' }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: '#CBD5E1' }} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <TaskTypeBadge type={plan.taskType} />
                    <span className={`text-sm font-medium ${plan.isCompleted ? 'line-through' : ''}`}
                      style={{ color: '#102A43' }}>
                      {plan.taskTitle}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: '#667085' }}>{plan.taskDescription}</p>
                  <div className="flex items-center gap-4 text-xs">
                    {plan.standard && (
                      <span className="flex items-center gap-1" style={{ color: '#2978B5' }}>
                        <Shield className="w-3 h-3" /> 达标：{plan.standard}
                      </span>
                    )}
                    {plan.deadlineTime && (
                      <span className="flex items-center gap-1" style={{ color: '#F59E0B' }}>
                        <Clock className="w-3 h-3" /> 截止：{plan.deadlineTime.slice(0, 5)}
                      </span>
                    )}
                  </div>
                </div>
                {plan.relatedLevelId && (
                  <Link href={`/learning?level=${plan.relatedLevelId}`}
                    className="text-xs px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity shrink-0"
                    style={{ backgroundColor: '#2978B5', color: '#fff' }}>
                    去闯关
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 阶段核心数据 */}
      <div className="grid grid-cols-4 gap-4">
        <QuickStat icon={<BookOpen className="w-5 h-5" />} label="闯关进度" value={`${data.passedLevels}/7`} color="#2978B5" />
        <QuickStat icon={<CheckCircle2 className="w-5 h-5" />} label="阶段任务" value={`${data.stageProgress?.completed || 0}/${data.stageProgress?.total || 0}`} color="#2E7D32" />
        <QuickStat icon={<Star className="w-5 h-5" />} label="核心动作" value="19项" color="#F59E0B" />
        <QuickStat icon={<Target className="w-5 h-5" />} label="阶段目标" value={data.currentStage?.exitCondition || '—'} color="#102A43" />
      </div>
    </div>
  );
}

// ========== 培训负责人驾驶舱 ==========
function TrainingManagerHome({ data }: { data: any }) {
  const stageNames: Record<number, string> = { 1: '学习期', 2: '练习期', 3: '独立期', 4: '熟练期' };
  const stageColors: Record<number, string> = { 1: '#2E7D32', 2: '#E65100', 3: '#1565C0', 4: '#6A1B9A' };

  return (
    <div className="space-y-6">
      {/* 核心指标 */}
      <div className="grid grid-cols-4 gap-4">
        <QuickStat icon={<Users className="w-5 h-5" />} label="在培新人" value={data.stats?.totalTrainees || 0} color="#2978B5" />
        <QuickStat icon={<AlertTriangle className="w-5 h-5" />} label="预警数量" value={data.stats?.totalWarnings || 0} color="#F59E0B" />
        <QuickStat icon={<MessageSquare className="w-5 h-5" />} label="未读通知" value={data.stats?.unreadAlerts || 0} color="#E65100" />
        <QuickStat icon={<TrendingUp className="w-5 h-5" />} label="阶段分布" value={`${Object.keys(data.stats?.stageDistribution || {}).length}个阶段`} color="#102A43" />
      </div>

      {/* 阶段分布 */}
      <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#102A43' }}>新人阶段分布</h2>
        <div className="flex gap-4">
          {Object.entries(data.stats?.stageDistribution || {}).map(([stage, count]: [string, any]) => (
            <div key={stage} className="flex-1 rounded-lg p-4 text-center" style={{ backgroundColor: `${stageColors[Number(stage)] || '#2978B5'}15` }}>
              <div className="text-2xl font-bold" style={{ color: stageColors[Number(stage)] || '#2978B5' }}>{count}</div>
              <div className="text-xs mt-1" style={{ color: '#667085' }}>{stageNames[Number(stage)] || `阶段${stage}`}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 预警列表 */}
      {(data.warnings?.length > 0 || data.recentAlerts?.length > 0) && (
        <div className="bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#102A43' }}>预警与通知</h2>
          </div>
          <div className="space-y-2">
            {data.warnings?.map((w: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#FFF8E1' }}>
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
                <span className="text-sm" style={{ color: '#102A43' }}>{w.message}</span>
                <Link href={`/trainee-board`} className="text-xs px-2 py-1 rounded ml-auto shrink-0"
                  style={{ backgroundColor: '#2978B5', color: '#fff' }}>查看</Link>
              </div>
            ))}
            {data.recentAlerts?.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F0F9FF' }}>
                <MessageSquare className="w-4 h-4 shrink-0" style={{ color: '#2978B5' }} />
                <span className="text-sm" style={{ color: '#102A43' }}>{a.title}: {a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

// ========== 导师看板 ==========
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
    mentor: '导师工作台',
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
