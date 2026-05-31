'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Check, Lock, Swords, Play, Star, Flame, Trophy, ChevronRight,
  Calendar, Clock, BookOpen, Zap, ClipboardCheck, Flag, Circle, CheckCircle2,
  Eye, Settings, Users, Edit3, Save, Plus, Trash2, GripVertical, ToggleLeft, ToggleRight, Search, AlertTriangle,
} from 'lucide-react';

// === Shared Types ===

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

interface TraineeProgress {
  userId: string;
  realName: string;
  stage: number;
  passedLevels: number;
  totalLevels: number;
  currentLevel: number;
  lastAttempt: string | null;
}

const STAGE_LABELS: Record<number, string> = {
  1: '阶段一 · 理论基础',
  2: '阶段二 · 实战演练',
  3: '阶段三 · 综合达标',
};

const STAGE_SHORT: Record<number, string> = {
  1: '理论基础',
  2: '实战演练',
  3: '综合达标',
};

function getLevelDifficulty(levelId: number): number {
  if (levelId <= 3) return 1;
  if (levelId <= 7) return 2;
  if (levelId <= 11) return 3;
  if (levelId <= 17) return 4;
  return 5;
}

const DIFFICULTY_TEXT: Record<number, string> = {
  1: '1/5 · 入门难度',
  2: '2/5 · 基础难度',
  3: '3/5 · 中等难度',
  4: '4/5 · 较高难度',
  5: '5/5 · 最高难度',
};

// === Trainee View (闯关学习) ===

function TraineeLearningView({ user, levels, stageProgress, totalPassed, dayTasks, activeDay, setActiveDay, selectedLevel, setSelectedLevel }: {
  user: { id: string; role: string };
  levels: LevelInfo[];
  stageProgress: Record<number, StageProgress>;
  totalPassed: number;
  dayTasks: Record<number, DayTask[]>;
  activeDay: number;
  setActiveDay: (d: number) => void;
  selectedLevel: number | null;
  setSelectedLevel: (id: number | null) => void;
}) {
  const router = useRouter();
  const [stageUnlockTip, setStageUnlockTip] = useState<string | null>(null);
  const selected = levels.find(l => l.levelId === selectedLevel);
  const difficulty = selectedLevel ? getLevelDifficulty(selectedLevel) : 3;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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

      {stageUnlockTip && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] rounded-lg px-4 py-3 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>{stageUnlockTip}</span>
        </div>
      )}

      {/* 阶段进度 */}
      <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(stage => {
            const sp = stageProgress[stage] || { completed: 0, total: 7 };
            const pct = sp.total > 0 ? (sp.completed / sp.total) * 100 : 0;
            const isComplete = sp.completed === sp.total;
            const isCurrent = !isComplete && sp.completed > 0;
            const isLocked = stage === 3 && (stageProgress[2]?.completed || 0) < 7;
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isComplete ? 'bg-green-500/15' : isCurrent ? 'bg-primary/15' : 'bg-muted/60'}`}>
                      {isComplete ? <Check className="w-3.5 h-3.5 text-green-500" /> : isLocked ? <Lock className="w-3.5 h-3.5 text-muted-foreground/50" /> : <Play className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <span className={`text-sm font-semibold ${isLocked ? 'text-muted-foreground/50' : 'text-foreground'}`}>阶段{['一','二','三'][stage-1]}</span>
                    <span className={`text-xs ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>{[1,2,3].map(s => `${(s-1)*7+1}-${s*7}关`)[stage-1]} · {STAGE_SHORT[stage]}</span>
                  </div>
                  <span className={`text-xs font-medium ${isComplete ? 'text-green-500' : isCurrent ? 'text-primary' : 'text-muted-foreground/50'}`}>
                    {isComplete ? '已完成' : isCurrent ? '进行中' : isLocked ? '未解锁' : '未开始'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : isCurrent ? 'bg-primary' : 'bg-muted-foreground/20'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`text-xs ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                  {isLocked && stage === 3 ? '完成阶段二后解锁' : `${sp.completed}/${sp.total} 关已通过`}
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
          </div>
          <div className="flex gap-1.5 mb-4">
            {[1,2,3,4,5,6,7].map(day => {
              const tasks = dayTasks[day] || [];
              const allDone = tasks.length > 0 && tasks.every(t => t.isCompleted);
              const hasProgress = tasks.some(t => t.isCompleted) && !allDone;
              const isActive = day === activeDay;
              return (
                <button key={day} onClick={() => setActiveDay(day)} className={`flex-1 py-2 px-1 rounded-md text-center text-xs font-medium transition-all ${isActive ? 'bg-[#2978B5]/10 text-[#2978B5] border border-[#2978B5]/30' : allDone ? 'bg-[#22c55e]/8 text-[#22c55e]' : hasProgress ? 'bg-[#f59e0b]/8 text-[#f59e0b]' : 'bg-muted/40 text-muted-foreground'}`}>
                  <div>Day{day}</div>
                  {allDone && <Check className="w-3 h-3 mx-auto mt-0.5" />}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            {(dayTasks[activeDay] || []).map(task => {
              const typeColors: Record<string, { bg: string; text: string }> = {
                study: { bg: 'bg-[#2978B5]/10', text: 'text-[#2978B5]' },
                practice: { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' },
                quiz: { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]' },
                review: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
              };
              const tc = typeColors[task.taskType] || typeColors.study;
              return (
                <div key={task.id} className={`flex items-center gap-3 py-2.5 px-3 rounded-md ${task.isCompleted ? 'bg-muted/20' : 'bg-background border border-border/30'}`}>
                  {task.isCompleted ? <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tc.bg} ${tc.text} shrink-0`}>
                    {task.taskType === 'study' ? '学习' : task.taskType === 'practice' ? '实操' : task.taskType === 'quiz' ? '考核' : '复盘'}
                  </span>
                  <span className={`text-sm flex-1 ${task.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.taskTitle}</span>
                  {task.standard && <span className="text-xs text-[#f59e0b] flex items-center gap-1 shrink-0"><Flag className="w-3 h-3" />{task.standard}</span>}
                  {task.relatedLevelId && !task.isCompleted && (
                    <button onClick={() => setSelectedLevel(task.relatedLevelId!)} className="text-xs text-[#2978B5] hover:underline shrink-0">去闯关</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 关卡地图 */}
      <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
        <h2 className="text-base font-semibold text-foreground mb-4">关卡地图</h2>
        <div className="space-y-4">
          {[1, 2, 3].map(stage => {
            const stageLevels = levels.filter(l => l.stage === stage);
            const isStageLocked = stage === 3 && (stageProgress[2]?.completed || 0) < 7;
            return (
              <div key={stage}>
                <div className="flex items-center gap-1 mb-2">
                  <span className={`text-xs font-medium ${isStageLocked ? 'text-muted-foreground/50' : 'text-primary'}`}>阶段{['一','二','三'][stage-1]}</span>
                  <span className={`text-xs ${isStageLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>· {STAGE_SHORT[stage]}</span>
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {stageLevels.map(level => {
                    const isSelected = selectedLevel === level.levelId;
                    const isActive = level.status === 'active' || level.status === 'in_progress';
                    return (
                      <div key={level.levelId} onClick={() => {
                        if (level.status === 'locked-stage') {
                          const prevStage = level.stage - 1;
                          const sp = stageProgress[prevStage] || { completed: 0, total: 7 };
                          setStageUnlockTip(`需完成阶段${prevStage}全部${sp.total}关（当前已通过${sp.completed}关）`);
                          setTimeout(() => setStageUnlockTip(null), 3000);
                        } else if (level.status !== 'locked') {
                          setSelectedLevel(level.levelId);
                        }
                      }} className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg cursor-pointer transition-all ${
                        level.status === 'passed' ? `bg-green-500/8 border border-green-500/20 ${isSelected ? 'ring-2 ring-green-500/40' : ''}`
                          : isActive ? `bg-primary/8 border-2 border-primary/60 ${isSelected ? 'ring-2 ring-primary/40' : ''}`
                          : level.status === 'locked-stage' || level.status === 'locked' ? 'bg-muted/50 border border-border/15 cursor-not-allowed'
                          : `bg-muted/20 border border-border/20 ${isSelected ? 'ring-2 ring-primary/20' : ''}`
                      }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${level.status === 'passed' ? 'bg-green-500/15' : isActive ? 'bg-primary/15' : 'bg-muted/60'}`}>
                          {level.status === 'passed' ? <Check className="w-5 h-5 text-green-500" /> : isActive ? <Swords className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-muted-foreground/40" />}
                        </div>
                        <span className={`text-xs font-semibold ${level.status === 'passed' ? 'text-green-500' : isActive ? 'text-primary' : 'text-muted-foreground/40'}`}>第{level.levelId}关</span>
                        {isActive && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Flame className="w-2.5 h-2.5 text-primary-foreground" /></span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 关卡详情 */}
      {selected && (
        <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selected.status === 'passed' ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                  {selected.status === 'passed' ? <Trophy className="w-6 h-6 text-green-500" /> : <Swords className="w-6 h-6 text-primary" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">第{selected.levelId}关 · {selected.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{STAGE_LABELS[selected.stage]}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">题型分布</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center"><span className="text-[10px] font-bold text-primary">单</span></div><span className="text-sm font-medium text-foreground">{selected.questionStats.single}</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-warning/15 flex items-center justify-center"><span className="text-[10px] font-bold text-warning">多</span></div><span className="text-sm font-medium text-foreground">{selected.questionStats.multi}</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-green-500/15 flex items-center justify-center"><span className="text-[10px] font-bold text-green-500">判</span></div><span className="text-sm font-medium text-foreground">{selected.questionStats.tf}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">难度星级</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`w-4 h-4 ${i < difficulty ? 'text-warning fill-warning' : 'text-muted/50'}`} />)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{DIFFICULTY_TEXT[difficulty]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">最高分</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">{selected.bestScore !== null ? selected.bestScore : '—'}</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                </div>
              </div>
            </div>
            {(selected.status === 'active' || selected.status === 'in_progress' || selected.status === 'passed') && (
              <button onClick={() => router.push(`/learning/${selected.levelId}`)} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-all inline-flex items-center gap-2 shrink-0">
                <Play className="w-4 h-4" />
                {selected.status === 'passed' ? '再战一次' : '开始闯关'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// === Training Manager View (课程管理后台) ===

function ManagerLearningView({ levels }: { levels: LevelInfo[] }) {
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'levels' | 'schedule' | 'goals'>('levels');

  const saveLevelName = async (levelId: number, name: string) => {
    setSaving(true);
    try {
      await fetch('/api/learning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId, name }),
      });
      setEditingLevel(null);
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">课程管理</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">管理关卡内容、阶段目标与排课安排</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
        {[
          { key: 'levels' as const, label: '关卡管理', icon: <BookOpen className="w-4 h-4" /> },
          { key: 'schedule' as const, label: '排课配置', icon: <Calendar className="w-4 h-4" /> },
          { key: 'goals' as const, label: '阶段目标', icon: <Flag className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* 关卡管理 Tab */}
      {tab === 'levels' && (
        <div className="space-y-4">
          {[1, 2, 3].map(stage => {
            const stageLevels = levels.filter(l => l.stage === stage);
            return (
              <div key={stage} className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground">阶段{['一','二','三'][stage-1]} · {STAGE_SHORT[stage]}</h2>
                  <span className="text-xs text-muted-foreground">{stageLevels.length} 关</span>
                </div>
                <div className="space-y-2">
                  {stageLevels.map(level => (
                    <div key={level.levelId} className="flex items-center gap-3 py-2.5 px-3 rounded-md bg-background border border-border/30">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                        <span className="text-sm font-bold text-primary">{level.levelId}</span>
                      </div>
                      {editingLevel === level.levelId ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveLevelName(level.levelId, editName)}
                            autoFocus
                          />
                          <button onClick={() => saveLevelName(level.levelId, editName)} className="p-1 text-green-500 hover:bg-green-500/10 rounded" disabled={saving}>
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingLevel(null)} className="p-1 text-muted-foreground hover:bg-muted/50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-foreground">{level.name}</span>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                单选{level.questionStats.single} / 多选{level.questionStats.multi} / 判断{level.questionStats.tf}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                难度 {getLevelDifficulty(level.levelId)}/5
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => { setEditingLevel(level.levelId); setEditName(level.name); }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 排课配置 Tab */}
      {tab === 'schedule' && (
        <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">7天排课模板</h2>
            <span className="text-xs text-muted-foreground">新入职新人自动按此排课表生成学习计划</span>
          </div>
          <div className="space-y-3">
            {[1,2,3,4,5,6,7].map(day => (
              <div key={day} className="flex items-start gap-3 py-3 px-4 rounded-md bg-background border border-border/30">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#2978B5]/10 shrink-0">
                  <span className="text-sm font-bold text-[#2978B5]">D{day}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-1">第{day}天</p>
                  <div className="flex flex-wrap gap-1.5">
                    {levels.filter(l => l.stage === 1 && l.levelId <= day + 2).map(l => (
                      <span key={l.levelId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#2978B5]/8 text-[#2978B5]">
                        <BookOpen className="w-3 h-3" />
                        第{l.levelId}关·{l.name}
                      </span>
                    ))}
                    {day % 2 === 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#f59e0b]/8 text-[#f59e0b]">
                        <Zap className="w-3 h-3" />实操演练
                      </span>
                    )}
                    {day === 7 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#22c55e]/8 text-[#22c55e]">
                        <ClipboardCheck className="w-3 h-3" />综合考核
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 阶段目标 Tab */}
      {tab === 'goals' && (
        <div className="space-y-4">
          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <h2 className="text-base font-semibold text-foreground mb-4">阶段晋升规则</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-4 py-3 px-4 rounded-md bg-background border border-border/30">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10 shrink-0">
                  <ChevronRight className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">阶段一 → 阶段二</p>
                  <p className="text-xs text-muted-foreground mt-0.5">闯关7关全通过</p>
                </div>
                <button className="px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors">
                  编辑规则
                </button>
              </div>
              <div className="flex items-center gap-4 py-3 px-4 rounded-md bg-background border border-border/30">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10 shrink-0">
                  <ChevronRight className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">阶段二 → 阶段三</p>
                  <p className="text-xs text-muted-foreground mt-0.5">连续4周A类（双轨诊断全合格）</p>
                </div>
                <button className="px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors">
                  编辑规则
                </button>
              </div>
              <div className="flex items-center gap-4 py-3 px-4 rounded-md bg-background border border-[#ef4444]/20">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#ef4444]/10 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">降级触发</p>
                  <p className="text-xs text-muted-foreground mt-0.5">连续2周D类（过程+结果均不合格）→ 触发复训</p>
                </div>
                <button className="px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors">
                  编辑规则
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Mentor View (新人进度视图) ===

function MentorLearningView({ user }: { user: { id: string; role: string } }) {
  const [trainees, setTrainees] = useState<TraineeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTraineeProgress = async () => {
      try {
        const res = await fetch(`/api/learning/trainees?mentorId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setTrainees(data.trainees || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchTraineeProgress();
  }, [user.id]);

  const filtered = trainees.filter(t =>
    t.realName.includes(search)
  );

  if (loading) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">新人学习进度</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">查看自己带教新人的闯关进度与学习情况</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            placeholder="搜索新人..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无带教新人</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.userId} className="bg-card rounded-lg shadow-sm p-4 border border-border/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{t.realName.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{t.realName}</p>
                  <p className="text-xs text-muted-foreground">阶段{t.stage} · 第{t.currentLevel}关</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">闯关进度</span>
                  <span className="text-foreground font-medium">{t.passedLevels}/{t.totalLevels}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(t.passedLevels / t.totalLevels) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === Main Page Router ===

export default function LearningPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const roleId = Number(user?.role) || 0;
  const isTrainee = roleId === 1;
  const isManager = roleId === 3;
  const isMentor = roleId === 2;

  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [stageProgress, setStageProgress] = useState<Record<number, StageProgress>>({});
  const [totalPassed, setTotalPassed] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dayTasks, setDayTasks] = useState<Record<number, DayTask[]>>({});
  const [activeDay, setActiveDay] = useState<number>(1);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
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
        const activeLevel = data.levels.find((l: LevelInfo) => l.status === 'active' || l.status === 'in_progress');
        if (activeLevel) setSelectedLevel(activeLevel.levelId);
      }

      if (isTrainee) {
        try {
          const planRes = await fetch(`/api/growth-plan?userId=${user.id}`);
          if (planRes.ok) {
            const planData = await planRes.json();
            if (planData.todayPlans && planData.todayPlans.length > 0) {
              const allDayTasks: Record<number, DayTask[]> = {};
              for (const p of planData.todayPlans) {
                if (!allDayTasks[p.dayIndex]) allDayTasks[p.dayIndex] = [];
                allDayTasks[p.dayIndex].push(p);
              }
              if (planData.weekOverview) setActiveDay(planData.currentDayIndex || 1);
              setDayTasks(allDayTasks);
            }
          }
        } catch { /* non-critical */ }
      }
    } catch (err) {
      console.error('Failed to fetch learning progress:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user, isTrainee]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  if (loading || !user) return null;

  if (dataLoading) {
    return <div className="max-w-5xl mx-auto space-y-6 animate-pulse"><div className="h-8 bg-muted rounded w-48" /><div className="h-32 bg-muted rounded-lg" /><div className="h-64 bg-muted rounded-lg" /></div>;
  }

  // Role-based view routing
  if (isMentor) {
    return <MentorLearningView user={user} />;
  }

  if (isManager) {
    return <ManagerLearningView levels={levels} />;
  }

  // Default: trainee闯关 + boss/teacher预览模式
  return (
    <TraineeLearningView
      user={user}
      levels={levels}
      stageProgress={stageProgress}
      totalPassed={totalPassed}
      dayTasks={dayTasks}
      activeDay={activeDay}
      setActiveDay={setActiveDay}
      selectedLevel={selectedLevel}
      setSelectedLevel={setSelectedLevel}
    />
  );
}
