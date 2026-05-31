'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Check, Lock, Swords, Play, Star, Flame, Trophy, ChevronRight,
  Calendar, Clock, BookOpen, Zap, ClipboardCheck, Flag, Circle, CheckCircle2,
  Eye,
} from 'lucide-react';

interface DayTask {
  id: number;
  dayIndex: number;
  taskType: string;
  taskTitle: string;
  taskDescription: string;
  standard: string;
  deadlineTime: string | null;
  isCompleted: boolean;
  relatedLevelId: number | null;
  sortOrder: number;
}

interface LevelInfo {
  levelId: number;
  name: string;
  stage: number;
  stageName: string;
  status: 'passed' | 'active' | 'in_progress' | 'locked' | 'locked-stage';
  bestScore: number | null;
  attempts: number;
  questionStats: { single: number; multi: number; tf: number; essay: number; total: number };
}

interface StageProgress {
  completed: number;
  total: number;
}

const STAGE_LABELS: Record<number, string> = {
  1: '阶段一 · 理论基础',
  2: '阶段二 · 实战演练',
  3: '阶段三 · 综合达标',
};

const DIFFICULTY_STARS: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
};

const DIFFICULTY_TEXT: Record<number, string> = {
  1: '1/5 · 入门难度',
  2: '2/5 · 基础难度',
  3: '3/5 · 中等难度',
  4: '4/5 · 较高难度',
  5: '5/5 · 最高难度',
};

function getLevelDifficulty(levelId: number): number {
  if (levelId <= 3) return 1;
  if (levelId <= 7) return 2;
  if (levelId <= 11) return 3;
  if (levelId <= 17) return 4;
  return 5;
}

export default function LearningPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isTrainee = String(user?.role) === '1'; // role_id 1 = trainee
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [stageProgress, setStageProgress] = useState<Record<number, StageProgress>>({});
  const [totalPassed, setTotalPassed] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [stageUnlockTip, setStageUnlockTip] = useState<string | null>(null);
  const [dayTasks, setDayTasks] = useState<Record<number, DayTask[]>>({});
  const [activeDay, setActiveDay] = useState<number>(1);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/learning?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setLevels(data.levels);
        setStageProgress(data.stageProgress);
        setTotalPassed(data.totalPassed);
        // 默认选中第一个未通过的关卡
        const activeLevel = data.levels.find((l: LevelInfo) => l.status === 'active' || l.status === 'in_progress');
        if (activeLevel) setSelectedLevel(activeLevel.levelId);
      }

      // 获取7天排课任务
      try {
        const planRes = await fetch(`/api/growth-plan?userId=${user.id}`);
        if (planRes.ok) {
          const planData = await planRes.json();
          if (planData.todayPlans && planData.todayPlans.length > 0) {
            // 从API获取所有7天的任务
            const allDayTasks: Record<number, DayTask[]> = {};
            for (const p of planData.todayPlans) {
              if (!allDayTasks[p.dayIndex]) allDayTasks[p.dayIndex] = [];
              allDayTasks[p.dayIndex].push(p);
            }
            // 如果只有当天的，还需要加载其他天的
            if (planData.weekOverview) {
              const currentDay = planData.currentDayIndex || 1;
              setActiveDay(currentDay);
            }
            setDayTasks(allDayTasks);
          }
        }
      } catch {
        // non-critical, ignore
      }
    } catch (err) {
      console.error('Failed to fetch learning progress:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (loading || !user) return null;

  const selected = levels.find(l => l.levelId === selectedLevel);
  const difficulty = selectedLevel ? getLevelDifficulty(selectedLevel) : 3;

  if (dataLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">闯关学习</h1>
          <p className="text-sm text-muted-foreground mt-1">完成21关挑战，从理论到实战逐步达标</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="w-4 h-4 text-warning" />
          <span>已通过 <span className="text-primary font-semibold">{totalPassed}</span> / 21 关</span>
        </div>
      </div>

      {/* 阶段解锁提示 */}
      {stageUnlockTip && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] rounded-lg px-4 py-3 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>{stageUnlockTip}</span>
        </div>
      )}

      {/* 阶段进度指示器 */}
      <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(stage => {
            const sp = stageProgress[stage] || { completed: 0, total: 7 };
            const pct = sp.total > 0 ? (sp.completed / sp.total) * 100 : 0;
            const isComplete = sp.completed === sp.total;
            const isCurrent = !isComplete && sp.completed > 0;
            const isLocked = !isTrainee ? false : stage === 3 && (stageProgress[2]?.completed || 0) < 7;

            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isComplete ? 'bg-green-500/15' : isCurrent ? 'bg-primary/15' : 'bg-muted/60'
                    }`}>
                      {isComplete ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <span className={`text-sm font-semibold ${isLocked ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                      阶段{['一','二','三'][stage-1]}
                    </span>
                    <span className={`text-xs ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                      {[1,2,3].map(s => `${(s-1)*7+1}-${s*7}关`)[stage-1]} · {['理论基础','实战演练','综合达标'][stage-1]}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${
                    isComplete ? 'text-green-500' : isCurrent ? 'text-primary' : 'text-muted-foreground/50'
                  }`}>
                    {isComplete ? '已完成' : isCurrent ? '进行中' : isLocked ? '未解锁' : '未开始'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isComplete ? 'bg-green-500' : isCurrent ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={`text-xs ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                  {isLocked && stage === 3 && isTrainee ? '完成阶段二后解锁' : `${sp.completed}/${sp.total} 关已通过`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7天排课表 */}
      {Object.keys(dayTasks).length > 0 && (
        <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="text-base font-semibold text-foreground">7天排课表</h2>
            <span className="text-xs text-muted-foreground">每天的学习和考核安排</span>
          </div>
          {/* 天数切换标签 */}
          <div className="flex gap-1.5 mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map(day => {
              const tasks = dayTasks[day] || [];
              const allDone = tasks.length > 0 && tasks.every(t => t.isCompleted);
              const hasProgress = tasks.some(t => t.isCompleted) && !allDone;
              const isActive = day === activeDay;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex-1 py-2 px-1 rounded-md text-center text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#2978B5]/10 text-[#2978B5] border border-[#2978B5]/30'
                      : allDone
                      ? 'bg-[#22c55e]/8 text-[#22c55e] hover:bg-[#22c55e]/12'
                      : hasProgress
                      ? 'bg-[#f59e0b]/8 text-[#f59e0b] hover:bg-[#f59e0b]/12'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <div>Day{day}</div>
                  {allDone && <Check className="w-3 h-3 mx-auto mt-0.5" />}
                  {hasProgress && !allDone && (
                    <div className="text-[10px] mt-0.5">
                      {tasks.filter(t => t.isCompleted).length}/{tasks.length}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {/* 当天任务列表 */}
          {(dayTasks[activeDay] || []).length > 0 ? (
            <div className="space-y-2">
              {(dayTasks[activeDay] || []).map(task => {
                const typeColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
                  study: { bg: 'bg-[#2978B5]/10', text: 'text-[#2978B5]', icon: <BookOpen className="w-3 h-3" /> },
                  practice: { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', icon: <Zap className="w-3 h-3" /> },
                  quiz: { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', icon: <ClipboardCheck className="w-3 h-3" /> },
                  review: { bg: 'bg-[#8b5cf6]/10', text: 'text-[#8b5cf6]', icon: <Flag className="w-3 h-3" /> },
                };
                const tc = typeColors[task.taskType] || typeColors.study;
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-md ${
                      task.isCompleted ? 'bg-muted/20' : 'bg-background border border-border/30'
                    }`}
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tc.bg} ${tc.text} flex items-center gap-1 shrink-0`}>
                      {tc.icon}
                      {task.taskType === 'study' ? '学习' : task.taskType === 'practice' ? '实操' : task.taskType === 'quiz' ? '考核' : '复盘'}
                    </span>
                    <span className={`text-sm flex-1 ${task.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {task.taskTitle}
                    </span>
                    {task.standard && (
                      <span className="text-xs text-[#f59e0b] flex items-center gap-1 shrink-0">
                        <Flag className="w-3 h-3" />
                        {task.standard}
                      </span>
                    )}
                    {task.deadlineTime && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {task.deadlineTime}
                      </span>
                    )}
                    {task.relatedLevelId && !task.isCompleted && (
                      <button
                        onClick={() => setSelectedLevel(task.relatedLevelId!)}
                        className="text-xs text-[#2978B5] hover:underline shrink-0"
                      >
                        去闯关
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Day{activeDay} 暂无排课安排
            </div>
          )}
        </div>
      )}

      {/* 关卡地图 */}
      <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
        <h2 className="text-base font-semibold text-foreground mb-4">关卡地图</h2>
        <div className="space-y-4">
          {[1, 2, 3].map(stage => {
            const startLevel = (stage - 1) * 7 + 1;
            const stageLevels = levels.filter(l => l.stage === stage);
            const isStageLocked = !isTrainee ? false : stage === 3 && (stageProgress[2]?.completed || 0) < 7;

            return (
              <div key={stage}>
                <div className="flex items-center gap-1 mb-2">
                  <span className={`text-xs font-medium ${isStageLocked ? 'text-muted-foreground/50' : stage === 1 ? 'text-green-500' : 'text-primary'}`}>
                    阶段{['一','二','三'][stage-1]}
                  </span>
                  <span className={`text-xs ${isStageLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                    · {['理论基础','实战演练','综合达标'][stage-1]}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {stageLevels.map(level => {
                    const isSelected = selectedLevel === level.levelId;
                    const isActive = level.status === 'active' || level.status === 'in_progress';

                    return (
                      <div
                        key={level.levelId}
                        onClick={() => {
                          if (!isTrainee) {
                            // 非trainee可以预览任何关卡
                            setSelectedLevel(level.levelId);
                          } else if (level.status === 'locked-stage') {
                            const prevStage = level.stage - 1;
                            const sp = stageProgress[prevStage] || { completed: 0, total: 7 };
                            setStageUnlockTip(`需完成阶段${prevStage}全部${sp.total}关（当前已通过${sp.completed}关）`);
                            setTimeout(() => setStageUnlockTip(null), 3000);
                          } else if (level.status !== 'locked') {
                            setSelectedLevel(level.levelId);
                          }
                        }}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg cursor-pointer transition-all ${
                          level.status === 'passed'
                            ? `bg-green-500/8 border border-green-500/20 hover:bg-green-500/12 ${isSelected ? 'ring-2 ring-green-500/40' : ''}`
                            : isActive
                              ? `bg-primary/8 border-2 border-primary/60 hover:bg-primary/12 ${isSelected ? 'ring-2 ring-primary/40' : ''}`
                              : level.status === 'locked-stage' && isTrainee
                                ? 'bg-muted/30 border border-border/10 cursor-not-allowed opacity-50'
                                : level.status === 'locked' && isTrainee
                                  ? 'bg-muted/50 border border-border/15 cursor-not-allowed'
                                  : `bg-muted/20 border border-border/20 hover:bg-muted/30 ${isSelected ? 'ring-2 ring-primary/20' : ''}`
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          level.status === 'passed'
                            ? 'bg-green-500/15'
                            : isActive
                              ? 'bg-primary/15'
                              : !isTrainee && (level.status === 'locked' || level.status === 'locked-stage')
                                ? 'bg-primary/8'
                                : 'bg-muted/60'
                        }`}>
                          {level.status === 'passed' ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : isActive ? (
                            <Swords className="w-5 h-5 text-primary" />
                          ) : !isTrainee && (level.status === 'locked' || level.status === 'locked-stage') ? (
                            <Eye className="w-5 h-5 text-primary/50" />
                          ) : (
                            <Lock className="w-5 h-5 text-muted-foreground/40" />
                          )}
                        </div>
                        <span className={`text-xs font-semibold ${
                          level.status === 'passed' ? 'text-green-500'
                            : isActive ? 'text-primary'
                              : 'text-muted-foreground/40'
                        }`}>
                          第{level.levelId}关
                        </span>
                        {level.status === 'locked-stage' && isTrainee && (
                          <span className="text-[10px] text-muted-foreground/60 text-center leading-tight mt-0.5">
                            需完成阶段{level.stage - 1}
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Flame className="w-2.5 h-2.5 text-primary-foreground" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 当前关卡详情卡 */}
      {selected && (
        <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  selected.status === 'passed' ? 'bg-green-500/10' : 'bg-primary/10'
                }`}>
                  {selected.status === 'passed' ? (
                    <Trophy className="w-6 h-6 text-green-500" />
                  ) : (
                    <Swords className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    第{selected.levelId}关 · {selected.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {STAGE_LABELS[selected.stage]}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  selected.status === 'passed' ? 'bg-green-500/15 text-green-500'
                    : selected.status === 'active' || selected.status === 'in_progress' ? 'bg-primary/15 text-primary'
                      : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {selected.status === 'passed' ? '已通过' : selected.status === 'active' || selected.status === 'in_progress' ? '进行中' : '未解锁'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {/* 题型分布 */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">题型分布</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">单</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{selected.questionStats.single}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-warning/15 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-warning">多</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{selected.questionStats.multi}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-green-500/15 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-green-500">判</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{selected.questionStats.tf}</span>
                    </div>
                  </div>
                </div>

                {/* 难度星级 */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">难度星级</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < difficulty ? 'text-warning fill-warning' : 'text-muted/50'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{DIFFICULTY_TEXT[difficulty]}</p>
                </div>

                {/* 最高分 */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">最高分</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">
                      {selected.bestScore !== null ? selected.bestScore : '—'}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selected.attempts > 0 ? `已挑战 ${selected.attempts} 次` : '尚未挑战'}
                  </p>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {!isTrainee ? (
                <button
                  onClick={() => router.push(`/learning/${selected.levelId}`)}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  预览关卡
                </button>
              ) : (selected.status === 'active' || selected.status === 'in_progress' || selected.status === 'passed') ? (
                <button
                  onClick={() => router.push(`/learning/${selected.levelId}`)}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {selected.status === 'passed' ? '再战一次' : '开始闯关'}
                </button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {!isTrainee ? '培训负责人/导师可预览所有关卡内容' : selected.status === 'passed' ? '已通过，可重新挑战' : '80分及格，通过后解锁下一关'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
