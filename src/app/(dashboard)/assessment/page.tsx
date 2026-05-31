'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardCheck, Plus, FileText, Clock, CheckCircle2,
  BarChart3, Users, Calendar, ChevronDown, X, Loader2,
  AlertTriangle,
} from 'lucide-react';

// === Types ===

type AssessmentType = 'daily' | 'special' | 'stage';
type RecordStatus = 'completed' | 'in_progress' | 'pending';

interface AssessmentTask {
  id: string;
  title: string;
  type: AssessmentType;
  trainees: string[];
  dueDate: string;
  completionRate: number;
  totalTrainees: number;
  completedTrainees: number;
}

interface ScoreDimension {
  knowledge: number;
  communication: number;
  attitude: number;
  professional: number;
}

interface AssessmentRecord {
  id: string;
  traineeName: string;
  assessmentTitle: string;
  date: string;
  scores: ScoreDimension;
  overallScore: number;
  overallComment: string;
  status: RecordStatus;
}

interface NewAssessmentForm {
  title: string;
  type: AssessmentType;
  traineeIds: string[];
  dueDate: string;
  dimensions: string[];
}

// === Constants ===

const ASSESSMENT_TYPE_CONFIG: Record<AssessmentType, { label: string; badgeClass: string }> = {
  daily: { label: '日常考核', badgeClass: 'bg-primary/15 text-primary' },
  special: { label: '专项考核', badgeClass: 'bg-[#f59e0b]/15 text-[#f59e0b]' },
  stage: { label: '阶段考核', badgeClass: 'bg-destructive/15 text-destructive' },
};

const RECORD_STATUS_CONFIG: Record<RecordStatus, { label: string; badgeClass: string }> = {
  completed: { label: '已完成', badgeClass: 'bg-[#22c55e]/15 text-[#22c55e]' },
  in_progress: { label: '进行中', badgeClass: 'bg-primary/15 text-primary' },
  pending: { label: '待考核', badgeClass: 'bg-[#f59e0b]/15 text-[#f59e0b]' },
};

const SCORE_DIMENSION_LABELS: Record<keyof ScoreDimension, string> = {
  knowledge: '专业知识',
  communication: '沟通表达',
  attitude: '服务态度',
  professional: '专业能力',
};

const AVAILABLE_DIMENSIONS = [
  { key: 'knowledge', label: '专业知识' },
  { key: 'communication', label: '沟通表达' },
  { key: 'attitude', label: '服务态度' },
  { key: 'professional', label: '专业能力' },
];

const AVAILABLE_TRAINEES = [
  { id: '1', name: '王小明' },
  { id: '2', name: '李婷婷' },
  { id: '3', name: '赵大力' },
  { id: '4', name: '刘小芳' },
  { id: '5', name: '陈思远' },
  { id: '6', name: '张美丽' },
  { id: '7', name: '周建国' },
  { id: '8', name: '吴晓丽' },
];

type TabType = 'tasks' | 'records';

// === Mock Data ===

const MOCK_TASKS: AssessmentTask[] = [
  {
    id: 't1',
    title: '新员工入职日常考核 - 第3周',
    type: 'daily',
    trainees: ['王小明', '李婷婷', '赵大力', '刘小芳'],
    dueDate: '2025-02-28',
    completionRate: 75,
    totalTrainees: 4,
    completedTrainees: 3,
  },
  {
    id: 't2',
    title: '加微话术专项考核',
    type: 'special',
    trainees: ['王小明', '陈思远', '张美丽'],
    dueDate: '2025-02-20',
    completionRate: 33,
    totalTrainees: 3,
    completedTrainees: 1,
  },
  {
    id: 't3',
    title: '阶段二综合能力考核',
    type: 'stage',
    trainees: ['赵大力', '刘小芳', '周建国', '吴晓丽', '陈思远'],
    dueDate: '2025-03-15',
    completionRate: 0,
    totalTrainees: 5,
    completedTrainees: 0,
  },
  {
    id: 't4',
    title: '咨询转化流程日常考核',
    type: 'daily',
    trainees: ['李婷婷', '张美丽'],
    dueDate: '2025-02-25',
    completionRate: 100,
    totalTrainees: 2,
    completedTrainees: 2,
  },
  {
    id: 't5',
    title: '用药方案表达专项考核',
    type: 'special',
    trainees: ['周建国', '吴晓丽', '王小明'],
    dueDate: '2025-03-05',
    completionRate: 67,
    totalTrainees: 3,
    completedTrainees: 2,
  },
];

const MOCK_RECORDS: AssessmentRecord[] = [
  {
    id: 'r1',
    traineeName: '王小明',
    assessmentTitle: '新员工入职日常考核 - 第2周',
    date: '2025-02-14',
    scores: { knowledge: 82, communication: 78, attitude: 90, professional: 75 },
    overallScore: 81,
    overallComment: '综合表现良好，沟通表达需加强',
    status: 'completed',
  },
  {
    id: 'r2',
    traineeName: '李婷婷',
    assessmentTitle: '加微话术专项考核',
    date: '2025-02-18',
    scores: { knowledge: 70, communication: 85, attitude: 88, professional: 72 },
    overallScore: 79,
    overallComment: '沟通能力突出，专业知识需巩固',
    status: 'completed',
  },
  {
    id: 'r3',
    traineeName: '赵大力',
    assessmentTitle: '阶段一综合能力考核',
    date: '2025-02-10',
    scores: { knowledge: 55, communication: 60, attitude: 75, professional: 50 },
    overallScore: 60,
    overallComment: '多项不达标，需重点辅导',
    status: 'completed',
  },
  {
    id: 'r4',
    traineeName: '刘小芳',
    assessmentTitle: '新员工入职日常考核 - 第2周',
    date: '2025-02-20',
    scores: { knowledge: 0, communication: 0, attitude: 0, professional: 0 },
    overallScore: 0,
    overallComment: '',
    status: 'in_progress',
  },
  {
    id: 'r5',
    traineeName: '陈思远',
    assessmentTitle: '阶段二综合能力考核',
    date: '2025-03-15',
    scores: { knowledge: 0, communication: 0, attitude: 0, professional: 0 },
    overallScore: 0,
    overallComment: '',
    status: 'pending',
  },
];

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

// === Main Component ===

export default function AssessmentPage() {
  const [tasks, setTasks] = useState<AssessmentTask[]>([]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, recordsRes] = await Promise.all([
        fetch('/api/assessment?userId=1&view=own'),
        fetch('/api/assessment?view=team'),
      ]);

      let fetchedTasks: AssessmentTask[] = [];
      let fetchedRecords: AssessmentRecord[] = [];

      if (tasksRes.ok) {
        const tasksJson = await tasksRes.json();
        fetchedTasks = transformTasksFromApi(tasksJson.assessments || tasksJson.data || []);
      }

      if (recordsRes.ok) {
        const recordsJson = await recordsRes.json();
        fetchedRecords = transformRecordsFromApi(recordsJson.assessments || recordsJson.data || []);
      }

      // Use API data if available, otherwise fallback to mock
      setTasks(fetchedTasks.length > 0 ? fetchedTasks : MOCK_TASKS);
      setRecords(fetchedRecords.length > 0 ? fetchedRecords : MOCK_RECORDS);
    } catch {
      // Fallback to mock data on any error
      setTasks(MOCK_TASKS);
      setRecords(MOCK_RECORDS);
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
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* === Header === */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">日常考核</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">管理新人考核任务，发布考核并查看考核结果</p>
        </div>
        <button
          id="btn-publish-assessment"
          onClick={() => setShowPublishDialog(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />发布考核
        </button>
      </div>

      {/* === Tab Switcher === */}
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

      {/* === Tab Content === */}
      {activeTab === 'tasks' && (
        <TasksTable tasks={tasks} />
      )}

      {activeTab === 'records' && (
        <RecordsTable records={records} />
      )}

      {/* === Publish Assessment Dialog === */}
      {showPublishDialog && (
        <PublishAssessmentDialog
          onClose={() => setShowPublishDialog(false)}
          onPublished={() => {
            setShowPublishDialog(false);
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
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                任务名称
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                考核类型
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                适用新人
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                截止日期
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3 w-52">
                完成率
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {/* 列表-考核任务1 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{tasks[0].title}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${ASSESSMENT_TYPE_CONFIG[tasks[0].type].badgeClass}`}>
                  {ASSESSMENT_TYPE_CONFIG[tasks[0].type].label}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  {tasks[0].trainees.map(name => (
                    <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                      {name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />{tasks[0].dueDate}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(tasks[0].completionRate)}`}
                      style={{ width: `${tasks[0].completionRate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">
                    {tasks[0].completionRate}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasks[0].completedTrainees}/{tasks[0].totalTrainees} 人已完成
                </p>
              </td>
            </tr>
            {/* 列表-考核任务2 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{tasks[1].title}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${ASSESSMENT_TYPE_CONFIG[tasks[1].type].badgeClass}`}>
                  {ASSESSMENT_TYPE_CONFIG[tasks[1].type].label}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  {tasks[1].trainees.map(name => (
                    <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                      {name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />{tasks[1].dueDate}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(tasks[1].completionRate)}`}
                      style={{ width: `${tasks[1].completionRate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">
                    {tasks[1].completionRate}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasks[1].completedTrainees}/{tasks[1].totalTrainees} 人已完成
                </p>
              </td>
            </tr>
            {/* 列表-考核任务3 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{tasks[2].title}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${ASSESSMENT_TYPE_CONFIG[tasks[2].type].badgeClass}`}>
                  {ASSESSMENT_TYPE_CONFIG[tasks[2].type].label}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  {tasks[2].trainees.map(name => (
                    <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                      {name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />{tasks[2].dueDate}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(tasks[2].completionRate)}`}
                      style={{ width: `${Math.max(tasks[2].completionRate, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">
                    {tasks[2].completionRate}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasks[2].completedTrainees}/{tasks[2].totalTrainees} 人已完成
                </p>
              </td>
            </tr>
            {/* 列表-考核任务4 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{tasks[3].title}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${ASSESSMENT_TYPE_CONFIG[tasks[3].type].badgeClass}`}>
                  {ASSESSMENT_TYPE_CONFIG[tasks[3].type].label}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  {tasks[3].trainees.map(name => (
                    <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                      {name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />{tasks[3].dueDate}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(tasks[3].completionRate)}`}
                      style={{ width: `${tasks[3].completionRate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">
                    {tasks[3].completionRate}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasks[3].completedTrainees}/{tasks[3].totalTrainees} 人已完成
                </p>
              </td>
            </tr>
            {/* 列表-考核任务5 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{tasks[4].title}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${ASSESSMENT_TYPE_CONFIG[tasks[4].type].badgeClass}`}>
                  {ASSESSMENT_TYPE_CONFIG[tasks[4].type].label}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  {tasks[4].trainees.map(name => (
                    <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">
                      {name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />{tasks[4].dueDate}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(tasks[4].completionRate)}`}
                      style={{ width: `${tasks[4].completionRate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">
                    {tasks[4].completionRate}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasks[4].completedTrainees}/{tasks[4].totalTrainees} 人已完成
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Records Table Component ===

function RecordsTable({ records }: { records: AssessmentRecord[] }) {
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
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                被考核人
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                考核名称
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                日期
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                各项评分
              </th>
              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                总评
              </th>
              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                状态
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {/* 列表-考核记录1 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                    {records[0].traineeName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{records[0].traineeName}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-foreground">{records[0].assessmentTitle}</span>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground">{records[0].date}</span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(records[0].scores).map(([key, val]) => (
                    <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${getScoreBadgeClass(val)}`}>
                      {SCORE_DIMENSION_LABELS[key as keyof ScoreDimension]} {val}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`text-lg font-bold ${records[0].overallScore >= 80 ? 'text-[#22c55e]' : records[0].overallScore >= 60 ? 'text-[#f59e0b]' : 'text-destructive'}`}>
                  {records[0].overallScore}
                </span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${RECORD_STATUS_CONFIG[records[0].status].badgeClass}`}>
                  {RECORD_STATUS_CONFIG[records[0].status].label}
                </span>
              </td>
            </tr>
            {/* 列表-考核记录2 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                    {records[1].traineeName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{records[1].traineeName}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-foreground">{records[1].assessmentTitle}</span>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground">{records[1].date}</span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(records[1].scores).map(([key, val]) => (
                    <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${getScoreBadgeClass(val)}`}>
                      {SCORE_DIMENSION_LABELS[key as keyof ScoreDimension]} {val}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`text-lg font-bold ${records[1].overallScore >= 80 ? 'text-[#22c55e]' : records[1].overallScore >= 60 ? 'text-[#f59e0b]' : 'text-destructive'}`}>
                  {records[1].overallScore}
                </span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${RECORD_STATUS_CONFIG[records[1].status].badgeClass}`}>
                  {RECORD_STATUS_CONFIG[records[1].status].label}
                </span>
              </td>
            </tr>
            {/* 列表-考核记录3 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                    {records[2].traineeName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{records[2].traineeName}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-foreground">{records[2].assessmentTitle}</span>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground">{records[2].date}</span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(records[2].scores).map(([key, val]) => (
                    <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${getScoreBadgeClass(val)}`}>
                      {SCORE_DIMENSION_LABELS[key as keyof ScoreDimension]} {val}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`text-lg font-bold ${records[2].overallScore >= 80 ? 'text-[#22c55e]' : records[2].overallScore >= 60 ? 'text-[#f59e0b]' : 'text-destructive'}`}>
                  {records[2].overallScore}
                </span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${RECORD_STATUS_CONFIG[records[2].status].badgeClass}`}>
                  {RECORD_STATUS_CONFIG[records[2].status].label}
                </span>
              </td>
            </tr>
            {/* 列表-考核记录4 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                    {records[3].traineeName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{records[3].traineeName}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-foreground">{records[3].assessmentTitle}</span>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground">{records[3].date}</span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                    考核中...
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 text-center">
                <span className="text-lg font-bold text-muted-foreground">—</span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${RECORD_STATUS_CONFIG[records[3].status].badgeClass}`}>
                  {RECORD_STATUS_CONFIG[records[3].status].label}
                </span>
              </td>
            </tr>
            {/* 列表-考核记录5 */}
            <tr className="hover:bg-muted/50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                    {records[4].traineeName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{records[4].traineeName}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-foreground">{records[4].assessmentTitle}</span>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm text-muted-foreground">{records[4].date}</span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                    待评分
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 text-center">
                <span className="text-lg font-bold text-muted-foreground">—</span>
              </td>
              <td className="px-5 py-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium ${RECORD_STATUS_CONFIG[records[4].status].badgeClass}`}>
                  {RECORD_STATUS_CONFIG[records[4].status].label}
                </span>
              </td>
            </tr>
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
  const [form, setForm] = useState<NewAssessmentForm>({
    title: '',
    type: 'daily',
    traineeIds: [],
    dueDate: '',
    dimensions: ['knowledge', 'communication', 'attitude', 'professional'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTraineeDropdown, setShowTraineeDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  function toggleTrainee(traineeId: string) {
    setForm(prev => ({
      ...prev,
      traineeIds: prev.traineeIds.includes(traineeId)
        ? prev.traineeIds.filter(id => id !== traineeId)
        : [...prev.traineeIds, traineeId],
    }));
  }

  function toggleDimension(key: string) {
    setForm(prev => ({
      ...prev,
      dimensions: prev.dimensions.includes(key)
        ? prev.dimensions.filter(d => d !== key)
        : [...prev.dimensions, key],
    }));
  }

  async function handlePublish() {
    // Validation
    if (!form.title.trim()) {
      setError('请输入考核标题');
      return;
    }
    if (form.traineeIds.length === 0) {
      setError('请选择至少一位新人');
      return;
    }
    if (!form.dueDate) {
      setError('请选择截止日期');
      return;
    }
    if (form.dimensions.length === 0) {
      setError('请选择至少一个评分维度');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Publish for each selected trainee
      const publishPromises = form.traineeIds.map(traineeId =>
        fetch('/api/assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            traineeId,
            type: form.type,
            title: form.title.trim(),
            dueDate: form.dueDate,
            scores: {},
            comment: '',
            dimensions: form.dimensions,
          }),
        })
      );

      const results = await Promise.all(publishPromises);
      const allSuccess = results.every(r => r.ok);

      if (allSuccess) {
        onPublished();
      } else {
        setError('部分考核发布失败，请重试');
      }
    } catch {
      setError('发布失败，请检查网络后重试');
    }
    setSaving(false);
  }

  const selectedTraineeNames = AVAILABLE_TRAINEES
    .filter(t => form.traineeIds.includes(t.id))
    .map(t => t.name);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">发布考核</h2>
          <button
            id="btn-close-dialog"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-destructive/5 border border-destructive/15 rounded-lg px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="input-assessment-title">
              考核标题
            </label>
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
              <button
                id="btn-type-dropdown"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
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
                      onClick={() => {
                        setForm(prev => ({ ...prev, type: key as AssessmentType }));
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2 ${
                        form.type === key ? 'bg-primary/5 text-primary' : 'text-foreground'
                      }`}
                    >
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${config.badgeClass}`}>
                        {config.label}
                      </span>
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
            <div className="relative mt-1.5">
              <button
                id="btn-trainee-dropdown"
                onClick={() => setShowTraineeDropdown(!showTraineeDropdown)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[38px]"
              >
                <div className="flex flex-wrap gap-1 flex-1">
                  {selectedTraineeNames.length === 0 ? (
                    <span className="text-muted-foreground">选择新人...</span>
                  ) : (
                    selectedTraineeNames.map(name => (
                      <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-primary/10 text-primary font-medium">
                        {name}
                      </span>
                    ))
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
              </button>
              {showTraineeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-md border border-border shadow-float z-10 max-h-48 overflow-y-auto">
                  {AVAILABLE_TRAINEES.map(trainee => {
                    const isSelected = form.traineeIds.includes(trainee.id);
                    return (
                      <button
                        key={trainee.id}
                        onClick={() => toggleTrainee(trainee.id)}
                        className={`w-full px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2 ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                          {trainee.name.charAt(0)}
                        </div>
                        <span className={isSelected ? 'text-primary font-medium' : 'text-foreground'}>
                          {trainee.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {form.traineeIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">已选择 {form.traineeIds.length} 位新人</p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="input-due-date">
              截止日期
            </label>
            <input
              id="input-due-date"
              type="date"
              value={form.dueDate}
              onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full mt-1.5 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Scoring Dimensions */}
          <div>
            <label className="text-sm font-medium text-foreground">评分维度</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {AVAILABLE_DIMENSIONS.map(dim => {
                const isSelected = form.dimensions.includes(dim.key);
                return (
                  <button
                    key={dim.key}
                    onClick={() => toggleDimension(dim.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-transparent hover:text-foreground'
                    }`}
                  >
                    {dim.label}
                  </button>
                );
              })}
            </div>
            {form.dimensions.length === 0 && (
              <p className="text-xs text-destructive mt-1">请至少选择一个评分维度</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border/50">
          <button
            id="btn-cancel-publish"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            id="btn-confirm-publish"
            onClick={handlePublish}
            disabled={saving || !form.title.trim() || form.traineeIds.length === 0 || !form.dueDate || form.dimensions.length === 0}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? '发布中...' : '确认发布'}
          </button>
        </div>
      </div>
    </div>
  );
}

// === API Transform Helpers ===

function transformTasksFromApi(apiData: any[]): AssessmentTask[] {
  if (!Array.isArray(apiData)) return [];
  return apiData.map(item => ({
    id: item.id || String(Math.random()),
    title: item.title || '未命名考核',
    type: mapAssessmentType(item.assessment_type || item.type),
    trainees: item.trainees || item.trainee_names || ['未分配'],
    dueDate: item.due_date || item.dueDate || '—',
    completionRate: item.completion_rate ?? item.completionRate ?? 0,
    totalTrainees: item.total_trainees ?? item.totalTrainees ?? 1,
    completedTrainees: item.completed_trainees ?? item.completedTrainees ?? 0,
  }));
}

function transformRecordsFromApi(apiData: any[]): AssessmentRecord[] {
  if (!Array.isArray(apiData)) return [];
  return apiData.map(item => {
    const scores = item.scores || {};
    const knowledge = scores.knowledge ?? 0;
    const communication = scores.communication ?? 0;
    const attitude = scores.attitude ?? scores.service ?? 0;
    const professional = scores.professional ?? 0;
    const allScores = [knowledge, communication, attitude, professional].filter(s => s > 0);
    const overallScore = allScores.length > 0
      ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length)
      : 0;

    return {
      id: item.id || String(Math.random()),
      traineeName: item.trainee_name || item.traineeName || item.users?.real_name || '未知',
      assessmentTitle: item.title || '未命名考核',
      date: item.assessment_date || item.date || '—',
      scores: { knowledge, communication, attitude, professional },
      overallScore,
      overallComment: item.comment || '',
      status: mapRecordStatus(item.status),
    };
  });
}

function mapAssessmentType(type: string): AssessmentType {
  switch (type) {
    case 'daily':
    case '日常考核':
      return 'daily';
    case 'special':
    case '专项考核':
      return 'special';
    case 'stage':
    case '阶段考核':
      return 'stage';
    default:
      return 'daily';
  }
}

function mapRecordStatus(status: string): RecordStatus {
  switch (status) {
    case 'completed':
    case '已完成':
      return 'completed';
    case 'in_progress':
    case '进行中':
      return 'in_progress';
    case 'pending':
    case '待考核':
      return 'pending';
    default:
      return 'pending';
  }
}
