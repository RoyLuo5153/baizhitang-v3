'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Mic, CheckCircle2, XCircle, MessageSquare, Shield,
  Plus, Star, FileText, ChevronDown, ChevronRight,
  Award, TrendingUp, Clock, AlertCircle, Save,
  Phone, Heart, CalendarCheck, Pill, Send,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────

interface QcRecord {
  id: string;
  user_id: string;
  qc_type: string;
  score: number;
  dimension_scores: {
    communication?: number;
    professional?: number;
    service?: number;
    compliance?: number;
  };
  node_scores?: Record<string, number>;
  reviewer_id: string | null;
  notes: string | null;
  audio_url: string | null;
  chat_screenshots: any;
  created_at: string;
}

// ─── WeChat QC Node / Action definitions ───────────────

interface WcAction {
  key: string;
  label: string;
  maxScore: number;
}

interface WcNode {
  key: string;
  label: string;
  icon: any;
  color: string;
  bgLight: string;
  borderColor: string;
  actions: WcAction[];
}

const WECHAT_NODES: WcNode[] = [
  {
    key: 'add_wechat',
    label: '加V沟通',
    icon: Phone,
    color: 'text-[#3b82f6]',
    bgLight: 'bg-[#3b82f6]/8',
    borderColor: 'border-[#3b82f6]/25',
    actions: [
      { key: 'self_intro', label: '自我介绍', maxScore: 5 },
      { key: 'identify_role', label: '表明身份', maxScore: 5 },
      { key: 'state_purpose', label: '说明目的', maxScore: 5 },
      { key: 'care_icebreak', label: '关怀破冰', maxScore: 5 },
      { key: 'script_compliance', label: '话术规范', maxScore: 5 },
    ],
  },
  {
    key: 'medication_care',
    label: '用药关怀',
    icon: Heart,
    color: 'text-[#ef4444]',
    bgLight: 'bg-[#ef4444]/8',
    borderColor: 'border-[#ef4444]/25',
    actions: [
      { key: 'med_reminder', label: '用药提醒', maxScore: 5 },
      { key: 'side_effects', label: '不良反应询问', maxScore: 5 },
      { key: 'diet_advice', label: '饮食建议', maxScore: 5 },
      { key: 'exercise_advice', label: '运动建议', maxScore: 5 },
      { key: 'emotional_care', label: '情感关怀', maxScore: 5 },
    ],
  },
  {
    key: 'followup_invite',
    label: '复诊邀约',
    icon: CalendarCheck,
    color: 'text-[#22c55e]',
    bgLight: 'bg-[#22c55e]/8',
    borderColor: 'border-[#22c55e]/25',
    actions: [
      { key: 'followup_reminder', label: '复诊提醒', maxScore: 5 },
      { key: 'time_confirm', label: '时间确认', maxScore: 5 },
      { key: 'notice_given', label: '须知告知', maxScore: 5 },
      { key: 'arrival_confirm', label: '到诊确认', maxScore: 5 },
      { key: 'noshow_followup', label: '未到跟进', maxScore: 5 },
    ],
  },
  {
    key: 'prescription_renewal',
    label: '续方确认',
    icon: Pill,
    color: 'text-[#f59e0b]',
    bgLight: 'bg-[#f59e0b]/8',
    borderColor: 'border-[#f59e0b]/25',
    actions: [
      { key: 'med_evaluation', label: '用药评估', maxScore: 5 },
      { key: 'plan_confirm', label: '方案确认', maxScore: 5 },
      { key: 'renewal_guide', label: '续方引导', maxScore: 5 },
      { key: 'exception_handle', label: '异常处理', maxScore: 5 },
    ],
  },
];

// ─── Constants ─────────────────────────────────────────

const QC_TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  recording: { label: '录音质检', icon: Mic },
  wechat: { label: '微信质检', icon: MessageSquare },
  daily: { label: '日常考核', icon: FileText },
};

const DIMENSION_LABELS: Record<string, string> = {
  communication: '沟通表达',
  professional: '专业能力',
  service: '服务态度',
  compliance: '合规规范',
};

const WECHAT_NODE_LABELS: Record<string, string> = {
  add_wechat: '加V沟通',
  medication_care: '用药关怀',
  followup_invite: '复诊邀约',
  prescription_renewal: '续方确认',
};

// ─── Score Button Component ────────────────────────────

function ScoreSelector({
  value,
  maxScore,
  onChange,
  size = 'md',
}: {
  value: number;
  maxScore: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}) {
  const btnClass = size === 'sm'
    ? 'w-7 h-7 text-xs'
    : 'w-8 h-8 text-sm';

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxScore + 1 }, (_, i) => {
        const isActive = value === i;
        const colorClass = i === 0
          ? 'text-muted-foreground'
          : i <= Math.ceil(maxScore * 0.4)
            ? 'text-[#ef4444]'
            : i <= Math.ceil(maxScore * 0.7)
              ? 'text-[#f59e0b]'
              : 'text-[#22c55e]';
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`${btnClass} rounded-md font-semibold transition-all ${
              isActive
                ? `bg-primary/15 ${colorClass} ring-1 ring-primary/30`
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}

// ─── Recording QC Dimension Row ────────────────────────

function RecordingDimensionRow({
  label,
  score,
  maxScore,
  onChange,
}: {
  label: string;
  score: number;
  maxScore: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-b-0">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <ScoreSelector value={score} maxScore={maxScore} onChange={onChange} size="md" />
        <span className="text-xs text-muted-foreground w-10 text-right">{score}/{maxScore}</span>
      </div>
    </div>
  );
}

// ─── WeChat Node Section ───────────────────────────────

function WeChatNodeSection({
  node,
  scores,
  onScoreChange,
  expanded,
  onToggle,
}: {
  node: WcNode;
  scores: Record<string, number>;
  onScoreChange: (actionKey: string, value: number) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = node.icon;
  const nodeTotal = node.actions.reduce((sum, a) => sum + (scores[a.key] || 0), 0);
  const nodeMax = node.actions.reduce((sum, a) => sum + a.maxScore, 0);
  const pct = nodeMax > 0 ? Math.round((nodeTotal / nodeMax) * 100) : 0;

  return (
    <div className={`rounded-lg border ${node.borderColor} overflow-hidden transition-all`}>
      {/* Node Header */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 ${node.bgLight} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4.5 h-4.5 ${node.color}`} />
          <span className="text-sm font-semibold text-foreground">{node.label}</span>
          <span className={`text-xs font-bold ${node.color}`}>
            {nodeTotal}/{nodeMax}分
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini progress bar */}
          <div className="w-20 h-1.5 bg-black/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Node Actions */}
      {expanded && (
        <div className="px-4 py-2 bg-card">
          {node.actions.map((action, idx) => (
            <div
              key={action.key}
              className={`flex items-center justify-between py-2.5 ${
                idx < node.actions.length - 1 ? 'border-b border-border/30' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="text-sm text-foreground">{action.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <ScoreSelector
                  value={scores[action.key] || 0}
                  maxScore={action.maxScore}
                  onChange={(v) => onScoreChange(action.key, v)}
                  size="sm"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">
                  {scores[action.key] || 0}/{action.maxScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Past QC Record Card ───────────────────────────────

function PastQcCard({ record }: { record: QcRecord }) {
  const typeConfig = QC_TYPE_LABELS[record.qc_type] || QC_TYPE_LABELS.recording;
  const TypeIcon = typeConfig.icon;
  const passed = record.score >= 70;

  return (
    <div className="bg-card rounded-lg shadow-card p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          passed ? 'bg-[#22c55e]/10' : 'bg-destructive/10'
        }`}>
          <TypeIcon className={`w-4.5 h-4.5 ${passed ? 'text-[#22c55e]' : 'text-destructive'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">{typeConfig.label}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
              passed ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-destructive/15 text-destructive'
            }`}>
              {passed ? '达标' : '不达标'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(record.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={`font-bold text-lg ${passed ? 'text-[#22c55e]' : 'text-destructive'}`}>
              {record.score}<span className="text-xs font-normal text-muted-foreground ml-0.5">分</span>
            </span>
            {/* Show dimension or node scores */}
            {record.qc_type === 'wechat' && record.node_scores ? (
              Object.entries(record.node_scores).map(([key, val]) => (
                <span key={key} className="text-muted-foreground text-xs">
                  {WECHAT_NODE_LABELS[key] || key}: <span className={val >= 70 ? 'text-foreground' : 'text-destructive'}>{val}</span>
                </span>
              ))
            ) : (
              record.dimension_scores && Object.entries(record.dimension_scores).map(([key, val]) => (
                <span key={key} className="text-muted-foreground text-xs">
                  {DIMENSION_LABELS[key] || key}: <span className={(val ?? 0) >= 70 ? 'text-foreground' : 'text-destructive'}>{val}</span>
                </span>
              ))
            )}
          </div>
          {record.notes && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{record.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────

export default function QcReviewPage() {
  const [records, setRecords] = useState<QcRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    try {
      const res = await fetch('/api/qc');
      if (res.ok) {
        const json = await res.json();
        setRecords(json.data || []);
      }
    } catch {
      // empty
    }
    setLoading(false);
  }

  const filteredRecords = filterType === 'all'
    ? records
    : records.filter(r => r.qc_type === filterType);

  const avgScore = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length)
    : 0;
  const passCount = records.filter(r => r.score >= 70).length;
  const failCount = records.filter(r => r.score < 70).length;
  const wechatCount = records.filter(r => r.qc_type === 'wechat').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">质检审核</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">录音质检 · 微信质检4节点19动作评分 · 日常考核管理与审核</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />新建质检
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">质检总数</p>
          <p className="text-2xl font-bold text-foreground">{records.length}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">平均分</p>
          <p className={`text-2xl font-bold ${avgScore >= 70 ? 'text-[#22c55e]' : 'text-destructive'}`}>{avgScore}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">达标数</p>
          <p className="text-2xl font-bold text-[#22c55e]">{passCount}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">不达标数</p>
          <p className="text-2xl font-bold text-destructive">{failCount}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">微信质检</p>
            <MessageSquare className="w-3.5 h-3.5 text-primary/60" />
          </div>
          <p className="text-2xl font-bold text-primary">{wechatCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {['all', 'recording', 'wechat', 'daily'].map(type => {
          const config = type === 'all'
            ? { label: '全部', icon: Shield }
            : QC_TYPE_LABELS[type];
          const Icon = config.icon;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                filterType === type
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{config.label}
            </button>
          );
        })}
      </div>

      {/* Past QC Records */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">历史质检记录</h2>
          <span className="text-xs text-muted-foreground">({filteredRecords.length}条)</span>
        </div>
        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="bg-card rounded-lg shadow-card p-12 text-center">
              <Mic className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无质检记录</p>
            </div>
          ) : (
            filteredRecords.map(record => (
              <PastQcCard key={record.id} record={record} />
            ))
          )}
        </div>
      </div>

      {/* New QC Form Dialog */}
      {showForm && (
        <QcFormDialog onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchRecords(); }} />
      )}
    </div>
  );
}

// ─── QC Form Dialog ────────────────────────────────────

function QcFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // Tab: recording | wechat
  const [activeTab, setActiveTab] = useState<'recording' | 'wechat'>('recording');

  // Recording QC scores (0-25 each dimension)
  const [recScores, setRecScores] = useState<Record<string, number>>({
    communication: 0,
    professional: 0,
    service: 0,
    compliance: 0,
  });

  // WeChat QC scores (0-5 each action)
  const [wcScores, setWcScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    WECHAT_NODES.forEach(node => {
      node.actions.forEach(action => {
        init[action.key] = 0;
      });
    });
    return init;
  });

  // Expand/collapse state for WeChat nodes
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    add_wechat: true,
    medication_care: true,
    followup_invite: false,
    prescription_renewal: false,
  });

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Calculated totals ──

  const recTotal = Object.values(recScores).reduce((sum, v) => sum + v, 0);
  const recMax = 100; // 4 dimensions × 25 each
  const recPct = recMax > 0 ? Math.round((recTotal / recMax) * 100) : 0;

  const wcTotal = Object.values(wcScores).reduce((sum, v) => sum + v, 0);
  const wcMax = WECHAT_NODES.reduce((sum, n) => sum + n.actions.reduce((s, a) => s + a.maxScore, 0), 0);
  const wcPct = wcMax > 0 ? Math.round((wcTotal / wcMax) * 100) : 0;

  // Per-node totals
  const nodeTotals = WECHAT_NODES.map(node => {
    const total = node.actions.reduce((sum, a) => sum + (wcScores[a.key] || 0), 0);
    const max = node.actions.reduce((sum, a) => sum + a.maxScore, 0);
    return { key: node.key, total, max, pct: max > 0 ? Math.round((total / max) * 100) : 0 };
  });

  // Overall score for submission
  const overallScore = activeTab === 'recording' ? recPct : wcPct;

  // ── Handlers ──

  const handleRecScoreChange = useCallback((key: string, value: number) => {
    setRecScores(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleWcScoreChange = useCallback((actionKey: string, value: number) => {
    setWcScores(prev => ({ ...prev, [actionKey]: value }));
  }, []);

  const toggleNode = useCallback((nodeKey: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: any = {
        userId: '1',
        qcType: activeTab,
        score: overallScore,
        notes,
      };

      if (activeTab === 'recording') {
        // Convert 0-25 per dimension to 0-100 percentage for storage
        body.dimensionScores = {
          communication: Math.round((recScores.communication / 25) * 100),
          professional: Math.round((recScores.professional / 25) * 100),
          service: Math.round((recScores.service / 25) * 100),
          compliance: Math.round((recScores.compliance / 25) * 100),
        };
      } else {
        // WeChat: store per-node percentages
        const nodeScores: Record<string, number> = {};
        nodeTotals.forEach(nt => {
          nodeScores[nt.key] = nt.pct;
        });
        body.dimensionScores = {
          communication: 0,
          professional: 0,
          service: 0,
          compliance: 0,
        };
        body.nodeScores = nodeScores;
      }

      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) onSaved();
    } catch {
      // ignore
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-8 overflow-y-auto pb-8">
      <div className="bg-card rounded-xl shadow-dialog w-full max-w-2xl my-auto">
        {/* Dialog Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">新建质检评分</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('recording')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all inline-flex items-center gap-2 ${
                activeTab === 'recording'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mic className="w-4 h-4" />录音质检
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wechat')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all inline-flex items-center gap-2 ${
                activeTab === 'wechat'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-4 h-4" />微信质检
            </button>
          </div>
        </div>

        {/* Scoring Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'recording' ? (
            /* ── Recording QC: 4 Dimensions ── */
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">录音质检 · 四维度评分</span>
                </div>
                <p className="text-xs text-muted-foreground">每个维度0-25分，总分100分，70分达标</p>
              </div>

              <div className="bg-card rounded-lg border border-border/60 p-4">
                {[
                  { key: 'communication', label: '沟通表达', desc: '语言表达清晰度、逻辑性、亲和力' },
                  { key: 'professional', label: '专业能力', desc: '医学知识准确性、方案合理性' },
                  { key: 'service', label: '服务态度', desc: '主动性、耐心度、关怀意识' },
                  { key: 'compliance', label: '合规规范', desc: '话术合规、流程规范、隐私保护' },
                ].map((dim) => (
                  <div key={dim.key} className="py-3 border-b border-border/40 last:border-b-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-sm font-medium text-foreground">{dim.label}</span>
                        <span className="text-[11px] text-muted-foreground ml-2">{dim.desc}</span>
                      </div>
                      <span className={`text-sm font-bold ${
                        recScores[dim.key] >= 18 ? 'text-[#22c55e]' : recScores[dim.key] >= 10 ? 'text-[#f59e0b]' : 'text-destructive'
                      }`}>
                        {recScores[dim.key]}/25
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 26 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleRecScoreChange(dim.key, i)}
                          className={`w-7 h-7 rounded text-[11px] font-semibold transition-all ${
                            recScores[dim.key] === i
                              ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── WeChat QC: 4 Nodes, 19 Actions ── */
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">微信质检 · 4节点19动作评分</span>
                </div>
                <p className="text-xs text-muted-foreground">每个动作0-5分，总分{wcMax}分，按百分制折算后70分达标</p>
              </div>

              {/* 4 Node Sections */}
              <div className="space-y-3">
                {WECHAT_NODES.map(node => (
                  <WeChatNodeSection
                    key={node.key}
                    node={node}
                    scores={wcScores}
                    onScoreChange={handleWcScoreChange}
                    expanded={expandedNodes[node.key] ?? false}
                    onToggle={() => toggleNode(node.key)}
                  />
                ))}
              </div>

              {/* WeChat Score Summary Grid */}
              <div className="grid grid-cols-4 gap-3">
                {WECHAT_NODES.map((node, idx) => {
                  const Icon = node.icon;
                  const nt = nodeTotals[idx];
                  return (
                    <div key={node.key} className={`rounded-lg p-3 ${node.bgLight} border ${node.borderColor}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${node.color}`} />
                        <span className="text-[11px] font-semibold text-foreground">{node.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-lg font-bold ${node.color}`}>{nt.total}</span>
                        <span className="text-[10px] text-muted-foreground">/{nt.max}</span>
                      </div>
                      <div className="mt-1.5 h-1 bg-black/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${nt.pct}%`,
                            backgroundColor: nt.pct >= 70 ? '#22c55e' : nt.pct >= 40 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom: Overall Score + Notes + Submit */}
        <div className="px-6 py-4 border-t border-border/60 space-y-4">
          {/* Overall Score Display */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-5 py-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-[#f59e0b]" />
              <span className="text-sm font-semibold text-foreground">
                {activeTab === 'recording' ? '录音质检总分' : '微信质检总分'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${
                overallScore >= 70 ? 'text-[#22c55e]' : overallScore >= 40 ? 'text-[#f59e0b]' : 'text-destructive'
              }`}>
                {overallScore}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>

          {/* Score breakdown mini bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            {activeTab === 'recording' ? (
              <>
                <div
                  className="h-full bg-[#3b82f6] transition-all duration-300"
                  style={{ width: `${(recScores.communication / recMax) * 100}%` }}
                />
                <div
                  className="h-full bg-[#8b5cf6] transition-all duration-300"
                  style={{ width: `${(recScores.professional / recMax) * 100}%` }}
                />
                <div
                  className="h-full bg-[#22c55e] transition-all duration-300"
                  style={{ width: `${(recScores.service / recMax) * 100}%` }}
                />
                <div
                  className="h-full bg-[#f59e0b] transition-all duration-300"
                  style={{ width: `${(recScores.compliance / recMax) * 100}%` }}
                />
              </>
            ) : (
              <>
                {WECHAT_NODES.map((node, idx) => {
                  const nt = nodeTotals[idx];
                  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];
                  return (
                    <div
                      key={node.key}
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${(nt.total / wcMax) * 100}%`,
                        backgroundColor: colors[idx],
                      }}
                    />
                  );
                })}
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground">备注</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all"
              rows={2}
              placeholder="填写评分备注..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 active:scale-[0.98] transition-all inline-flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {saving ? '提交中...' : '提交评分'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
