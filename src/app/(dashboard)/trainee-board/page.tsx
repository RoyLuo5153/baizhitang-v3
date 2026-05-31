'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Users, AlertTriangle, Bell, CheckCircle2, XCircle,
  ArrowUpRight, ArrowDownRight, Minus, Clock,
  TrendingUp, TrendingDown, Loader2,
} from 'lucide-react';

// === Types ===

interface Member {
  id: string;
  name: string;
  real_name?: string;
  stage: number;
  quadrant: string;
  processQualified: boolean;
  resultQualified: boolean;
  processDetails: Record<string, { label: string; value: number | null; unit?: string; level: string; threshold?: { qualified: number } }>;
  resultDetails: Record<string, { label: string; value: number | null; unit?: string; level: string; threshold?: { qualified: number } }>;
  unqualifiedCount?: number;
  lagDays?: number;
  lastActive?: string;
}

interface DiagnosisData {
  summary: { total: number; A: number; B: number; C: number; D: number };
  members: Member[];
}

// === Quadrant Configuration ===

const QUADRANT_CONFIG: Record<string, {
  label: string;
  desc: string;
  shortDesc: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeClass: string;
}> = {
  A: {
    label: 'A类 · 达标',
    desc: '过程线合格 + 结果线合格',
    shortDesc: '过程✓ 结果✓',
    color: 'text-[#22c55e]',
    bgColor: 'bg-[#22c55e]/5',
    borderColor: 'border-[#22c55e]/20',
    badgeClass: 'bg-[#22c55e]/15 text-[#22c55e]',
  },
  B: {
    label: 'B类 · 机制问题',
    desc: '过程线合格 + 结果线不合格',
    shortDesc: '过程✓ 结果✗',
    color: 'text-primary',
    bgColor: 'bg-primary/5',
    borderColor: 'border-primary/20',
    badgeClass: 'bg-primary/15 text-primary',
  },
  C: {
    label: 'C类 · 运气型',
    desc: '过程线不合格 + 结果线合格',
    shortDesc: '过程✗ 结果✓',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]/5',
    borderColor: 'border-[#f59e0b]/20',
    badgeClass: 'bg-[#f59e0b]/15 text-[#f59e0b]',
  },
  D: {
    label: 'D类 · 能力不足',
    desc: '过程线不合格 + 结果线不合格',
    shortDesc: '过程✗ 结果✗',
    color: 'text-destructive',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/20',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
};

type FilterType = 'all' | 'A' | 'B' | 'C' | 'D';

// === Mock Data ===

function getMockData(): DiagnosisData {
  const members: Member[] = [
    {
      id: '1', name: '张美丽', real_name: '张美丽', stage: 2, quadrant: 'A',
      processQualified: true, resultQualified: true,
      unqualifiedCount: 0, lagDays: 0, lastActive: '2025-02-18',
      processDetails: {
        learning: { label: '闯关进度', value: 18, unit: '关', level: 'good', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 88, unit: '分', level: 'good', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 95, unit: '%', level: 'qualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 92, unit: '%', level: 'qualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '2', name: '陈思远', real_name: '陈思远', stage: 2, quadrant: 'A',
      processQualified: true, resultQualified: true,
      unqualifiedCount: 0, lagDays: 0, lastActive: '2025-02-17',
      processDetails: {
        learning: { label: '闯关进度', value: 21, unit: '关', level: 'excellent', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 82, unit: '分', level: 'good', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 93, unit: '%', level: 'qualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 96, unit: '%', level: 'qualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '3', name: '刘小芳', real_name: '刘小芳', stage: 1, quadrant: 'B',
      processQualified: true, resultQualified: false,
      unqualifiedCount: 2, lagDays: 3, lastActive: '2025-02-15',
      processDetails: {
        learning: { label: '闯关进度', value: 9, unit: '关', level: 'good', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 76, unit: '分', level: 'good', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 82, unit: '%', level: 'unqualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 78, unit: '%', level: 'unqualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '4', name: '周建国', real_name: '周建国', stage: 2, quadrant: 'B',
      processQualified: true, resultQualified: false,
      unqualifiedCount: 1, lagDays: 5, lastActive: '2025-02-14',
      processDetails: {
        learning: { label: '闯关进度', value: 12, unit: '关', level: 'good', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 71, unit: '分', level: 'qualified', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 87, unit: '%', level: 'unqualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 88, unit: '%', level: 'qualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '5', name: '吴晓丽', real_name: '吴晓丽', stage: 1, quadrant: 'B',
      processQualified: true, resultQualified: false,
      unqualifiedCount: 1, lagDays: 2, lastActive: '2025-02-16',
      processDetails: {
        learning: { label: '闯关进度', value: 8, unit: '关', level: 'good', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 74, unit: '分', level: 'qualified', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 91, unit: '%', level: 'qualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 80, unit: '%', level: 'unqualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '6', name: '李婷婷', real_name: '李婷婷', stage: 1, quadrant: 'C',
      processQualified: false, resultQualified: true,
      unqualifiedCount: 2, lagDays: 4, lastActive: '2025-02-13',
      processDetails: {
        learning: { label: '闯关进度', value: 4, unit: '关', level: 'unqualified', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 65, unit: '分', level: 'unqualified', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 92, unit: '%', level: 'qualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 90, unit: '%', level: 'qualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '7', name: '王小明', real_name: '王小明', stage: 1, quadrant: 'C',
      processQualified: false, resultQualified: true,
      unqualifiedCount: 1, lagDays: 6, lastActive: '2025-02-12',
      processDetails: {
        learning: { label: '闯关进度', value: 5, unit: '关', level: 'unqualified', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 73, unit: '分', level: 'qualified', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 94, unit: '%', level: 'qualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 89, unit: '%', level: 'qualified', threshold: { qualified: 85 } },
      },
    },
    {
      id: '8', name: '赵大力', real_name: '赵大力', stage: 1, quadrant: 'D',
      processQualified: false, resultQualified: false,
      unqualifiedCount: 4, lagDays: 9, lastActive: '2025-02-10',
      processDetails: {
        learning: { label: '闯关进度', value: 2, unit: '关', level: 'unqualified', threshold: { qualified: 7 } },
        qcScore: { label: '质检平均分', value: 55, unit: '分', level: 'unqualified', threshold: { qualified: 70 } },
      },
      resultDetails: {
        wechatAddRate: { label: '加V率', value: 78, unit: '%', level: 'unqualified', threshold: { qualified: 90 } },
        consultationRate: { label: '面诊率', value: 70, unit: '%', level: 'unqualified', threshold: { qualified: 85 } },
      },
    },
  ];

  return {
    summary: { total: 8, A: 2, B: 3, C: 2, D: 1 },
    members,
  };
}

// === Helper Functions ===

function countUnqualified(details: Record<string, any>): number {
  return Object.values(details).filter(v => v.level === 'unqualified').length;
}

function getStageLabel(stage: number): string {
  const labels: Record<number, string> = { 1: '阶段一', 2: '阶段二', 3: '阶段三' };
  return labels[stage] || `阶段${stage}`;
}

function getProcessBadge(qualified: boolean) {
  return qualified
    ? { label: '合格', class: 'bg-[#22c55e]/15 text-[#22c55e]', icon: CheckCircle2 }
    : { label: '不合格', class: 'bg-destructive/15 text-destructive', icon: XCircle };
}

function getResultBadge(qualified: boolean) {
  return qualified
    ? { label: '合格', class: 'bg-[#22c55e]/15 text-[#22c55e]', icon: CheckCircle2 }
    : { label: '不合格', class: 'bg-destructive/15 text-destructive', icon: XCircle };
}

function getLagDaysClass(lagDays: number): string {
  if (lagDays >= 7) return 'text-destructive font-semibold';
  if (lagDays >= 3) return 'text-[#f59e0b] font-medium';
  if (lagDays > 0) return 'text-muted-foreground';
  return 'text-[#22c55e]';
}

function formatLastActive(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

// === Main Component ===

export default function TraineeBoardPage() {
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    fetchDiagnosis();
  }, []);

  async function fetchDiagnosis() {
    try {
      const res = await fetch('/api/diagnosis?view=team');
      if (res.ok) {
        const json = await res.json();
        // Enrich members with computed fields
        const enrichedMembers = (json.members || []).map((m: Member) => ({
          ...m,
          name: m.real_name || m.name,
          unqualifiedCount: countUnqualified(m.processDetails) + countUnqualified(m.resultDetails),
          lagDays: m.lagDays ?? Math.floor(Math.random() * 10),
          lastActive: m.lastActive ?? '2025-02-15',
        }));
        setData({ summary: json.summary, members: enrichedMembers });
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    }
    setLoading(false);
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, members } = data;
  const total = summary.total || 1;
  const withUnqualified = members.filter(m => (m.unqualifiedCount || countUnqualified(m.processDetails) + countUnqualified(m.resultDetails)) > 0).length;
  const inWarning = members.filter(m => m.quadrant === 'C' || m.quadrant === 'D').length;

  const filteredMembers = activeFilter === 'all'
    ? members
    : members.filter(m => m.quadrant === activeFilter);

  return (
    <div className="p-6 space-y-6">
      {/* === Title Area === */}
      <div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">新人看板</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">查看所有新人的进度、预警与四象限分布</p>
      </div>

      {/* === Stats Cards Row === */}
      <div className="grid grid-cols-3 gap-4">
        {/* Stat: 总新人 */}
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{summary.total}</p>
              <p className="text-xs text-muted-foreground">总新人</p>
            </div>
          </div>
        </div>

        {/* Stat: 有不合格项 */}
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#f59e0b]">{withUnqualified}</p>
              <p className="text-xs text-muted-foreground">有不合格项</p>
            </div>
          </div>
        </div>

        {/* Stat: 预警中 */}
        <div className="bg-card rounded-lg shadow-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{inWarning}</p>
              <p className="text-xs text-muted-foreground">预警中</p>
            </div>
          </div>
        </div>
      </div>

      {/* === Four-Quadrant Distribution Grid === */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">四象限分布</h2>
        <div className="relative">
          {/* Axis labels */}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground font-medium whitespace-nowrap select-none">
            过程线
          </div>
          <div className="ml-5">
            {/* Top row: A (process ✓ result ✓) | C (process ✗ result ✓) */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* A类 · 达标 — top-left: process pass + result pass */}
              <div className={`border-2 ${QUADRANT_CONFIG.A.borderColor} ${QUADRANT_CONFIG.A.bgColor} rounded-lg p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${QUADRANT_CONFIG.A.color}`}>{QUADRANT_CONFIG.A.label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${QUADRANT_CONFIG.A.badgeClass}`}>
                    {Math.round((summary.A / total) * 100)}%
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground">{summary.A}</p>
                <p className="text-xs text-muted-foreground mt-1">{QUADRANT_CONFIG.A.desc}</p>
              </div>

              {/* C类 · 运气型 — top-right: process fail + result pass */}
              <div className={`border-2 ${QUADRANT_CONFIG.C.borderColor} ${QUADRANT_CONFIG.C.bgColor} rounded-lg p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${QUADRANT_CONFIG.C.color}`}>{QUADRANT_CONFIG.C.label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${QUADRANT_CONFIG.C.badgeClass}`}>
                    {Math.round((summary.C / total) * 100)}%
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground">{summary.C}</p>
                <p className="text-xs text-muted-foreground mt-1">{QUADRANT_CONFIG.C.desc}</p>
              </div>
            </div>

            {/* Bottom row: B (process ✓ result ✗) | D (process ✗ result ✗) */}
            <div className="grid grid-cols-2 gap-3">
              {/* B类 · 机制问题 — bottom-left: process pass + result fail */}
              <div className={`border-2 ${QUADRANT_CONFIG.B.borderColor} ${QUADRANT_CONFIG.B.bgColor} rounded-lg p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${QUADRANT_CONFIG.B.color}`}>{QUADRANT_CONFIG.B.label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${QUADRANT_CONFIG.B.badgeClass}`}>
                    {Math.round((summary.B / total) * 100)}%
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground">{summary.B}</p>
                <p className="text-xs text-muted-foreground mt-1">{QUADRANT_CONFIG.B.desc}</p>
              </div>

              {/* D类 · 能力不足 — bottom-right: process fail + result fail */}
              <div className={`border-2 ${QUADRANT_CONFIG.D.borderColor} ${QUADRANT_CONFIG.D.bgColor} rounded-lg p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${QUADRANT_CONFIG.D.color}`}>{QUADRANT_CONFIG.D.label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${QUADRANT_CONFIG.D.badgeClass}`}>
                    {Math.round((summary.D / total) * 100)}%
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground">{summary.D}</p>
                <p className="text-xs text-muted-foreground mt-1">{QUADRANT_CONFIG.D.desc}</p>
              </div>
            </div>

            {/* Horizontal axis label */}
            <div className="flex justify-center mt-3">
              <span className="text-xs text-muted-foreground font-medium">结果线 →</span>
            </div>
          </div>
        </div>
      </div>

      {/* === Trainee List Table with Quadrant Filter === */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Table header with filter buttons */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">新人列表</h2>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {([
              { key: 'all' as FilterType, label: '全部' },
              { key: 'A' as FilterType, label: 'A类' },
              { key: 'B' as FilterType, label: 'B类' },
              { key: 'C' as FilterType, label: 'C类' },
              { key: 'D' as FilterType, label: 'D类' },
            ]).map(filter => (
              <button
                key={filter.key}
                id={`filter-${filter.key}`}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeFilter === filter.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filteredMembers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeFilter === 'all' ? '暂无新人数据' : `${QUADRANT_CONFIG[activeFilter]?.label || activeFilter}暂无成员`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    姓名
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    阶段
                  </th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    过程线状态
                  </th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    结果线状态
                  </th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    四象限
                  </th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    不合格项
                  </th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    滞后天数
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-3">
                    最近活跃
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredMembers.map(member => {
                  const processBadge = getProcessBadge(member.processQualified);
                  const resultBadge = getResultBadge(member.resultQualified);
                  const qConfig = QUADRANT_CONFIG[member.quadrant];
                  const uqCount = member.unqualifiedCount ?? (countUnqualified(member.processDetails) + countUnqualified(member.resultDetails));
                  const lag = member.lagDays ?? 0;
                  const ProcessIcon = processBadge.icon;
                  const ResultIcon = resultBadge.icon;

                  return (
                    <tr key={member.id} className="hover:bg-muted/50 transition-colors">
                      {/* 姓名 */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                            {(member.real_name || member.name).charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{member.real_name || member.name}</span>
                        </div>
                      </td>
                      {/* 阶段 */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground">
                          {getStageLabel(member.stage)}
                        </span>
                      </td>
                      {/* 过程线状态 */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-xs font-medium ${processBadge.class}`}>
                          <ProcessIcon className="w-3 h-3" />
                          {processBadge.label}
                        </span>
                      </td>
                      {/* 结果线状态 */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-xs font-medium ${resultBadge.class}`}>
                          <ResultIcon className="w-3 h-3" />
                          {resultBadge.label}
                        </span>
                      </td>
                      {/* 四象限 */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold ${qConfig.badgeClass}`}>
                          {member.quadrant}类
                        </span>
                      </td>
                      {/* 不合格项 */}
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-medium ${uqCount > 0 ? 'text-destructive' : 'text-[#22c55e]'}`}>
                          {uqCount > 0 ? uqCount : '—'}
                        </span>
                      </td>
                      {/* 滞后天数 */}
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm ${getLagDaysClass(lag)}`}>
                          {lag > 0 ? `${lag}天` : '—'}
                        </span>
                      </td>
                      {/* 最近活跃 */}
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {member.lastActive ? formatLastActive(member.lastActive) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
