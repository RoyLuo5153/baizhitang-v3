'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardCheck, Plus, FileText, Clock, CheckCircle2,
  BarChart3, Calendar, ChevronDown, X, Loader2,
  AlertTriangle, Star, Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

// === Types ===

type AssessmentType = 'daily' | 'special' | 'stage';
type RecordStatus = 'completed' | 'in_progress' | 'pending';

interface AssessmentTask {
  id: string;
  title: string;
  type: AssessmentType;
  traineeNames: string[];
  dueDate: string;
  completionRate: number;
  totalTrainees: number;
  completedTrainees: number;
}

interface ScoreDimension {
  knowledge?: number;
  communication?: number;
  attitude?: number;
  professional?: number;
  [key: string]: number | undefined;
}

interface AssessmentRecord {
  id: string;
  traineeId: string;
  traineeName: string;
  assessorName: string;
  assessmentTitle: string;
  type: string;
  date: string;
  dueDate: string;
  scores: ScoreDimension;
  overallScore: number;
  comment: string;
  status: RecordStatus;
}

interface NewAssessmentForm {
  title: string;
  type: AssessmentType;
  traineeIds: string[];
  dueDate: string;
}

interface TraineeOption {
  id: string;
  name: string;
  cohort: string;
}

// === Constants ===

const ASSESSMENT_TYPE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  daily: { label: '日常考核', badgeClass: 'bg-primary/15 text-primary' },
  special: { label: '专项考核', badgeClass: 'bg-[#f59e0b]/15 text-[#f59e0b]' },
  stage: { label: '阶段考核', badgeClass: 'bg-destructive/15 text-destructive' },
};

const RECORD_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  completed: { label: '已完成', badgeClass: 'bg-[#22c55e]/15 text-[#22c55e]' },
  in_progress: { label: '进行中', badgeClass: 'bg-primary/15 text-primary' },
  pending: { label: '待考核', badgeClass: 'bg-[#f59e0b]/15 text-[#f59e0b]' },
};

const SCORE_DIMENSION_LABELS: Record<string, string> = {
  knowledge: '专业知识',
  communication: '沟通表达',
  attitude: '服务态度',
  professional: '专业能力',
};

type TabType = 'tasks' | 'records';

// === Helper Functions ===

function getProgressColor(rate: number): string {
  if (rate >= 80) return 'bg-[#22c55e]';
  if (rate >= 50) return 'bg-primary';
  if (rate > 0) return 'bg-[#f59e0b]';
  return 'bg-muted-foreground/30';
}

function getScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-[#22c55e]/15 text-[#22c55e]';
  if (score >= 60) return 'bg-primary/15 text-primary';
  if (score > 0) return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

function getOverallColor(score: number): string {
  if (score >= 80) return 'text-[#22c55e]';
  if (score >= 60) return 'text-[#f59e0b]';
  return 'text-destructive';
}

// === Main Component ===

export default function AssessmentPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AssessmentTask[]>([]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [scoringRecord, setScoringRecord] = useState<AssessmentRecord | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/assessment');
      if (res.ok) {
        const json = await res.json();
        setTasks(json.tasks || []);
        setRecords(json.assessments || []);
      }
    } catch {
      // empty
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === Loading State ===
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <div className="h-8 w-24 bg-muted-foreground/10 animate-pulse rounded-md" />
          <div className="h-8 w-24 bg-muted-foreground/10 animate-pulse rounded-md" />
        </div>
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Stats
  const totalTasks = tasks.length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
  const avgScore = records.length > 0
    ? Math.round(records.filter(r => r.overallScore > 0).reduce((s, r) => s + r.overallScore, 0) / Math.max(records.filter(r => r.overallScore > 0).length, 1))
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">日常考核</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">管理新人考核任务，发布考核并查看考核结果</p>
        </div>
        {(user?.primaryRole === 'training_manager' || user?.primaryRole === 'mentor' || user?.primaryRole === 'teacher') && (
          <button
            id="btn-publish-assessment"
            onClick={() => setShowPublishDialog(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />发布考核
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '考核任务', value: totalTasks, icon: FileText, color: 'text-primary' },
          { label: '已完成', value: completedCount, icon: CheckCircle2, color: 'text-[#22c55e]' },
          { label: '待完成', value: pendingCount, icon: Clock, color: 'text-[#f59e0b]' },
          { label: '平均分', value: avgScore, icon: Star, color: 'text-primary' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}/10`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'tasks' as TabType, label: '考核任务', icon: FileText },
          { key: 'records' as TabType, label: '考核记录', icon: BarChart3 },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <TasksTable tasks={tasks} />
      )}

      {activeTab === 'records' && (
        <RecordsTable records={records} onScore={(r) => setScoringRecord(r)} />
      )}

      {/* Publish Dialog */}
      {showPublishDialog && (
        <PublishAssessmentDialog
          onClose={() => setShowPublishDialog(false)}
          onPublished={() => {
            setShowPublishDialog(false);
            fetchData();
          }}
        />
      )}

      {/* Scoring Dialog */}
      {scoringRecord && (
        <ScoringDialog
          record={scoringRecord}
          onClose={() => setScoringRecord(null)}
          onSaved={() => {
            setScoringRecord(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// === Tasks Table Component ===

function TasksTable({ tasks }: { tasks: AssessmentTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-card p-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">暂无考核任务</p>
        <p className="text-xs text-muted-foreground mt-1">点击「发布考核」创建新的考核任务</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">任务名称</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">考核类型</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">适用新人</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">截止日期</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3 w-52">完成率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {tasks.map(task => (
              <tr key={task.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground">{task.title}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${(ASSESSMENT_TYPE_CONFIG[task.type] || ASSESSMENT_TYPE_CONFIG.daily).badgeClass}`}>
                    {(ASSESSMENT_TYPE_CONFIG[task.type] || ASSESSMENT_TYPE_CONFIG.daily).label}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {task.traineeNames.map(name => (
                      <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                        {name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />{task.dueDate || '—'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressColor(task.completionRate)}`}
                        style={{ width: `${Math.max(task.completionRate, 2)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground w-12 text-right">{task.completionRate}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{task.completedTrainees}/{task.totalTrainees} 人已完成</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Records Table Component ===

function RecordsTable({ records, onScore }: { records: AssessmentRecord[]; onScore: (r: AssessmentRecord) => void }) {
  if (records.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-card p-12 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">暂无考核记录</p>
        <p className="text-xs text-muted-foreground mt-1">完成考核后将在此处显示记录</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">被考核人</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">考核名称</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">考核人</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">日期</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">各项评分</th>
              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">总评</th>
              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">状态</th>
              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {records.map(record => (
              <tr key={record.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                      {record.traineeName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{record.traineeName}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-foreground">{record.assessmentTitle}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-muted-foreground">{record.assessorName || '—'}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-muted-foreground">{record.date || '—'}</span>
                </td>
                <td className="px-5 py-4">
                  {record.status === 'completed' && Object.keys(record.scores).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(record.scores).map(([key, val]) => (
                        val !== undefined && val > 0 ? (
                          <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${getScoreBadgeClass(val)}`}>
                            {SCORE_DIMENSION_LABELS[key] || key} {val}
                          </span>
                        ) : null
                      ))}
                    </div>
                  ) : record.status === 'in_progress' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                      考核中...
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                      待评分
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  {record.overallScore > 0 ? (
                    <span className={`text-lg font-bold ${getOverallColor(record.overallScore)}`}>
                      {record.overallScore}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${(RECORD_STATUS_CONFIG[record.status] || RECORD_STATUS_CONFIG.pending).badgeClass}`}>
                    {(RECORD_STATUS_CONFIG[record.status] || RECORD_STATUS_CONFIG.pending).label}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  {record.status !== 'completed' && (
                    <button
                      onClick={() => onScore(record)}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      评分
                    </button>
                  )}
                  {record.status === 'completed' && record.comment && (
                    <span className="text-xs text-muted-foreground" title={record.comment}>
                      {record.comment.length > 10 ? record.comment.slice(0, 10) + '...' : record.comment}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Publish Assessment Dialog ===

function PublishAssessmentDialog({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<NewAssessmentForm>({
    title: '',
    type: 'daily',
    traineeIds: [],
    dueDate: '',
  });
  const [trainees, setTrainees] = useState<TraineeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTraineeDropdown, setShowTraineeDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [traineeSearch, setTraineeSearch] = useState('');

  // 期数列表（从新人数据中提取去重）
  const cohortList = [...new Set(trainees.map(t => t.cohort).filter(Boolean))].sort();

  // 获取新人列表
  useEffect(() => {
    fetch('/api/trainee-profiles')
      .then(r => r.json())
      .then(json => {
        const list = json.trainees || [];
        setTrainees(list.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: (p.realName as string) || (p.real_name as string) || '',
          cohort: (p.cohort as string) || '',
        })));
      })
      .catch(() => {
        // fallback empty
      });
  }, []);

  function toggleTrainee(traineeId: string) {
    setForm(prev => ({
      ...prev,
      traineeIds: prev.traineeIds.includes(traineeId)
        ? prev.traineeIds.filter(id => id !== traineeId)
        : [...prev.traineeIds, traineeId],
    }));
  }

  function selectCohort(cohort: string) {
    const cohortIds = trainees.filter(t => t.cohort === cohort).map(t => t.id);
    // 如果该期所有人都已选中，则取消全选该期；否则全选该期
    const allSelected = cohortIds.every(id => form.traineeIds.includes(id));
    if (allSelected) {
      setForm(prev => ({ ...prev, traineeIds: prev.traineeIds.filter(id => !cohortIds.includes(id)) }));
    } else {
      const newIds = [...new Set([...form.traineeIds, ...cohortIds])];
      setForm(prev => ({ ...prev, traineeIds: newIds }));
    }
  }

  function selectAll() {
    setForm(prev => ({ ...prev, traineeIds: trainees.map(t => t.id) }));
  }

  function clearAll() {
    setForm(prev => ({ ...prev, traineeIds: [] }));
  }

  async function handlePublish() {
    if (!form.title.trim()) { setError('请输入考核标题'); return; }
    if (form.traineeIds.length === 0) { setError('请选择至少一位新人'); return; }
    if (!form.dueDate) { setError('请选择截止日期'); return; }

    setSaving(true);
    setError(null);

    try {
      const results = await Promise.all(
        form.traineeIds.map(traineeId =>
          fetch('/api/assessment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              traineeId,
              type: form.type,
              title: form.title.trim(),
              dueDate: form.dueDate,
              assessorId: user?.id,
              scores: {},
              comment: '',
            }),
          })
        )
      );

      if (results.every(r => r.ok)) {
        onPublished();
      } else {
        setError('部分考核发布失败，请重试');
      }
    } catch {
      setError('发布失败，请检查网络后重试');
    }
    setSaving(false);
  }

  const selectedTraineeNames = trainees
    .filter(t => form.traineeIds.includes(t.id))
    .map(t => t.name);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">发布考核</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-destructive/5 border border-destructive/15 rounded-lg px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="input-assessment-title">考核标题</label>
            <input
              id="input-assessment-title"
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full mt-1.5 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="如：新员工入职日常考核 - 第4周"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-foreground">考核类型</label>
            <div className="relative mt-1.5">
              <button onClick={() => setShowTypeDropdown(!showTypeDropdown)} className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${ASSESSMENT_TYPE_CONFIG[form.type].badgeClass}`}>
                  {ASSESSMENT_TYPE_CONFIG[form.type].label}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showTypeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-md border border-border shadow-float z-10 overflow-hidden">
                  {Object.entries(ASSESSMENT_TYPE_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => { setForm(prev => ({ ...prev, type: key as AssessmentType })); setShowTypeDropdown(false); }}
                      className={`w-full px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2 ${form.type === key ? 'bg-primary/5 text-primary' : 'text-foreground'}`}
                    >
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${config.badgeClass}`}>{config.label}</span>
                      {form.type === key && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trainee Multi-Select */}
          <div>
            <label className="text-sm font-medium text-foreground">适用新人</label>

            {/* 期数快捷选择 */}
            {cohortList.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground shrink-0">按期选择：</span>
                {cohortList.map(cohort => {
                  const cohortIds = trainees.filter(t => t.cohort === cohort).map(t => t.id);
                  const allSelected = cohortIds.length > 0 && cohortIds.every(id => form.traineeIds.includes(id));
                  const someSelected = cohortIds.some(id => form.traineeIds.includes(id));
                  return (
                    <button
                      key={cohort}
                      onClick={() => selectCohort(cohort)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                        allSelected
                          ? 'bg-primary text-primary-foreground'
                          : someSelected
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Users className="w-3 h-3" />
                      {cohort}
                      <span className="opacity-70">({cohortIds.length}人)</span>
                    </button>
                  );
                })}
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={selectAll} className="text-xs text-primary hover:text-primary/80 font-medium">全选</button>
                  <span className="text-muted-foreground/40">|</span>
                  <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground font-medium">清空</button>
                </div>
              </div>
            )}

            <div className="relative mt-2">
              <button onClick={() => setShowTraineeDropdown(!showTraineeDropdown)} className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[38px]">
                <div className="flex flex-wrap gap-1 flex-1">
                  {selectedTraineeNames.length === 0 ? (
                    <span className="text-muted-foreground">选择新人...</span>
                  ) : (
                    selectedTraineeNames.map(name => (
                      <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-primary/10 text-primary font-medium">{name}</span>
                    ))
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
              </button>
              {showTraineeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-md border border-border shadow-float z-10">
                  {/* 搜索框 */}
                  <div className="p-2 border-b border-border/30">
                    <input
                      type="text"
                      value={traineeSearch}
                      onChange={e => setTraineeSearch(e.target.value)}
                      placeholder="搜索新人姓名..."
                      className="w-full px-2.5 py-1.5 rounded-md bg-muted border-none text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {trainees
                      .filter(t => !traineeSearch || t.name.includes(traineeSearch))
                      .map(trainee => {
                      const isSelected = form.traineeIds.includes(trainee.id);
                      return (
                        <button key={trainee.id} onClick={() => toggleTrainee(trainee.id)} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2 ${isSelected ? 'bg-primary/5' : ''}`}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                            {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <span className={isSelected ? 'text-primary font-medium' : 'text-foreground'}>{trainee.name}</span>
                          {trainee.cohort && <span className="text-xs text-muted-foreground ml-auto">{trainee.cohort}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {form.traineeIds.length > 0 && <p className="text-xs text-muted-foreground mt-1">已选择 {form.traineeIds.length} 位新人</p>}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="input-due-date">截止日期</label>
            <input
              id="input-due-date"
              type="date"
              value={form.dueDate}
              onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full mt-1.5 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              取消
            </button>
            <button onClick={handlePublish} disabled={saving} className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-all inline-flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? '发布中...' : '发布考核'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Scoring Dialog ===

function ScoringDialog({
  record,
  onClose,
  onSaved,
}: {
  record: AssessmentRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<ScoreDimension>(record.scores);
  const [comment, setComment] = useState(record.comment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dimensions = Object.keys(SCORE_DIMENSION_LABELS);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/assessment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          scores,
          comment,
          status: 'completed',
        }),
      });

      if (res.ok) {
        onSaved();
      } else {
        setError('保存失败');
      }
    } catch {
      setError('保存失败，请重试');
    }
    setSaving(false);
  }

  const currentAvg = Object.values(scores).filter((v): v is number => v !== undefined && v > 0);
  const avgScore = currentAvg.length > 0 ? Math.round(currentAvg.reduce((s, v) => s + v, 0) / currentAvg.length) : 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">考核评分</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm font-medium text-foreground">{record.assessmentTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">被考核人：{record.traineeName}</p>
          </div>

          {dimensions.map(dim => (
            <div key={dim}>
              <label className="text-sm font-medium text-foreground">{SCORE_DIMENSION_LABELS[dim]}</label>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={scores[dim] ?? 0}
                  onChange={e => setScores(prev => ({ ...prev, [dim]: Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className={`text-sm font-bold w-10 text-right ${getOverallColor(scores[dim] ?? 0)}`}>
                  {scores[dim] ?? 0}
                </span>
              </div>
            </div>
          ))}

          <div className="text-center py-2 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">综合评分</p>
            <p className={`text-3xl font-bold ${getOverallColor(avgScore)}`}>{avgScore}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">评语</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={3}
              placeholder="输入评语..."
            />
          </div>

          {error && (
            <div className="bg-destructive/5 border border-destructive/15 rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-all inline-flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? '保存中...' : '提交评分'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
