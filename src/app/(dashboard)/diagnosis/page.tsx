'use client';

import { useEffect, useState } from 'react';
import {
  ScanSearch, Users, AlertTriangle, CheckCircle2, TrendingDown,
  ChevronRight, Activity, Target, Route as RouteIcon, User,
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
  role: string;
  stage: number;
  quadrant: string;
  processQualified: boolean;
  resultQualified: boolean;
  processDetails: Record<string, any>;
  resultDetails: Record<string, any>;
}

interface DiagnosisData {
  summary: { total: number; A: number; B: number; C: number; D: number };
  members: Member[];
}

const QUADRANT_CONFIG: Record<string, {
  label: string; desc: string; color: string; bgColor: string; borderColor: string; icon: any;
}> = {
  A: {
    label: 'A类 · 达标',
    desc: '过程线全合格 + 结果线全合格',
    color: 'text-[#22c55e]',
    bgColor: 'bg-[#22c55e]/5',
    borderColor: 'border-[#22c55e]/30',
    icon: CheckCircle2,
  },
  B: {
    label: 'B类 · 结果待提升',
    desc: '过程线合格 + 结果线有不合格',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]/5',
    borderColor: 'border-[#f59e0b]/30',
    icon: TrendingDown,
  },
  C: {
    label: 'C类 · 过程待提升',
    desc: '过程线有不合格 + 结果线合格',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/30',
    icon: AlertTriangle,
  },
  D: {
    label: 'D类 · 全面待提升',
    desc: '过程线有不合格 + 结果线有不合格',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/30',
    icon: AlertTriangle,
  },
};

export default function DiagnosisPage() {
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    fetchDiagnosis();
  }, []);

  async function fetchDiagnosis() {
    try {
      const res = await fetch('/api/diagnosis?view=team');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, members } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScanSearch className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">双轨诊断</h1>
        <span className="text-sm text-muted-foreground">
          团队共 {summary.total} 人 · 逐项对标四象限分类
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(['A', 'B', 'C', 'D'] as const).map(q => {
          const config = QUADRANT_CONFIG[q];
          const Icon = config.icon;
          return (
            <div
              key={q}
              className={`bg-card rounded-lg shadow-card p-4 border-2 ${config.borderColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${config.color}`} />
                <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{summary[q]}</p>
              <p className="text-xs text-muted-foreground mt-1">{config.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Quadrant Grid with Members */}
      <div className="grid grid-cols-2 gap-6">
        {(['A', 'B', 'C', 'D'] as const).map(q => {
          const config = QUADRANT_CONFIG[q];
          const qMembers = members.filter(m => m.quadrant === q);
          return (
            <div
              key={q}
              className={`bg-card rounded-lg shadow-card border ${config.borderColor} overflow-hidden`}
            >
              <div className={`px-5 py-3 border-b border-border flex items-center gap-2 ${config.bgColor}`}>
                <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                <span className="text-xs text-muted-foreground">{qMembers.length}人</span>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {qMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">暂无成员</p>
                ) : (
                  qMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                        selectedMember?.id === m.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">阶段{m.stage}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Member Detail */}
      {selectedMember && (
        <div className="bg-card rounded-lg shadow-card p-5 border border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {selectedMember.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{selectedMember.name}</h3>
              <span className={`text-xs font-medium ${QUADRANT_CONFIG[selectedMember.quadrant].color}`}>
                {QUADRANT_CONFIG[selectedMember.quadrant].label}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <ProcessLineTable details={selectedMember.processDetails} />
            <ResultLineTable details={selectedMember.resultDetails} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessLineTable({ details }: { details: Record<string, any> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <RouteIcon className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">过程线对标</h4>
        </div>
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  const unqualified = entries.filter(([, v]) => v.level === 'unqualified');

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <RouteIcon className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">过程线对标</h4>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
          <span>评估环节</span>
          <span className="text-center">当前值</span>
          <span className="text-center">合格线</span>
          <span className="text-center">状态</span>
        </div>
        {entries.map(([key, item]) => (
          <div
            key={key}
            className={`grid grid-cols-4 px-3 py-2.5 items-center border-t border-border text-sm ${
              item.level === 'unqualified' ? 'bg-destructive/5' : ''
            }`}
          >
            <span className={item.level === 'unqualified' ? 'text-destructive font-medium' : 'text-foreground'}>
              {item.label}
            </span>
            <span className={`text-center font-semibold ${item.level === 'unqualified' ? 'text-destructive' : 'text-[#22c55e]'}`}>
              {item.value ?? '-'}{item.unit || ''}
            </span>
            <span className="text-center text-muted-foreground">
              {item.threshold?.qualified ?? '-'}
            </span>
            <span className="flex justify-center">
              {item.level === 'unqualified' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-destructive/15 text-destructive">
                  不达标
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#22c55e]/15 text-[#22c55e]">
                  达标
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {unqualified.length > 0 && (
        <div className="mt-2 p-3 bg-destructive/5 rounded-md border-t border-destructive/15">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">不合格项诊断</p>
              {unqualified.map(([key, item]) => (
                <p key={key} className="text-xs text-muted-foreground">
                  {item.label} {item.value}{item.unit} &lt; {item.threshold?.qualified} → 需针对性训练
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultLineTable({ details }: { details: Record<string, any> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">结果线对标</h4>
        </div>
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  const unqualified = entries.filter(([, v]) => v.level === 'unqualified');

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">结果线对标</h4>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
          <span>业务指标</span>
          <span className="text-center">当前值</span>
          <span className="text-center">合格线</span>
          <span className="text-center">状态</span>
        </div>
        {entries.map(([key, item]) => (
          <div
            key={key}
            className={`grid grid-cols-4 px-3 py-2.5 items-center border-t border-border text-sm ${
              item.level === 'unqualified' ? 'bg-destructive/5' : ''
            }`}
          >
            <span className={item.level === 'unqualified' ? 'text-destructive font-medium' : 'text-foreground'}>
              {item.label}
            </span>
            <span className={`text-center font-semibold ${item.level === 'unqualified' ? 'text-destructive' : 'text-[#22c55e]'}`}>
              {item.value !== null ? `${item.value}${item.unit || ''}` : '-'}
            </span>
            <span className="text-center text-muted-foreground">
              {item.threshold?.qualified ?? '-'}%
            </span>
            <span className="flex justify-center">
              {item.level === 'unqualified' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-destructive/15 text-destructive">
                  不达标
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#22c55e]/15 text-[#22c55e]">
                  达标
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {unqualified.length > 0 && (
        <div className="mt-2 p-3 bg-destructive/5 rounded-md border-t border-destructive/15">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">不合格项诊断</p>
              {unqualified.map(([key, item]) => (
                <p key={key} className="text-xs text-muted-foreground">
                  {item.label} {item.value}{item.unit} &lt; {item.threshold?.qualified}% → 需针对性赋能
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getMockData(): DiagnosisData {
  return {
    summary: { total: 8, A: 2, B: 3, C: 2, D: 1 },
    members: [
      {
        id: '1', name: '张三', role: 'trainee', stage: 2, quadrant: 'A',
        processQualified: true, resultQualified: true,
        processDetails: {
          learning: { label: '闯关进度', value: 14, unit: '关', threshold: { qualified: 7, good: 14, excellent: 21 }, level: 'good' },
          qcScore: { label: '质检平均分', value: 85, unit: '分', threshold: { qualified: 70, good: 80, excellent: 90 }, level: 'good' },
        },
        resultDetails: {
          wechatAddRate: { label: '加V率', value: 92, unit: '%', threshold: { qualified: 90 }, level: 'qualified' },
          consultationRate: { label: '面诊率', value: 95, unit: '%', threshold: { qualified: 85 }, level: 'qualified' },
        },
      },
      {
        id: '2', name: '李四', role: 'trainee', stage: 1, quadrant: 'D',
        processQualified: false, resultQualified: false,
        processDetails: {
          learning: { label: '闯关进度', value: 3, unit: '关', threshold: { qualified: 7, good: 14, excellent: 21 }, level: 'unqualified' },
          qcScore: { label: '质检平均分', value: 55, unit: '分', threshold: { qualified: 70, good: 80, excellent: 90 }, level: 'unqualified' },
        },
        resultDetails: {
          wechatAddRate: { label: '加V率', value: 78, unit: '%', threshold: { qualified: 90 }, level: 'unqualified' },
          consultationRate: { label: '面诊率', value: 70, unit: '%', threshold: { qualified: 85 }, level: 'unqualified' },
        },
      },
    ],
  };
}
