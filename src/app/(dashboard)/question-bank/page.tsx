'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Layers, List, ListChecks, ToggleRight, PenLine, Plus,
  Upload, Search, ChevronLeft, ChevronRight, Edit2, Trash2, Eye,
  CheckCircle2, XCircle, Clock, AlertCircle
} from 'lucide-react';

interface Question {
  id: number;
  level_id: number;
  question_type: string;
  difficulty: string;
  content: string;
  options: Record<string, string> | null;
  answer: { correct: string | string[] };
  explanation: string;
  is_active: boolean;
  status: string;
  created_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  module?: string;
  stage?: string;
}

interface Level {
  id: number;
  name: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  approved: { label: '已通过', color: 'bg-green-500/15 text-green-600', icon: CheckCircle2 },
  pending_review: { label: '待审核', color: 'bg-amber-500/15 text-amber-600', icon: Clock },
  rejected: { label: '已拒绝', color: 'bg-red-500/15 text-red-600', icon: XCircle },
};

export default function QuestionBankPage() {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [filters, setFilters] = useState({
    levelId: '',
    questionType: '',
    difficulty: '',
    keyword: '',
    module: '',
    stage: '',
  });
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [showDetail, setShowDetail] = useState<Question | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [levels, setLevels] = useState<Level[]>([]);

  // 表单状态
  const [formData, setFormData] = useState({
    levelId: '',
    questionType: 'single_choice',
    difficulty: 'medium',
    content: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    explanation: '',
    module: '',
    stage: '',
  });

  const canEdit = hasPermission('question.create') || hasPermission('question.edit');
  const canDelete = hasPermission('question.delete');
  const isManager = user?.role === 'training_manager';

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // 获取关卡列表
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await fetch('/api/learning/levels');
        if (res.ok) {
          const data = await res.json();
          setLevels(data.levels || []);
        }
      } catch { /* ignore */ }
    };
    fetchLevels();
  }, []);

  // 获取待审核数量
  const fetchPendingCount = useCallback(async () => {
    if (!isManager) return;
    try {
      const res = await fetch('/api/questions/review');
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count || 0);
      }
    } catch { /* ignore */ }
  }, [isManager]);

  useEffect(() => { fetchPendingCount(); }, [fetchPendingCount]);

  const fetchQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.levelId) params.set('levelId', filters.levelId);
      if (filters.questionType) params.set('questionType', filters.questionType);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.keyword) params.set('keyword', filters.keyword);
      if (filters.module) params.set('module', filters.module);
      if (filters.stage) params.set('stage', filters.stage);
      if (activeTab === 'pending') params.set('status', 'pending_review');

      const res = await fetch(`/api/questions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setTotal(data.total);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setDataLoading(false);
    }
  }, [page, pageSize, filters, activeTab]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此题目？')) return;
    try {
      const res = await fetch(`/api/questions?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchQuestions();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleAdd = async () => {
    if (!formData.levelId || !formData.content) return;
    try {
      const options: Record<string, string> | null =
        formData.questionType === 'true_false'
          ? { '对': '正确', '错': '错误' }
          : { A: formData.optionA, B: formData.optionB, C: formData.optionC, D: formData.optionD };

      const body: Record<string, unknown> = {
        levelId: Number(formData.levelId),
        questionType: formData.questionType,
        difficulty: formData.difficulty,
        content: formData.content,
        options,
        answer: { correct: formData.correctAnswer },
        explanation: formData.explanation,
        module: formData.module || undefined,
        stage: formData.stage || undefined,
      };

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setShowAddForm(false);
        fetchQuestions();
        fetchPendingCount();
        alert(data.reviewStatus === 'approved' ? '题目已发布' : '题目已提交审核，等待培训负责人审核');
        resetForm();
      }
    } catch (err) {
      console.error('Failed to add question:', err);
    }
  };

  const handleEdit = async () => {
    if (!editQuestion || !formData.content) return;
    try {
      const options: Record<string, string> | null =
        formData.questionType === 'true_false'
          ? { '对': '正确', '错': '错误' }
          : { A: formData.optionA, B: formData.optionB, C: formData.optionC, D: formData.optionD };

      const body: Record<string, unknown> = {
        id: editQuestion.id,
        levelId: Number(formData.levelId),
        questionType: formData.questionType,
        difficulty: formData.difficulty,
        content: formData.content,
        options,
        answer: { correct: formData.correctAnswer },
        explanation: formData.explanation,
        module: formData.module || undefined,
        stage: formData.stage || undefined,
      };

      const res = await fetch('/api/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setEditQuestion(null);
        fetchQuestions();
        fetchPendingCount();
        alert(data.reviewStatus === 'approved' ? '题目已更新' : '修改已提交，等待审核');
        resetForm();
      }
    } catch (err) {
      console.error('Failed to edit question:', err);
    }
  };

  const handleReview = async (questionId: number, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const reason = prompt('请输入拒绝原因：');
      if (!reason) return;
    }
    try {
      const res = await fetch('/api/questions/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, action }),
      });
      if (res.ok) {
        fetchQuestions();
        fetchPendingCount();
      }
    } catch (err) {
      console.error('Failed to review:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      levelId: '', questionType: 'single_choice', difficulty: 'medium',
      content: '', optionA: '', optionB: '', optionC: '', optionD: '',
      correctAnswer: 'A', explanation: '', module: '', stage: '',
    });
  };

  const openEditForm = (q: Question) => {
    setEditQuestion(q);
    setFormData({
      levelId: String(q.level_id),
      questionType: q.question_type,
      difficulty: q.difficulty,
      content: q.content,
      optionA: q.options?.A || '',
      optionB: q.options?.B || '',
      optionC: q.options?.C || '',
      optionD: q.options?.D || '',
      correctAnswer: Array.isArray(q.answer?.correct) ? q.answer.correct.join(',') : (q.answer?.correct || 'A'),
      explanation: q.explanation || '',
      module: q.module || '',
      stage: q.stage || '',
    });
  };

  if (loading || !user) return null;

  const totalPages = Math.ceil(total / pageSize);

  const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    single_choice: { label: '单选', icon: List, color: 'bg-primary/15 text-primary' },
    multiple_choice: { label: '多选', icon: ListChecks, color: 'bg-amber-500/15 text-amber-600' },
    true_false: { label: '判断', icon: ToggleRight, color: 'bg-green-500/15 text-green-600' },
    essay: { label: '简答', icon: PenLine, color: 'bg-red-500/15 text-red-600' },
  };

  const diffLabels: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };

  // 表单弹窗
  const renderForm = (isEdit: boolean) => {
    const onSubmit = isEdit ? handleEdit : handleAdd;
    const onClose = isEdit ? () => { setEditQuestion(null); resetForm(); } : () => { setShowAddForm(false); resetForm(); };
    const title = isEdit ? '编辑题目' : '新增题目';

    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">所属关卡</label>
                <select
                  value={formData.levelId}
                  onChange={e => setFormData(f => ({ ...f, levelId: e.target.value }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">请选择关卡</option>
                  {levels.map(l => <option key={l.id} value={String(l.id)}>第{l.id}关 - {l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">题型</label>
                <select
                  value={formData.questionType}
                  onChange={e => setFormData(f => ({ ...f, questionType: e.target.value, correctAnswer: e.target.value === 'true_false' ? '对' : 'A' }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="single_choice">单选题</option>
                  <option value="multiple_choice">多选题</option>
                  <option value="true_false">判断题</option>
                  <option value="essay">简答题</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">难度</label>
                <select
                  value={formData.difficulty}
                  onChange={e => setFormData(f => ({ ...f, difficulty: e.target.value }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">题目内容</label>
              <textarea
                value={formData.content}
                onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
                rows={3}
                className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="输入题目内容..."
              />
            </div>

            {formData.questionType !== 'essay' && formData.questionType !== 'true_false' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">选项</label>
                {['A', 'B', 'C', 'D'].map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary w-5">{opt}.</span>
                    <input
                      value={formData[`option${opt}` as keyof typeof formData]}
                      onChange={e => setFormData(f => ({ ...f, [`option${opt}`]: e.target.value }))}
                      className="flex-1 bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={`选项${opt}内容`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">正确答案</label>
              {formData.questionType === 'true_false' ? (
                <select
                  value={formData.correctAnswer}
                  onChange={e => setFormData(f => ({ ...f, correctAnswer: e.target.value }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="对">正确</option>
                  <option value="错">错误</option>
                </select>
              ) : formData.questionType === 'multiple_choice' ? (
                <input
                  value={formData.correctAnswer}
                  onChange={e => setFormData(f => ({ ...f, correctAnswer: e.target.value }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="多选用逗号分隔，如 A,B,C"
                />
              ) : formData.questionType === 'essay' ? (
                <input
                  value={formData.correctAnswer}
                  onChange={e => setFormData(f => ({ ...f, correctAnswer: e.target.value }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="参考答案"
                />
              ) : (
                <select
                  value={formData.correctAnswer}
                  onChange={e => setFormData(f => ({ ...f, correctAnswer: e.target.value }))}
                  className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">解析（可选）</label>
              <textarea
                value={formData.explanation}
                onChange={e => setFormData(f => ({ ...f, explanation: e.target.value }))}
                rows={2}
                className="w-full bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="输入题目解析..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium border border-border/40 text-foreground hover:bg-muted/50 transition">取消</button>
              <button onClick={onSubmit} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition">
                {isEdit ? '保存修改' : '提交'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">题库管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理和维护所有关卡题目</p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button className="px-4 py-2 rounded-md text-sm font-medium border border-border/40 text-foreground hover:bg-muted/50 transition inline-flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" />
              批量导入
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => { setShowAddForm(true); resetForm(); }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition inline-flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              添加题目
            </button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: '总题数', value: stats.total || 0, icon: Layers, color: 'bg-primary/10 text-primary' },
          { label: '单选题', value: stats.single_choice || 0, icon: List, color: 'bg-primary/10 text-primary' },
          { label: '多选题', value: stats.multiple_choice || 0, icon: ListChecks, color: 'bg-amber-500/10 text-amber-600' },
          { label: '判断题', value: stats.true_false || 0, icon: ToggleRight, color: 'bg-green-500/10 text-green-600' },
          { label: '简答题', value: stats.essay || 0, icon: PenLine, color: 'bg-red-500/10 text-red-600' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 bg-card rounded-lg shadow-sm p-1 border border-border/30 w-fit">
        <button
          onClick={() => { setActiveTab('all'); setPage(1); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          全部题目
        </button>
        {isManager && (
          <button
            onClick={() => { setActiveTab('pending'); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition inline-flex items-center gap-2 ${activeTab === 'pending' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            待审核
            {pendingCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${activeTab === 'pending' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-500/20 text-amber-600'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* 筛选区 */}
      <div className="bg-card rounded-lg shadow-sm p-4 border border-border/30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">关卡</label>
            <select
              value={filters.levelId}
              onChange={e => { setFilters(f => ({ ...f, levelId: e.target.value })); setPage(1); }}
              className="bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
            >
              <option value="">全部关卡</option>
              {levels.map(l => <option key={l.id} value={String(l.id)}>第{l.id}关 - {l.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">模块</label>
            <select
              value={filters.module}
              onChange={e => { setFilters(f => ({ ...f, module: e.target.value })); setPage(1); }}
              className="bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
            >
              <option value="">全部模块</option>
              <option value="diabetes_basics">糖尿病基础</option>
              <option value="service_standards">服务标准</option>
              <option value="service_language">服务用语</option>
              <option value="compliance">合规红线</option>
              <option value="first_call">首通电话场景</option>
              <option value="followup_call">回访电话场景</option>
              <option value="appointment_call">预约电话场景</option>
              <option value="visit_day">面诊当天场景</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">阶段</label>
            <select
              value={filters.stage}
              onChange={e => { setFilters(f => ({ ...f, stage: e.target.value })); setPage(1); }}
              className="bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]"
            >
              <option value="">全部阶段</option>
              <option value="foundation">基础通关</option>
              <option value="practice">实操通关</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">题型</label>
            <select
              value={filters.questionType}
              onChange={e => { setFilters(f => ({ ...f, questionType: e.target.value })); setPage(1); }}
              className="bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]"
            >
              <option value="">全部题型</option>
              <option value="single_choice">单选题</option>
              <option value="multiple_choice">多选题</option>
              <option value="true_false">判断题</option>
              <option value="essay">简答题</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">难度</label>
            <select
              value={filters.difficulty}
              onChange={e => { setFilters(f => ({ ...f, difficulty: e.target.value })); setPage(1); }}
              className="bg-muted border-none rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[100px]"
            >
              <option value="">全部难度</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索题目内容..."
                value={filters.keyword}
                onChange={e => { setFilters(f => ({ ...f, keyword: e.target.value })); setPage(1); }}
                className="w-full bg-muted border-none rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 题目列表 */}
      <div className="bg-card rounded-lg shadow-sm border border-border/30">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/20">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-16">ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-20">关卡</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-20">题型</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-20">难度</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">题目内容</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-24">审核状态</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-40">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {dataLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-10" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-10" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-12" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-10" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    {activeTab === 'pending' ? '暂无待审核题目' : '暂无题目数据'}
                  </td>
                </tr>
              ) : (
                questions.map(q => {
                  const typeInfo = typeLabels[q.question_type] || { label: q.question_type, icon: List, color: 'bg-muted text-muted-foreground' };
                  const TypeIcon = typeInfo.icon;
                  const st = statusConfig[q.status] || statusConfig.pending_review;
                  const StatusIcon = st.icon;

                  return (
                    <tr key={q.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{q.id}</td>
                      <td className="px-4 py-3 text-sm text-foreground">第{q.level_id}关</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{diffLabels[q.difficulty] || q.difficulty}</td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-md truncate">{q.content}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${st.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowDetail(q)}
                            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition"
                            title="查看"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => openEditForm(q)}
                              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition"
                              title="编辑"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {isManager && q.status === 'pending_review' && (
                            <>
                              <button
                                onClick={() => handleReview(q.id, 'approve')}
                                className="p-1.5 rounded hover:bg-green-500/10 text-muted-foreground hover:text-green-600 transition"
                                title="通过"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReview(q.id, 'reject')}
                                className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition"
                                title="拒绝"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {canDelete && q.status !== 'pending_review' && (
                            <button
                              onClick={() => handleDelete(q.id)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
          <span className="text-xs text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-muted/50 disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages || 1}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded hover:bg-muted/50 disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* 题目详情弹窗 */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-card rounded-lg shadow-lg max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">题目详情 #{showDetail.id}</h3>
              <button onClick={() => setShowDetail(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-4">
                <div><span className="text-muted-foreground">关卡：</span><span className="text-foreground">第{showDetail.level_id}关</span></div>
                <div><span className="text-muted-foreground">题型：</span><span className="text-foreground">{typeLabels[showDetail.question_type]?.label || showDetail.question_type}</span></div>
                <div><span className="text-muted-foreground">难度：</span><span className="text-foreground">{diffLabels[showDetail.difficulty] || showDetail.difficulty}</span></div>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">审核状态：</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig[showDetail.status]?.color || ''}`}>
                  {statusConfig[showDetail.status]?.label || showDetail.status}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">题目：</span>
                <p className="text-foreground bg-muted/30 rounded p-3">{showDetail.content}</p>
              </div>
              {showDetail.options && (
                <div>
                  <span className="text-muted-foreground block mb-1">选项：</span>
                  <div className="space-y-1">
                    {Object.entries(showDetail.options).map(([k, v]) => (
                      <div key={k} className="flex gap-2 bg-muted/30 rounded px-3 py-1.5">
                        <span className="font-medium text-primary">{k}.</span>
                        <span className="text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">正确答案：</span>
                <span className="text-green-600 font-medium">
                  {Array.isArray(showDetail.answer?.correct) ? showDetail.answer.correct.join(', ') : showDetail.answer?.correct || '-'}
                </span>
              </div>
              {showDetail.explanation && (
                <div>
                  <span className="text-muted-foreground block mb-1">解析：</span>
                  <p className="text-foreground bg-muted/30 rounded p-3">{showDetail.explanation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新增题目弹窗 */}
      {showAddForm && renderForm(false)}

      {/* 编辑题目弹窗 */}
      {editQuestion && renderForm(true)}
    </div>
  );
}
