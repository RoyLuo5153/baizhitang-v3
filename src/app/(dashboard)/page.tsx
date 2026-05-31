'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import {
  BookOpen, BarChart3, Target, TrendingUp, Users, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, ChevronRight,
  MapPin, Calendar, Flag, ClipboardCheck, Zap,
  Circle, CheckCircle, Play, Lock, Trophy,
} from 'lucide-react';
import Link from 'next/link';

interface GrowthPlanData {
  user: { id: string; name: string; role: string };
  currentStage: {
    key: string;
    name: string;
    index: number;
    description: string;
    enterCondition: string;
    exitCondition: string;
    durationWeeks: number;
  } | null;
  currentDayIndex: number;
  stageProgress: { total: number; completed: number; percentage: number };
  passedLevels: number;
  todayPlans: TodayPlan[];
  weekOverview: WeekDay[];
  stages: StageInfo[];
}

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

interface StageInfo {
  key: string;
  name: string;
  index: number;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
}

const TASK_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  study: { label: '学习', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10', icon: <BookOpen className="w-3.5 h-3.5" /> },
  practice: { label: '实操', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', icon: <Zap className="w-3.5 h-3.5" /> },
  quiz: { label: '考核', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  review: { label: '复盘', color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10', icon: <Flag className="w-3.5 h-3.5" /> },
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [planData, setPlanData] = useState<GrowthPlanData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/growth-plan?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setPlanData(data);
      }
    } catch (err) {
      console.error('Failed to fetch growth plan:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const toggleTask = async (planId: number, currentCompleted: boolean) => {
    try {
      const res = await fetch('/api/growth-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, isCompleted: !currentCompleted }),
      });
      if (res.ok) {
        fetchPlan();
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-24 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!planData || !planData.currentStage) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold text-foreground">成长计划</h1>
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground">暂无成长计划数据，请联系管理员初始化</p>
        </div>
      </div>
    );
  }

  const { currentStage, currentDayIndex, stageProgress, todayPlans, weekOverview, stages, passedLevels } = planData;
  const completedToday = todayPlans.filter(t => t.isCompleted).length;
  const totalToday = todayPlans.length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* 顶部：当前阶段 + 欢迎语 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            成长计划
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            欢迎回来，{planData.user?.name || '用户'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-md bg-[#2978B5]/10">
            <span className="text-sm font-medium text-[#2978B5]">
              {currentStage.name}
            </span>
          </div>
          {currentStage.key === 'learning' && (
            <div className="px-3 py-1.5 rounded-md bg-[#f59e0b]/10">
              <span className="text-sm font-medium text-[#f59e0b]">
                第 {currentDayIndex} / 7 天
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 阶段进度条 */}
      <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#2978B5]" />
            <span className="text-sm font-medium text-foreground">阶段进度</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {currentStage.exitCondition}
          </span>
        </div>
        {/* 4阶段条 */}
        <div className="flex items-center gap-1 mb-3">
          {stages.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                s.isActive
                  ? 'bg-[#2978B5]/15 text-[#2978B5] border border-[#2978B5]/30'
                  : s.isCompleted
                  ? 'bg-[#22c55e]/10 text-[#22c55e]'
                  : 'bg-muted/50 text-muted-foreground'
              }`}>
                {s.isCompleted ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : s.isActive ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                {s.name}
              </div>
              {i < stages.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-0.5 shrink-0" />
              )}
            </div>
          ))}
        </div>
        {/* 当前阶段进度 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 bg-[#2978B5]"
              style={{ width: `${stageProgress.percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {stageProgress.completed}/{stageProgress.total} 任务
          </span>
        </div>
      </div>

      {/* 7天排课概览（学习期） */}
      {currentStage.key === 'learning' && weekOverview.length > 0 && (
        <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#f59e0b]" />
            <span className="text-sm font-medium text-foreground">7天排课</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekOverview.map((wd) => {
              const allDone = wd.total > 0 && wd.completed === wd.total;
              const hasProgress = wd.completed > 0 && !allDone;
              return (
                <div
                  key={wd.day}
                  className={`rounded-lg p-2.5 text-center transition-all cursor-default ${
                    wd.isToday
                      ? 'bg-[#2978B5]/10 border-2 border-[#2978B5]/40'
                      : wd.isFuture
                      ? 'bg-muted/30'
                      : allDone
                      ? 'bg-[#22c55e]/8'
                      : 'bg-card border border-border/40'
                  }`}
                >
                  <div className={`text-xs font-medium ${
                    wd.isToday ? 'text-[#2978B5]' : wd.isFuture ? 'text-muted-foreground/40' : 'text-foreground'
                  }`}>
                    Day{wd.day}
                  </div>
                  <div className={`text-lg font-semibold mt-0.5 ${
                    wd.isToday ? 'text-[#2978B5]' : allDone ? 'text-[#22c55e]' : wd.isFuture ? 'text-muted-foreground/30' : 'text-foreground'
                  }`}>
                    {allDone ? <CheckCircle className="w-5 h-5 mx-auto text-[#22c55e]" /> : 
                     wd.isFuture ? '—' :
                     `${wd.completed}/${wd.total}`}
                  </div>
                  {wd.isToday && (
                    <div className="text-[10px] text-[#2978B5] font-medium mt-0.5">今天</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 今日任务卡片 */}
      <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#2978B5]" />
            <span className="text-sm font-medium text-foreground">今日任务</span>
            <span className="text-xs text-muted-foreground">
              {completedToday}/{totalToday} 已完成
            </span>
          </div>
          {totalToday > 0 && completedToday === totalToday && (
            <div className="flex items-center gap-1 text-[#22c55e]">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-medium">今日任务已全部完成!</span>
            </div>
          )}
        </div>

        {todayPlans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">今日暂无安排任务</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayPlans.map((plan) => {
              const typeConfig = TASK_TYPE_CONFIG[plan.taskType] || TASK_TYPE_CONFIG.study;
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border transition-all ${
                    plan.isCompleted
                      ? 'bg-muted/20 border-border/20'
                      : 'bg-background border-border/40 hover:border-[#2978B5]/30'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* 完成勾选 */}
                      <button
                        onClick={() => toggleTask(plan.id, plan.isCompleted)}
                        className={`mt-0.5 shrink-0 transition-colors ${
                          plan.isCompleted ? 'text-[#22c55e]' : 'text-muted-foreground/40 hover:text-[#2978B5]'
                        }`}
                      >
                        {plan.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* 标题行 */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeConfig.bg} ${typeConfig.color} flex items-center gap-1`}>
                            {typeConfig.icon}
                            {typeConfig.label}
                          </span>
                          <span className={`text-sm font-medium ${
                            plan.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                          }`}>
                            {plan.taskTitle}
                          </span>
                        </div>

                        {/* 描述 */}
                        {plan.taskDescription && (
                          <p className={`text-xs mt-1.5 ${
                            plan.isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'
                          }`}>
                            {plan.taskDescription}
                          </p>
                        )}

                        {/* 达标标准 + 截止时间 */}
                        <div className="flex items-center gap-4 mt-2">
                          {plan.standard && (
                            <div className="flex items-center gap-1">
                              <Flag className="w-3 h-3 text-[#f59e0b]" />
                              <span className="text-xs text-[#f59e0b]">{plan.standard}</span>
                            </div>
                          )}
                          {plan.deadlineTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {plan.deadlineType === 'today' ? '今日' : plan.deadlineType === 'week' ? '本周内' : ''} {plan.deadlineTime}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 关联闯关 */}
                        {plan.relatedLevelId && !plan.isCompleted && (
                          <Link
                            href="/learning"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-[#2978B5] hover:underline"
                          >
                            去闯关第{plan.relatedLevelId}关 <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 阶段核心数据 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="闯关进度"
          value={`${passedLevels}/21`}
          suffix="关"
          progress={Math.round((passedLevels / 21) * 100)}
          color="#2978B5"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="阶段任务"
          value={`${stageProgress.completed}/${stageProgress.total}`}
          suffix="项"
          progress={stageProgress.percentage}
          color="#22c55e"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="核心动作"
          value="19"
          suffix="个"
          progress={0}
          color="#f59e0b"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="阶段目标"
          value={currentStage.key === 'learning' ? '通关7关' : currentStage.key === 'practice' ? '双线达标' : '保持A类'}
          suffix=""
          progress={0}
          color="#102A43"
        />
      </div>

      {/* 下一阶段说明 */}
      {currentStage && (
        <div className="bg-[#102A43]/5 rounded-lg p-5 border border-[#102A43]/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#102A43]" />
            <span className="text-sm font-medium text-[#102A43]">
              进入下一阶段条件
            </span>
          </div>
          <p className="text-sm text-[#102A43]/80">
            {currentStage.exitCondition}
          </p>
        </div>
      )}

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickLink
          href="/learning"
          icon={<BookOpen className="w-5 h-5" />}
          title="闯关学习"
          desc="继续闯关"
          color="#2978B5"
        />
        <QuickLink
          href="/diagnosis"
          icon={<BarChart3 className="w-5 h-5" />}
          title="双轨诊断"
          desc="查看对标"
          color="#102A43"
        />
        <QuickLink
          href="/empowerment"
          icon={<TrendingUp className="w-5 h-5" />}
          title="赋能中心"
          desc="提升方案"
          color="#f59e0b"
        />
        <QuickLink
          href="/growth"
          icon={<Users className="w-5 h-5" />}
          title="成长档案"
          desc="完整记录"
          color="#22c55e"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, suffix, progress, color }: {
  icon: React.ReactNode; label: string; value: string; suffix: string;
  progress: number; color: string;
}) {
  return (
    <div className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold text-foreground">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {progress > 0 && (
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, icon, title, desc, color }: {
  href: string; icon: React.ReactNode; title: string; desc: string; color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </Link>
  );
}
