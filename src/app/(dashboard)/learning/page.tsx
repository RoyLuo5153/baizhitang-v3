'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Wrench, Lock, CheckCircle2, AlertTriangle,
  Flame, User, Zap, Activity, Check, Send, Clock, Calendar,
  Phone, MessageCircle, Video, Headphones, Star, Shield,
  Brain, Eye, Heart, TrendingUp, ChevronRight, Search,
  X, Play, ArrowRight, Sparkles
} from 'lucide-react';
import NodeCard from '@/components/nodes/NodeCard';
import ActionScoreInput from '@/components/action-score/ActionScoreInput';
import TrustDashboard from '@/components/trust/TrustDashboard';
import ActionQuickRef from '@/components/action-quickref/ActionQuickRef';

// ==================== Types ====================

interface LevelInfo {
  level_id: number;
  name: string;
  stage: number;
  status: 'passed' | 'available' | 'locked';
  score?: number;
}

interface CoreAction {
  action_no: number;
  action_name: string;
  node_id: number;
  trust_element: string;
  is_v2_new: boolean;
  weight: number;
  time_type: string;
  scoring_criteria?: string;
  key_points?: string;
}

interface ActionScore {
  score: number;
  perspective: string;
  executed: boolean;
  execution_form?: string;
  notes?: string;
}

interface StageInfo {
  stage: number;
  name: string;
  timeType: string;
  channel: string;
  icon: string;
  levels: LevelInfo[];
  actions: CoreAction[];
  completed: number;
  total: number;
  unlocked: boolean;
  allPassed: boolean;
}

// ==================== Constants ====================

const NODE_CONFIG: Record<number, {
  name: string;
  timeType: string;
  channel: string;
  icon: string;
  color: string;
}> = {
  1: { name: '首通电话', timeType: '时间点', channel: '仅通话', icon: '📞', color: '#2978B5' },
  2: { name: '三天回访', timeType: '时间段', channel: '多渠道', icon: '📅', color: '#22C55E' },
  3: { name: '五天预约', timeType: '时间段', channel: '多渠道', icon: '📋', color: '#F59E0B' },
  4: { name: '面诊当天', timeType: '时间段', channel: '多渠道', icon: '🏥', color: '#EF4444' },
};

const PERSPECTIVES = [
  { key: 'high_level', label: '管理者', color: '#2978B5' },
  { key: 'assistant', label: '助理自评', color: '#22C55E' },
  { key: 'patient', label: '患者反馈', color: '#F59E0B' },
];

// ==================== Sub-components ====================

function LevelCard({ level, onClick }: {
  level: LevelInfo;
  onClick: () => void;
}) {
  const statusConfig = {
    passed: { icon: CheckCircle2, bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30', label: '已通过' },
    available: { icon: Play, bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', label: '开始闯关' },
    locked: { icon: Lock, bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', label: '未解锁' },
  };
  const config = statusConfig[level.status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={level.status === 'locked'}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${config.bg} ${config.border} ${level.status !== 'locked' ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${level.status === 'passed' ? 'bg-green-500/20 text-green-600' : level.status === 'available' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
        {level.status === 'passed' ? <Icon className="w-4 h-4" /> : level.level_id}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${config.text}`}>{level.name}</p>
        {level.score !== undefined && level.status === 'passed' && (
          <p className="text-xs text-muted-foreground">得分 {level.score}</p>
        )}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    </button>
  );
}

// ==================== Main Page ====================

export default function LearningPage() {
  const [user, setUser] = useState<{ id: string; role: string; realName?: string } | null>(null);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [activeStage, setActiveStage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [actionScores, setActionScores] = useState<Record<string, Record<string, ActionScore>>>({});
  const [activePerspective, setActivePerspective] = useState<string>('high_level');
  const [toast, setToast] = useState<string | null>(null);
  const [showQuickRef, setShowQuickRef] = useState(false);
  const [allActions, setAllActions] = useState<CoreAction[]>([]);

  // Quiz modal state
  const [quizModule, setQuizModule] = useState<LevelInfo | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string | string[]>>({});
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch user
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user); })
      .catch(() => {});
  }, []);

  // Fetch learning data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [learnRes, actionsRes] = await Promise.all([
        fetch(`/api/learning?userId=${user.id}`),
        fetch('/api/core-actions'),
      ]);

      const learnData = await learnRes.json();
      const actionsData = await actionsRes.json();

      const allActs: CoreAction[] = actionsData.actions || actionsData || [];
      setAllActions(allActs);

      // Build stage info
      const levels: LevelInfo[] = learnData.levels || [];
      const builtStages: StageInfo[] = [1, 2, 3, 4].map(stageNum => {
        const cfg = NODE_CONFIG[stageNum];
        const stageLevels = levels.filter((l: LevelInfo) => l.stage === stageNum);
        const stageActions = allActs.filter((a: CoreAction) => a.node_id === stageNum);
        const passed = stageLevels.filter(l => l.status === 'passed').length;
        const total = stageLevels.length;
        // Unlock logic: stage 1 always unlocked; subsequent stages require previous all passed
        let unlocked = stageNum === 1;
        if (stageNum > 1) {
          const prevStageLevels = levels.filter((l: LevelInfo) => l.stage === stageNum - 1);
          unlocked = prevStageLevels.length > 0 && prevStageLevels.every(l => l.status === 'passed');
        }
        return {
          stage: stageNum,
          name: cfg.name,
          timeType: cfg.timeType,
          channel: cfg.channel,
          icon: cfg.icon,
          levels: stageLevels,
          actions: stageActions,
          completed: passed,
          total,
          unlocked,
          allPassed: total > 0 && passed === total,
        };
      });

      setStages(builtStages);

      // Set active stage to first unlocked
      const firstUnlocked = builtStages.find(s => s.unlocked && !s.allPassed) || builtStages[0];
      setActiveStage(firstUnlocked.stage);
    } catch (err) {
      console.error('Failed to load learning data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Fetch action scores for current stage
  const fetchActionScores = useCallback(async (stageNum: number) => {
    if (!user) return;
    const stage = stages.find(s => s.stage === stageNum);
    if (!stage || stage.actions.length === 0) return;

    try {
      const res = await fetch(`/api/action-scores?userId=${user.id}&nodeId=${stageNum}`);
      const data = await res.json();
      const scoresMap: Record<string, Record<string, ActionScore>> = {};

      (data.scores || []).forEach((s: any) => {
        const key = String(s.action_no);
        if (!scoresMap[key]) scoresMap[key] = {};
        scoresMap[key][s.perspective] = {
          score: s.score,
          perspective: s.perspective,
          executed: s.executed,
          execution_form: s.execution_form,
          notes: s.notes,
        };
      });

      setActionScores(scoresMap);
    } catch (err) {
      console.error('Failed to load action scores:', err);
    }
  }, [user, stages]);

  useEffect(() => {
    if (activeStage && stages.length > 0) {
      fetchActionScores(activeStage);
    }
  }, [activeStage, stages.length, fetchActionScores]);

  // Handle score change
  const handleScoreChange = async (
    actionNo: number,
    score: number,
    perspective: string,
    executionForm?: string,
    notes?: string
  ) => {
    if (!user) return;

    // Optimistic update
    setActionScores(prev => {
      const next = { ...prev };
      const key = String(actionNo);
      if (!next[key]) next[key] = {};
      next[key][perspective] = {
        score,
        perspective,
        executed: score > 0,
        execution_form: executionForm,
        notes,
      };
      return next;
    });

    try {
      await fetch('/api/action-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          actionNo,
          nodeId: activeStage,
          score,
          perspective,
          executed: score > 0,
          executionForm,
          notes,
        }),
      });
    } catch (err) {
      console.error('Failed to save score:', err);
      showToast('保存失败，请重试');
    }
  };

  // Quiz handlers
  const handleLevelClick = async (level: LevelInfo) => {
    if (level.status === 'locked') {
      showToast('请先完成前面的关卡');
      return;
    }
    if (level.status === 'passed') {
      showToast('该关卡已通过');
      return;
    }
    setQuizModule(level);
    try {
      const res = await fetch(`/api/questions?module=${level.level_id}&stage=${level.stage}&limit=10&random=true`);
      const json = await res.json();
      if (!json.questions || json.questions.length === 0) {
        showToast('该关卡暂无题目');
        setQuizModule(null);
        return;
      }
      setQuizQuestions(json.questions);
      setQuizAnswers({});
      setQuizIdx(0);
      setQuizResult(null);
    } catch {
      showToast('加载题目失败');
      setQuizModule(null);
    }
  };

  const handleQuizSubmit = async () => {
    if (!quizModule) return;
    setQuizSubmitting(true);
    try {
      const res = await fetch(`/api/learning/modules/${quizModule.level_id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, answers: quizAnswers }),
      });
      const result = await res.json();
      setQuizResult({ passed: result.passed, score: result.score });
      if (result.passed) {
        showToast(`恭喜！${quizModule.name} 考核通过，得分 ${result.score} 分`);
      } else {
        showToast(`未通过，得分 ${result.score} 分，请复习后重试`);
      }
    } catch {
      showToast('提交失败');
    } finally {
      setQuizSubmitting(false);
    }
  };

  const closeQuiz = () => {
    setQuizModule(null);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizIdx(0);
    setQuizResult(null);
    if (quizResult?.passed) fetchData();
  };

  const currentStage = stages.find(s => s.stage === activeStage);
  const currentCfg = NODE_CONFIG[activeStage];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">C-lite 成长训练</h1>
          <p className="text-sm text-muted-foreground mt-1">4节点 · 19核心动作 · 双轨驱动</p>
        </div>
        <button
          onClick={() => setShowQuickRef(true)}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shadow-sm"
        >
          <Search className="w-4 h-4" />
          19动作速查
        </button>
      </div>

      {/* 4-Node Navigation */}
      <div className="grid grid-cols-4 gap-3">
        {stages.map(stage => (
          <NodeCard
            key={stage.stage}
            node={{
              id: stage.stage,
              name: stage.name,
              timeType: stage.timeType,
              channel: stage.channel,
              completed: stage.completed,
              total: stage.total,
              status: stage.unlocked ? (stage.allPassed ? 'completed' : 'active') : 'locked',
            }}
            isSelected={activeStage === stage.stage}
            onClick={() => stage.unlocked && setActiveStage(stage.stage)}
          />
        ))}
      </div>

      {/* Dual Zone Layout */}
      {currentStage && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Learning Zone (闯关) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">📖 学习区 · 闯关</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  {currentStage.completed}/{currentStage.total} 关
                </span>
              </div>
              <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                {currentStage.levels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无闯关内容</p>
                ) : (
                  currentStage.levels.map(level => (
                    <LevelCard
                      key={level.level_id}
                      level={level}
                      onClick={() => handleLevelClick(level)}
                    />
                  ))
                )}
              </div>
              {/* Progress bar */}
              {currentStage.total > 0 && (
                <div className="px-5 pb-4">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${(currentStage.completed / currentStage.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    进度 {Math.round((currentStage.completed / currentStage.total) * 100)}%
                    {currentStage.allPassed && ' · 全部通过 ✅'}
                  </p>
                </div>
              )}
            </div>

            {/* Stage transition hint */}
            {currentStage.allPassed && activeStage < 4 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700">本节点全部闯关通过！</p>
                  <p className="text-xs text-green-600/70">
                    已解锁下一节点「{NODE_CONFIG[activeStage + 1]?.name}」
                  </p>
                </div>
                <button
                  onClick={() => setActiveStage(activeStage + 1)}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  进入 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Execution Zone (动作评分) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Perspective Switcher */}
            <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-semibold text-foreground">🎯 执行区 · 动作评分</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  {currentStage.actions.length} 个核心动作
                </span>
              </div>

              {/* Perspective tabs */}
              <div className="flex border-b border-border">
                {PERSPECTIVES.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setActivePerspective(p.key)}
                    className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 ${
                      activePerspective === p.key
                        ? 'border-current text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ borderColor: activePerspective === p.key ? p.color : 'transparent' }}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Action score list */}
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {currentStage.actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">该节点暂无核心动作</p>
                ) : (
                  currentStage.actions.map(action => {
                    const key = String(action.action_no);
                    const perspectiveScores = actionScores[key] || {};
                    const currentScore = perspectiveScores[activePerspective];

                    return (
                      <ActionScoreInput
                        key={action.action_no}
                        actionNo={action.action_no}
                        actionName={action.action_name}
                        trustElement={action.trust_element}
                        isV2New={action.is_v2_new}
                        weight={action.weight}
                        timeType={action.time_type}
                        currentScore={currentScore?.score}
                        perspective={activePerspective as 'high_level' | 'assistant' | 'patient'}
                        onScoreChange={(score: number, persp: string, execForm?: string, note?: string) =>
                          handleScoreChange(action.action_no, score, persp, execForm, note)
                        }
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Trust Dashboard */}
            {user && (
              <TrustDashboard userId={user.id} nodeId={activeStage} />
            )}
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {quizModule && quizQuestions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl shadow-dialog max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            {quizResult ? (
              <div className="text-center py-8">
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
                  quizResult.passed ? 'bg-green-500/20' : 'bg-destructive/20'
                }`}>
                  {quizResult.passed ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {quizResult.passed ? '考核通过！' : '未通过'}
                </h3>
                <p className="text-muted-foreground mb-1">得分：{quizResult.score} 分</p>
                <p className="text-sm text-muted-foreground mb-6">
                  {quizResult.passed ? '恭喜完成本关闯关' : '需要 80 分通过，请复习后重试'}
                </p>
                <button
                  onClick={closeQuiz}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                >
                  关闭
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">{quizModule.name}</h3>
                  <button onClick={closeQuiz} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="w-full bg-muted rounded-full h-2 mb-6">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }}
                  />
                </div>

                {quizQuestions[quizIdx] && (() => {
                  const q = quizQuestions[quizIdx];
                  return (
                    <div className="mb-6">
                      <p className="text-base font-medium text-foreground mb-4">
                        {quizIdx + 1}. {q.content}
                      </p>

                      {q.question_type === 'single' && q.options && (
                        <div className="space-y-2">
                          {q.options.map((opt: string, i: number) => {
                            const letter = String.fromCharCode(65 + i);
                            return (
                              <button
                                key={i}
                                onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: letter }))}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                                  quizAnswers[q.id] === letter
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

                      {q.question_type === 'multi' && q.options && (
                        <div className="space-y-2">
                          {q.options.map((opt: string, i: number) => {
                            const letter = String.fromCharCode(65 + i);
                            const selected = ((quizAnswers[q.id] as string[]) || []).includes(letter);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  const cur = (quizAnswers[q.id] as string[]) || [];
                                  setQuizAnswers(prev => ({
                                    ...prev,
                                    [q.id]: cur.includes(letter) ? cur.filter(l => l !== letter) : [...cur, letter],
                                  }));
                                }}
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
                              onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: val === '正确' ? 'T' : 'F' }))}
                              className={`flex-1 px-4 py-3 rounded-lg border transition-all text-sm ${
                                quizAnswers[q.id] === (val === '正确' ? 'T' : 'F')
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
                  );
                })()}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setQuizIdx(i => Math.max(0, i - 1))}
                    disabled={quizIdx === 0}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    上一题
                  </button>
                  <div className="flex gap-3">
                    {quizIdx < quizQuestions.length - 1 ? (
                      <button
                        onClick={() => setQuizIdx(i => i + 1)}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                      >
                        下一题
                      </button>
                    ) : (
                      <button
                        onClick={handleQuizSubmit}
                        disabled={quizSubmitting}
                        className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        {quizSubmitting ? '提交中...' : '提交答案'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Quick Ref Modal */}
      {showQuickRef && (
        <ActionQuickRef
          isOpen={showQuickRef}
          onClose={() => setShowQuickRef(false)}
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
