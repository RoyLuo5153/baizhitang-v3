'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle, XCircle, ArrowLeft,
  Trophy, RotateCcw, Star, Clock, AlertCircle
} from 'lucide-react';

interface Question {
  id: number;
  question_type: string;
  difficulty: string;
  content: string;
  options: Record<string, string> | null;
}

interface AnswerResult {
  questionId: number;
  correct: boolean;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  explanation: string;
}

type Phase = 'loading' | 'quiz' | 'submitting' | 'result';

export default function LevelQuizPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const levelId = parseInt(params.levelId as string, 10);

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [showExplanation, setShowExplanation] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const fetchQuestions = useCallback(async () => {
    if (!user || isNaN(levelId)) return;
    try {
      const res = await fetch(`/api/learning/${levelId}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setPhase('quiz');
        setTimeLeft(data.totalQuestions * 30); // 30秒/题
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
  }, [user, levelId, router]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // 倒计时
  useEffect(() => {
    if (phase !== 'quiz') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const handleAnswer = (questionId: number, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!user || phase === 'submitting') return;
    setPhase('submitting');

    try {
      const res = await fetch(`/api/learning/${levelId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: String(user.id), answers }),
      });

      if (res.ok) {
        const data = await res.json();
        setScore(data.score);
        setPassed(data.passed);
        setResults(data.results);
        setPhase('result');
      }
    } catch (err) {
      console.error('Failed to submit:', err);
      setPhase('quiz');
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentIndex(0);
    setResults([]);
    setPhase('quiz');
    setTimeLeft(questions.length * 30);
  };

  if (loading || !user) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // Loading
  if (phase === 'loading') {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  // Result
  if (phase === 'result') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 结果头部 */}
        <div className={`rounded-lg p-8 text-center border ${
          passed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            passed ? 'bg-green-500/15' : 'bg-red-500/15'
          }`}>
            {passed ? (
              <Trophy className="w-10 h-10 text-green-500" />
            ) : (
              <RotateCcw className="w-10 h-10 text-red-500" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {passed ? '恭喜通关！' : '未通过，继续加油'}
          </h2>
          <p className="text-muted-foreground mt-2">
            第{levelId}关 · 得分 <span className={`text-3xl font-bold ${passed ? 'text-green-500' : 'text-red-500'}`}>{score}</span> 分
            （及格线 80 分）
          </p>
        </div>

        {/* 题目回顾 */}
        <div className="bg-card rounded-lg shadow-sm border border-border/30">
          <div className="p-4 border-b border-border/20">
            <h3 className="text-sm font-semibold text-foreground">答题回顾</h3>
          </div>
          <div className="divide-y divide-border/15">
            {results.map((r, idx) => (
              <div key={r.questionId} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    r.correct ? 'bg-green-500/15' : 'bg-red-500/15'
                  }`}>
                    {r.correct ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">第{idx + 1}题</p>
                    {!r.correct && (
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="text-red-500">
                          你的答案：{Array.isArray(r.userAnswer) ? r.userAnswer.join(', ') : r.userAnswer || '未作答'}
                        </p>
                        <p className="text-green-500">
                          正确答案：{Array.isArray(r.correctAnswer) ? r.correctAnswer.join(', ') : r.correctAnswer}
                        </p>
                        {r.explanation && (
                          <p className="text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                            {r.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 rounded-md text-sm font-medium border border-border/40 text-foreground hover:bg-muted/50 transition-all"
          >
            重新挑战
          </button>
          <button
            onClick={() => router.push('/learning')}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-all"
          >
            返回关卡
          </button>
        </div>
      </div>
    );
  }

  // Quiz
  const q = questions[currentIndex];
  if (!q) return null;

  const isMultiChoice = q.question_type === 'multiple_choice';
  const isTrueFalse = q.question_type === 'true_false';
  const currentAnswer = answers[q.id];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 顶部信息 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/learning')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </span>
          <span>
            {answeredCount}/{questions.length} 已答
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* 题目卡 */}
      <div className="bg-card rounded-lg shadow-sm border border-border/30 p-6">
        {/* 题目类型标签 */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            isTrueFalse ? 'bg-green-500/15 text-green-500'
              : isMultiChoice ? 'bg-warning/15 text-warning'
                : 'bg-primary/15 text-primary'
          }`}>
            {isTrueFalse ? '判断题' : isMultiChoice ? '多选题' : '单选题'}
          </span>
          <span className="text-xs text-muted-foreground">
            第 {currentIndex + 1} / {questions.length} 题
          </span>
        </div>

        {/* 题目内容 */}
        <h3 className="text-base font-medium text-foreground mb-6 leading-relaxed">
          {q.content}
        </h3>

        {/* 选项 */}
        {q.options && (
          <div className="space-y-3">
            {Object.entries(q.options).map(([key, value]) => {
              const isSelected = isMultiChoice
                ? Array.isArray(currentAnswer) && currentAnswer.includes(key)
                : currentAnswer === key;

              return (
                <button
                  key={key}
                  onClick={() => {
                    if (isMultiChoice) {
                      const current = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
                      const idx = current.indexOf(key);
                      if (idx >= 0) current.splice(idx, 1);
                      else current.push(key);
                      handleAnswer(q.id, current.sort());
                    } else {
                      handleAnswer(q.id, key);
                    }
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-primary/8 border-primary/40 text-foreground'
                      : 'bg-background border-border/30 text-foreground hover:bg-muted/30 hover:border-border/50'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {key}
                  </span>
                  <span className="text-sm leading-relaxed">{value}</span>
                </button>
              );
            })}
          </div>
        )}

        {isMultiChoice && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            本题为多选题，可选择多个答案
          </p>
        )}
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" />
          上一题
        </button>

        {/* 题号快速导航 */}
        <div className="flex flex-wrap gap-1.5 max-w-md justify-center">
          {questions.map((_, idx) => {
            const isAnswered = answers[questions[idx].id] !== undefined;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 rounded text-xs font-medium transition ${
                  isCurrent ? 'bg-primary text-primary-foreground'
                    : isAnswered ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
            className="flex items-center gap-1 px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition"
          >
            下一题
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {phase === 'submitting' ? '提交中...' : '提交答卷'}
          </button>
        )}
      </div>
    </div>
  );
}
