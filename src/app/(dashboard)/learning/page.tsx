'use client';

import { useAuth } from '@/lib/auth/context';
import { useEffect, useState, useCallback } from 'react';
import {
  Check, Lock, Play, Flame, BookOpen, Wrench, PencilLine,
  User, X, ChevronRight, Zap, Activity, Send,
} from 'lucide-react';

// === Types ===

interface ModuleInfo {
  code: string;
  name: string;
  stage: string;
  stageName: string;
  description: string | null;
  sortOrder: number;
  questionCount: number;
  passThreshold: number;
  status: 'passed' | 'active' | 'in_progress' | 'locked';
  bestScore: number | null;
  attempts: number;
  passedAt: string | null;
  questionStats: { single: number; multi: number; tf: number; total: number } | null;
}

interface StageProgressInfo {
  completed: number;
  total: number;
  allPassed: boolean;
}

interface ModulesData {
  modules: ModuleInfo[];
  currentStage: string;
  processStatus: string;
  resultStatus: string;
  stageProgress: Record<string, StageProgressInfo>;
  recommendedPlans?: { planId: string; planName: string; indicatorKey: string; alreadyPushed: boolean }[];
  hasAlert?: boolean;
}

interface QuestionItem {
  id: number;
  question_type: string;
  content: string;
  options: string[] | null;
}

// === Status Helpers ===

const STAGE_LABELS: Record<string, string> = {
  foundation: '基础通关',
  practice: '实操通关',
  qualified: '合格阶段',
};

const PROCESS_STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started: { label: '未启动', color: 'text-white/60' },
  monitoring: { label: '监控中', color: 'text-yellow-400' },
  flagged: { label: '预警', color: 'text-red-400' },
  passed: { label: '已通过', color: 'text-green-400' },
};

const RESULT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started: { label: '未启动', color: 'text-white/60' },
  insufficient_data: { label: '数据不足', color: 'text-white/60' },
  monitoring: { label: '监控中', color: 'text-yellow-400' },
  yellow_alert: { label: '黄灯预警', color: 'text-yellow-400' },
  red_alert: { label: '红灯预警', color: 'text-red-400' },
  passed: { label: '已达标', color: 'text-green-400' },
};

// === Module Card Component ===

function ModuleCard({
  module,
  onClick,
}: {
  module: ModuleInfo;
  onClick: () => void;
}) {
  const isLocked = module.status === 'locked';
  const isPassed = module.status === 'passed';
  const isActive = module.status === 'active' || module.status === 'in_progress';

  return (
    <div
      onClick={!isLocked ? onClick : undefined}
      className={`relative bg-card rounded-lg shadow-card p-5 transition-all ${
        isLocked
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer hover:shadow-float'
      } ${isActive ? 'border-2 border-primary/40' : 'border-2 border-transparent'}`}
    >
      {/* Status badge */}
      <div
        className={`absolute top-0 left-0 rounded-tl-lg rounded-br-lg px-2.5 py-1 flex items-center gap-1 ${
          isPassed
            ? 'bg-green-500/90'
            : isActive
            ? 'bg-primary'
            : 'bg-muted-foreground/60'
        }`}
      >
        {isPassed && <Check className="w-3 h-3 text-white" />}
        {isActive && <PencilLine className="w-3 h-3 text-white" />}
        {isLocked && <Lock className="w-3 h-3 text-white" />}
        <span className="text-xs font-medium text-white">
          {isPassed ? '已通过' : isActive ? '可考核' : '锁定'}
        </span>
      </div>

      {/* Module content */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-foreground">{module.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{module.description || ''}</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/15">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-muted-foreground">最高分</span>
            <p className={`text-lg font-bold ${isPassed ? 'text-green-500' : 'text-muted-foreground'}`}>
              {module.bestScore !== null ? module.bestScore : '--'}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">答题次数</span>
            <p className="text-lg font-bold text-foreground">{module.attempts}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
            isPassed
              ? 'bg-green-500/15 text-green-500'
              : isActive
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {isPassed ? '已通过' : isActive ? '可考核' : '锁定'}
        </span>
      </div>
    </div>
  );
}

// === Quiz Modal ===

function QuizStartModal({
  module,
  onClose,
  onStart,
}: {
  module: ModuleInfo;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl shadow-dialog max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">{module.name} · 模块考核</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <span className="text-sm text-muted-foreground">题目数量</span>
            <span className="text-sm font-semibold text-foreground">{module.questionCount} 题</span>
          </div>
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <span className="text-sm text-muted-foreground">通过分数线</span>
            <span className="text-sm font-semibold text-primary">{module.passThreshold} 分</span>
          </div>
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <span className="text-sm text-muted-foreground">答题限时</span>
            <span className="text-sm font-semibold text-foreground">15 分钟</span>
          </div>
        </div>
        <button
          onClick={onStart}
          className="w-full mt-6 bg-primary text-primary-foreground px-4 py-2.5 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          开始答题
        </button>
      </div>
    </div>
  );
}

// === History Modal ===

function HistoryModal({
  module,
  onClose,
  onRetake,
}: {
  module: ModuleInfo;
  onClose: () => void;
  onRetake: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl shadow-dialog max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">{module.name} · 考核成绩</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-green-500/10 rounded-lg px-4 py-3">
            <span className="text-sm text-muted-foreground">最高分</span>
            <span className="text-xl font-bold text-green-500">{module.bestScore}</span>
          </div>
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <span className="text-sm text-muted-foreground">通过时间</span>
            <span className="text-sm font-semibold text-foreground">
              {module.passedAt ? new Date(module.passedAt).toLocaleDateString('zh-CN') : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <span className="text-sm text-muted-foreground">累计答题</span>
            <span className="text-sm font-semibold text-foreground">{module.attempts} 次</span>
          </div>
        </div>
        <button
          onClick={onRetake}
          className="w-full mt-6 bg-primary text-primary-foreground px-4 py-2.5 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <ChevronRight className="w-4 h-4" />
          重新挑战
        </button>
      </div>
    </div>
  );
}

// === Quiz Answering Component ===

function QuizPanel({
  module,
  questions,
  onSubmit,
  onCancel,
}: {
  module: ModuleInfo;
  questions: QuestionItem[];
  onSubmit: (answers: Record<number, string | string[]>) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  const q = questions[currentIdx];
  if (!q) return null;

  const handleSingleAnswer = (questionId: number, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleMultiAnswer = (questionId: number, option: string) => {
    const prev = (answers[questionId] as string[]) || [];
    const next = prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option];
    setAnswers(prevState => ({ ...prevState, [questionId]: next }));
  };

  const handleTfAnswer = (questionId: number, val: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: val }));
  };

  const handleSubmit = () => {
    onSubmit(answers);
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl shadow-dialog max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">{module.name}</h3>
          <span className="text-sm text-muted-foreground">
            {currentIdx + 1} / {questions.length} · 已答 {answeredCount} 题
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mb-6">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-base font-medium text-foreground mb-4">
            {currentIdx + 1}. {q.content}
          </p>

          {q.question_type === 'single' && q.options && (
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSingleAnswer(q.id, String.fromCharCode(65 + i))}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                    answers[q.id] === String.fromCharCode(65 + i)
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/40 text-foreground'
                  }`}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              ))}
            </div>
          )}

          {q.question_type === 'multi' && q.options && (
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const selected = ((answers[q.id] as string[]) || []).includes(letter);
                return (
                  <button
                    key={i}
                    onClick={() => handleMultiAnswer(q.id, letter)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/40 text-foreground'
                    }`}
                  >
                    {letter}. {opt}
                  </button>
                );
              })}
            </div>
          )}

          {q.question_type === 'tf' && (
            <div className="flex gap-3">
              {['正确', '错误'].map(val => (
                <button
                  key={val}
                  onClick={() => handleTfAnswer(q.id, val === '正确' ? 'T' : 'F')}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-all text-sm ${
                    answers[q.id] === (val === '正确' ? 'T' : 'F')
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/40 text-foreground'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          >
            上一题
          </button>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              取消
            </button>
            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx(i => i + 1)}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-all"
              >
                下一题
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition-all"
              >
                提交答案
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Trainee View (阶段通关) ===

function TraineeModuleView({ user }: { user: { id: string; role: string } }) {
  const [data, setData] = useState<ModulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleInfo | null>(null);
  const [modalType, setModalType] = useState<'quiz' | 'history' | 'answering' | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/learning/modules');
      if (!res.ok) throw new Error('Failed to fetch modules');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleModuleClick = (mod: ModuleInfo) => {
    if (mod.status === 'locked') {
      showToast('完成基础通关后解锁');
      return;
    }
    setActiveModule(mod);
    if (mod.status === 'passed') {
      setModalType('history');
    } else {
      setModalType('quiz');
    }
  };

  const handleStartQuiz = async () => {
    if (!activeModule) return;
    try {
      const res = await fetch(`/api/questions?module=${activeModule.code}&stage=${activeModule.stage}&limit=${activeModule.questionCount}&random=true`);
      if (!res.ok) throw new Error('Failed to fetch questions');
      const json = await res.json();
      if (!json.questions || json.questions.length === 0) {
        showToast('该模块暂无题目，请联系培训老师添加');
        return;
      }
      setQuestions(json.questions);
      setModalType('answering');
    } catch (err) {
      console.error('Failed to load questions:', err);
      showToast('加载题目失败，请稍后重试');
    }
  };

  const handleSubmitAnswers = async (answers: Record<number, string | string[]>) => {
    if (!activeModule) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/learning/modules/${activeModule.code}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Submit failed');
      const result = await res.json();

      setModalType(null);
      setActiveModule(null);
      setQuestions([]);

      if (result.passed) {
        showToast(`恭喜！${activeModule.name}考核通过，得分 ${result.score} 分`);
      } else {
        showToast(`${activeModule.name}未通过，得分 ${result.score} 分（需 ${activeModule.passThreshold} 分），请复习后重试`);
      }

      // Refresh module data
      fetchModules();
    } catch (err) {
      console.error('Submit failed:', err);
      showToast('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setModalType(null);
    if (activeModule) {
      handleStartQuiz();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!data || !data.modules) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">加载失败，请刷新重试</div>
      </div>
    );
  }

  const foundationModules = data.modules.filter(m => m.stage === 'foundation');
  const practiceModules = data.modules.filter(m => m.stage === 'practice');
  const totalPassed = data.modules.filter(m => m.status === 'passed').length;

  const foundationProgress = data.stageProgress.foundation || { completed: 0, total: foundationModules.length, allPassed: false };
  const practiceProgress = data.stageProgress.practice || { completed: 0, total: practiceModules.length, allPassed: false };
  const practiceUnlocked = foundationProgress.allPassed;

  const processInfo = PROCESS_STATUS_MAP[data.processStatus] || PROCESS_STATUS_MAP.not_started;
  const resultInfo = RESULT_STATUS_MAP[data.resultStatus] || RESULT_STATUS_MAP.not_started;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">阶段通关</h1>
          <p className="text-sm text-muted-foreground mt-1">完成模块考核，从基础到实操逐步达标</p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg shadow-card px-4 py-2.5">
          <Flame className="w-5 h-5 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">已通过</span>
          <span className="text-lg font-bold text-primary">{totalPassed}</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-foreground">{data.modules.length} 模块</span>
        </div>
      </div>

      {/* 2. 阶段进度条区域 */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <div className="grid grid-cols-2 gap-6">
          {/* 基础通关 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-base font-semibold text-foreground">基础通关</span>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                foundationProgress.allPassed
                  ? 'bg-green-500/15 text-green-500'
                  : 'bg-primary/15 text-primary'
              }`}>
                {foundationProgress.allPassed ? '已完成' : '进行中'}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary rounded-full h-2.5 transition-all"
                style={{ width: `${foundationProgress.total > 0 ? (foundationProgress.completed / foundationProgress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{foundationProgress.completed} / {foundationProgress.total} 模块已通过</span>
              <span className="text-xs font-medium text-primary">
                {foundationProgress.total > 0 ? Math.round((foundationProgress.completed / foundationProgress.total) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* 实操通关 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                <span className="text-base font-semibold text-foreground">实操通关</span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
                practiceUnlocked
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {practiceUnlocked ? (
                  practiceProgress.allPassed ? '已完成' : '进行中'
                ) : (
                  <><Lock className="w-3 h-3" />未解锁</>
                )}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`rounded-full h-2.5 transition-all ${practiceUnlocked ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                style={{ width: `${practiceProgress.total > 0 ? (practiceProgress.completed / practiceProgress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{practiceProgress.completed} / {practiceProgress.total} 模块已通过</span>
              <span className={`text-xs font-medium ${practiceUnlocked ? 'text-primary' : 'text-muted-foreground'}`}>
                {practiceProgress.total > 0 ? Math.round((practiceProgress.completed / practiceProgress.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 基础通关模块卡片网格 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">基础通关</h2>
          <span className="text-xs text-muted-foreground ml-1">{foundationModules.length}个模块 · 通过分数线80分</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {foundationModules.map(mod => (
            <ModuleCard key={mod.code} module={mod} onClick={() => handleModuleClick(mod)} />
          ))}
        </div>
      </div>

      {/* 4. 实操通关模块卡片网格 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">实操通关</h2>
          <span className="text-xs text-muted-foreground ml-1">
            {practiceModules.length}个模块{practiceUnlocked ? '' : ' · 完成基础通关后解锁'}
          </span>
        </div>
        <div className="relative">
          {!practiceUnlocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="bg-foreground/70 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                完成基础通关后解锁
              </div>
            </div>
          )}
          <div className={`grid grid-cols-2 gap-4 ${practiceUnlocked ? '' : 'opacity-40'}`}>
            {practiceModules.map(mod => (
              <ModuleCard
                key={mod.code}
                module={practiceUnlocked ? mod : { ...mod, status: 'locked' as const }}
                onClick={() => {
                  if (practiceUnlocked) handleModuleClick(mod);
                  else showToast('完成基础通关后解锁');
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 5. 底部"我的状态"卡片 */}
      <div className="rounded-lg p-5 bg-[#102A43]">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-white/70" />
          <span className="text-sm font-semibold text-white/90">我的状态</span>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <span className="text-xs text-white/50 block mb-1">当前阶段</span>
            <p className="text-xl font-bold text-white">{STAGE_LABELS[data.currentStage] || data.currentStage}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 block mb-1">过程线状态</span>
            <p className={`text-base font-semibold ${processInfo.color}`}>{processInfo.label}</p>
            <span className="text-xs text-white/40 mt-0.5 block">
              {data.processStatus === 'not_started' ? '通过实操质检后激活' : ''}
              {data.processStatus === 'monitoring' ? '系统正在监控中' : ''}
              {data.processStatus === 'flagged' ? '存在预警项，请关注' : ''}
              {data.processStatus === 'passed' ? '过程线全部达标' : ''}
            </span>
          </div>
          <div>
            <span className="text-xs text-white/50 block mb-1">结果线状态</span>
            <p className={`text-base font-semibold ${resultInfo.color}`}>{resultInfo.label}</p>
            <span className="text-xs text-white/40 mt-0.5 block">
              {data.resultStatus === 'not_started' ? '业务数据达标后激活' : ''}
              {data.resultStatus === 'insufficient_data' ? '数据积累中' : ''}
              {data.resultStatus === 'monitoring' ? '业务指标监控中' : ''}
              {data.resultStatus === 'yellow_alert' ? '部分指标偏低' : ''}
              {data.resultStatus === 'red_alert' ? '多项指标预警' : ''}
              {data.resultStatus === 'passed' ? '结果线全部达标' : ''}
            </span>
          </div>
        </div>
        {data.currentStage === 'foundation' && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-xs text-white/40">双线状态将在进入实操阶段后自动激活</p>
          </div>
        )}
        {/* 推荐赋能方案 — 双线异常时显示 */}
        {data.hasAlert && data.recommendedPlans && data.recommendedPlans.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">推荐赋能方案</span>
            </div>
            <div className="space-y-2">
              {(data.recommendedPlans || []).map((rp, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-md bg-white/5">
                  <Activity className="w-4 h-4 text-white/60 shrink-0" />
                  <span className="text-sm text-white/80 flex-1">{rp.planName}</span>
                  {rp.alreadyPushed ? (
                    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                      <Check className="w-3 h-3 inline mr-0.5" />已推送
                    </span>
                  ) : (
                    <a
                      href="/empowerment"
                      className="text-xs px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-colors flex items-center gap-1">
                      <Send className="w-3 h-3" />去查看
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModule && modalType === 'quiz' && (
        <QuizStartModal
          module={activeModule}
          onClose={() => { setActiveModule(null); setModalType(null); }}
          onStart={handleStartQuiz}
        />
      )}

      {activeModule && modalType === 'history' && (
        <HistoryModal
          module={activeModule}
          onClose={() => { setActiveModule(null); setModalType(null); }}
          onRetake={handleRetake}
        />
      )}

      {activeModule && modalType === 'answering' && questions.length > 0 && (
        <QuizPanel
          module={activeModule}
          questions={questions}
          onSubmit={handleSubmitAnswers}
          onCancel={() => { setModalType(null); setQuestions([]); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

// === Non-trainee View (simplified overview) ===

function NonTraineeView({ user }: { user: { id: string; role: string } }) {
  const [data, setData] = useState<ModulesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/learning/modules')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-destructive">加载失败</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">阶段通关</h1>
        <p className="text-sm text-muted-foreground mt-1">查看新人模块考核进度</p>
      </div>

      {/* Module overview table */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-semibold text-foreground">模块</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">阶段</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">通过线</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">题目数</th>
            </tr>
          </thead>
          <tbody>
            {(data.modules || []).map(mod => (
              <tr key={mod.code} className="border-b border-border/50 hover:bg-muted/50">
                <td className="px-4 py-3 font-medium text-foreground">{mod.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{mod.stageName}</td>
                <td className="px-4 py-3 text-muted-foreground">{mod.passThreshold}分</td>
                <td className="px-4 py-3 text-muted-foreground">{mod.questionCount}题</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Main Page ===

export default function LearningPage() {
  const { user } = useAuth();

  if (!user) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">请先登录</div>;
  }

  if (user.role === 'trainee') {
    return <TraineeModuleView user={user} />;
  }

  return <NonTraineeView user={user} />;
}
