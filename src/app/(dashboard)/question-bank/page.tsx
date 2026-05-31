'use client';

import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Layers, List, ListChecks, ToggleRight, PenLine, Plus,
  Upload, Search, Filter, ChevronLeft, ChevronRight, Edit2, Trash2, Eye
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
  created_at: string;
}

export default function QuestionBankPage() {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState({
    levelId: '',
    questionType: '',
    difficulty: '',
    keyword: '',
  });
  const [showDetail, setShowDetail] = useState<Question | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const canEdit = hasPermission('question.create') || hasPermission('question.edit');
  const canDelete = hasPermission('question.delete');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

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
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此题目？')) return;
    try {
      const res = await fetch(`/api/questions?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchQuestions();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  if (loading || !user) return null;

  const totalPages = Math.ceil(total / pageSize);

  const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    single_choice: { label: '单选', icon: List, color: 'bg-primary/15 text-primary' },
    multiple_choice: { label: '多选', icon: ListChecks, color: 'bg-warning/15 text-warning' },
    true_false: { label: '判断', icon: ToggleRight, color: 'bg-green-500/15 text-green-500' },
    essay: { label: '简答', icon: PenLine, color: 'bg-red-500/15 text-red-500' },
  };

  const diffLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
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
              onClick={() => setShowAddForm(true)}
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
          { label: '多选题', value: stats.multiple_choice || 0, icon: ListChecks, color: 'bg-warning/10 text-warning' },
          { label: '判断题', value: stats.true_false || 0, icon: ToggleRight, color: 'bg-green-500/10 text-green-500' },
          { label: '简答题', value: stats.essay || 0, icon: PenLine, color: 'bg-red-500/10 text-red-500' },
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
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>第{i + 1}关</option>
              ))}
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
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-32">操作</th>
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
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    暂无题目数据
                  </td>
                </tr>
              ) : (
                questions.map(q => {
                  const typeInfo = typeLabels[q.question_type] || { label: q.question_type, icon: List, color: 'bg-muted text-muted-foreground' };
                  const TypeIcon = typeInfo.icon;

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
                            <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition" title="编辑">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
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
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages || 1}
            </span>
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
              <div>
                <span className="text-muted-foreground">关卡：</span>
                <span className="text-foreground">第{showDetail.level_id}关</span>
              </div>
              <div>
                <span className="text-muted-foreground">题型：</span>
                <span className="text-foreground">{typeLabels[showDetail.question_type]?.label || showDetail.question_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">难度：</span>
                <span className="text-foreground">{diffLabels[showDetail.difficulty] || showDetail.difficulty}</span>
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
                <span className="text-green-500 font-medium">
                  {Array.isArray(showDetail.answer?.correct)
                    ? showDetail.answer.correct.join(', ')
                    : showDetail.answer?.correct || '-'}
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
    </div>
  );
}
