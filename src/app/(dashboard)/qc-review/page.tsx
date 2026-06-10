'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mic, Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, ChevronDown, Play, Eye, Star, MessageSquare,
  Headphones, FileText, User, Filter
} from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { apiGet } from '@/lib/api-client';

// ─── Types ──────────────────────────────────────────────

interface QcRecord {
  id: number;
  userId: string;
  traineeName: string;
  type: string;
  date: string;
  sourceType: string | null;
  sourceId: number | null;
  dimensions: {
    business: number | null;
    service: number | null;
    communication: number | null;
    process: number | null;
  };
  aiScore: number | null;
  humanScore: number | null;
  audioUrl: string | null;
  screenshots: unknown;
  wechatNode: string | null;
  wechatActions: Record<string, unknown> | null;
  aiAnalysis: unknown;
  status: string;
  comment: string | null;
  reviewerId: string | null;
  createdAt: string;
}

interface QcStats {
  total: number;
  pendingCount: number;
  completedCount: number;
  avgScore: number;
}

// ─── Constants ──────────────────────────────────────────

const QC_TYPE_CONFIG: Record<string, { label: string; icon: typeof Mic; color: string }> = {
  recording: { label: '录音质检', icon: Mic, color: 'text-[#2978B5]' },
  wechat: { label: '微信质检', icon: MessageSquare, color: 'text-[#F59E0B]' },
  daily: { label: '日常考核', icon: FileText, color: 'text-[#22c55e]' },
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  practice_submission: '演练提交触发',
  screenshot_upload: '截图上传触发',
  daily_assessment: '日常考核触发',
};

const DIMENSION_LABELS: Record<string, string> = {
  business: '业务能力',
  service: '服务态度',
  communication: '沟通技巧',
  process: '流程规范',
};

// ─── Score Badge ────────────────────────────────────────

function ScoreBadge({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'text-[#22c55e]' : pct >= 40 ? 'text-[#F59E0B]' : 'text-destructive';
  return <span className={`text-sm font-bold ${color}`}>{score}</span>;
}

// ─── Status Badge ───────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-[#F59E0B]/15 text-[#F59E0B]">
        <Clock className="w-3 h-3" />待审核
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-[#22c55e]/15 text-[#22c55e]">
      <CheckCircle2 className="w-3 h-3" />已审核
    </span>
  );
}

// ─── Review Dialog ──────────────────────────────────────

function ReviewDialog({
  record,
  onClose,
  onSaved,
}: {
  record: QcRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({
    business: record.dimensions.business || 0,
    service: record.dimensions.service || 0,
    communication: record.dimensions.communication || 0,
    process: record.dimensions.process || 0,
  });
  const [comment, setComment] = useState(record.comment || '');
  const [saving, setSaving] = useState(false);

  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const avg = Math.round(total / 4);

  const handleScoreChange = (key: string, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/qc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          humanScore: avg,
          humanComment: comment,
          scoreBusiness: scores.business,
          scoreService: scores.service,
          scoreCommunication: scores.communication,
          scoreProcess: scores.process,
        }),
      });
      if (res.ok) onSaved();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-8 overflow-y-auto pb-8">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-lg mx-4">
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">审核质检</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">新人：{record.traineeName}</span>
            <span className="text-xs text-muted-foreground">|</span>
            {record.sourceType && (
              <span className="text-xs text-[#2978B5]">{SOURCE_TYPE_LABELS[record.sourceType] || record.sourceType}</span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Audio Player */}
          {record.audioUrl && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Headphones className="w-4 h-4 text-[#2978B5]" />
                <span className="text-sm font-medium text-foreground">录音文件</span>
              </div>
              <audio controls className="w-full h-8" src={record.audioUrl} />
            </div>
          )}

          {/* Dimension Scoring */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">四维度评分（0-100）</h4>
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={scores[key]}
                    onChange={(e) => handleScoreChange(key, parseInt(e.target.value))}
                    className="w-32 accent-[#2978B5]"
                  />
                  <span className="text-sm font-bold w-8 text-right text-foreground">{scores[key]}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-sm font-semibold text-foreground">综合评分</span>
              <ScoreBadge score={avg} />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">审核评语</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="填写审核意见、卡点说明、改进建议..."
              className="w-full h-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
            />
          </div>
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#2978B5] text-white px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '提交审核'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function QcReviewPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<QcRecord[]>([]);
  const [stats, setStats] = useState<QcStats>({ total: 0, pendingCount: 0, completedCount: 0, avgScore: 0 });
  const [roleId, setRoleId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewRecord, setReviewRecord] = useState<QcRecord | null>(null);

  const isTrainee = user?.role === 'trainee';

  const fetchRecords = useCallback(async () => {
    const params = new URLSearchParams();
    if (user?.id) params.set('userId', user.id);
    const result = await apiGet<{ records: any[]; stats: { total: number; pendingCount: number; completedCount: number; avgScore: number }; roleId: number }>(`/api/qc?${params}`, { records: [], stats: { total: 0, pendingCount: 0, completedCount: 0, avgScore: 0 }, roleId: 1 });
    setRecords(result.records);
    setStats(result.stats);
    setRoleId(result.roleId);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Filtered records
  const filteredRecords = records.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const pendingRecords = filteredRecords.filter(r => r.status === 'pending');
  const completedRecords = filteredRecords.filter(r => r.status === 'completed');

  // ─── Trainee View ───────────────────────────────────

  if (isTrainee) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#2978B5]" />
          <h1 className="text-xl font-bold text-foreground">我的质检</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          质检由系统自动触发：当你提交演练录音、上传截图或完成日常考核时，系统会自动创建质检任务交由带教老师审核。
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-lg shadow-card p-4">
            <p className="text-xs text-muted-foreground mb-1">质检总数</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-card rounded-lg shadow-card p-4">
            <p className="text-xs text-muted-foreground mb-1">待审核</p>
            <p className="text-2xl font-bold text-[#F59E0B]">{stats.pendingCount}</p>
          </div>
          <div className="bg-card rounded-lg shadow-card p-4">
            <p className="text-xs text-muted-foreground mb-1">平均分</p>
            <ScoreBadge score={stats.avgScore} />
          </div>
        </div>

        {/* Records */}
        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="bg-card rounded-lg shadow-card p-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无质检记录</p>
              <p className="text-xs text-muted-foreground mt-1">提交演练录音后，系统会自动创建质检任务</p>
            </div>
          ) : (
            filteredRecords.map(record => <TraineeQcCard key={record.id} record={record} />)
          )}
        </div>
      </div>
    );
  }

  // ─── Reviewer View (mentor/teacher/manager/boss) ────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#2978B5]" />
          <h1 className="text-xl font-bold text-foreground">质检审核</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          质检任务由系统自动生成 — 新人提交演练录音、上传截图、完成考核时自动触发，无需手动新建
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">待审核</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{stats.pendingCount}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">已审核</p>
          <p className="text-2xl font-bold text-[#22c55e]">{stats.completedCount}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">平均评分</p>
          <ScoreBadge score={stats.avgScore} />
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">质检总数</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">类型：</span>
        </div>
        {['all', 'recording', 'wechat', 'daily'].map(type => {
          const config = type === 'all'
            ? { label: '全部', icon: Shield }
            : QC_TYPE_CONFIG[type] || { label: type, icon: FileText };
          const Icon = config.icon;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                filterType === type
                  ? 'bg-[#2978B5]/15 text-[#2978B5]'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" />{config.label}
            </button>
          );
        })}

        <div className="w-px h-5 bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">状态：</span>
          {['all', 'pending', 'completed'].map(status => {
            const label = status === 'all' ? '全部' : status === 'pending' ? '待审核' : '已审核';
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-[#2978B5]/15 text-[#2978B5]'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pending Section */}
      {pendingRecords.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-base font-semibold text-foreground">待审核</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] font-bold">{pendingRecords.length}</span>
          </div>
          <div className="space-y-3">
            {pendingRecords.map(record => (
              <ReviewerQcCard key={record.id} record={record} onReview={() => setReviewRecord(record)} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
          <h2 className="text-base font-semibold text-foreground">已审核</h2>
          <span className="text-xs text-muted-foreground">({completedRecords.length}条)</span>
        </div>
        <div className="space-y-3">
          {completedRecords.length === 0 && pendingRecords.length === 0 ? (
            <div className="bg-card rounded-lg shadow-card p-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">暂无质检记录</p>
              <p className="text-xs text-muted-foreground mt-1">当新人提交演练、上传截图或完成考核时，系统会自动创建质检任务</p>
            </div>
          ) : (
            completedRecords.map(record => (
              <ReviewerQcCard key={record.id} record={record} onReview={() => setReviewRecord(record)} />
            ))
          )}
        </div>
      </div>

      {/* Review Dialog */}
      {reviewRecord && (
        <ReviewDialog
          record={reviewRecord}
          onClose={() => setReviewRecord(null)}
          onSaved={() => { setReviewRecord(null); fetchRecords(); }}
        />
      )}
    </div>
  );
}

// ─── Trainee QC Card ────────────────────────────────────

function TraineeQcCard({ record }: { record: QcRecord }) {
  const typeConfig = QC_TYPE_CONFIG[record.type] || QC_TYPE_CONFIG.recording;
  const TypeIcon = typeConfig.icon;
  const passed = (record.humanScore || record.aiScore || 0) >= 70;

  return (
    <div className="bg-card rounded-lg shadow-card p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          passed ? 'bg-[#22c55e]/10' : 'bg-destructive/10'
        }`}>
          <TypeIcon className={`w-4 h-4 ${passed ? 'text-[#22c55e]' : 'text-destructive'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">{typeConfig.label}</span>
            <StatusBadge status={record.status} />
            <span className="text-[11px] text-muted-foreground">
              {new Date(record.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
            </span>
          </div>
          {record.sourceType && (
            <span className="text-xs text-[#2978B5] mb-1 block">{SOURCE_TYPE_LABELS[record.sourceType]}</span>
          )}
          <div className="flex items-center gap-4 text-sm">
            {record.humanScore != null && (
              <span className={`font-bold text-lg ${record.humanScore >= 70 ? 'text-[#22c55e]' : 'text-destructive'}`}>
                {record.humanScore}<span className="text-xs font-normal text-muted-foreground ml-0.5">分</span>
              </span>
            )}
            {record.aiScore != null && record.humanScore == null && (
              <span className="text-muted-foreground text-xs">AI初评：{record.aiScore}分</span>
            )}
          </div>
          {record.comment && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{record.comment}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reviewer QC Card ───────────────────────────────────

function ReviewerQcCard({ record, onReview }: { record: QcRecord; onReview: () => void }) {
  const typeConfig = QC_TYPE_CONFIG[record.type] || QC_TYPE_CONFIG.recording;
  const TypeIcon = typeConfig.icon;
  const isPending = record.status === 'pending';

  return (
    <div className={`bg-card rounded-lg shadow-card p-4 border transition-colors ${
      isPending ? 'border-[#F59E0B]/30 hover:border-[#F59E0B]' : 'border-border/50 hover:border-border'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isPending ? 'bg-[#F59E0B]/10' : (record.humanScore || 0) >= 70 ? 'bg-[#22c55e]/10' : 'bg-destructive/10'
        }`}>
          <TypeIcon className={`w-4 h-4 ${
            isPending ? 'text-[#F59E0B]' : (record.humanScore || 0) >= 70 ? 'text-[#22c55e]' : 'text-destructive'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">{record.traineeName}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{typeConfig.label}</span>
            <StatusBadge status={record.status} />
            <span className="text-[11px] text-muted-foreground ml-auto">
              {new Date(record.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
            </span>
          </div>

          {record.sourceType && (
            <span className="text-xs text-[#2978B5] mb-1 block">
              来源：{SOURCE_TYPE_LABELS[record.sourceType] || record.sourceType}
            </span>
          )}

          {/* Dimension mini-scores */}
          <div className="flex items-center gap-3 mt-1">
            {Object.entries(record.dimensions).map(([key, val]) => (
              val != null && (
                <span key={key} className="text-xs text-muted-foreground">
                  {DIMENSION_LABELS[key] || key}: <span className={(val ?? 0) >= 70 ? 'text-foreground' : 'text-destructive'}>{val}</span>
                </span>
              )
            ))}
            {record.humanScore != null && (
              <span className={`text-sm font-bold ml-auto ${record.humanScore >= 70 ? 'text-[#22c55e]' : 'text-destructive'}`}>
                {record.humanScore}分
              </span>
            )}
          </div>

          {record.comment && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{record.comment}</p>
          )}
        </div>
      </div>

      {/* Action button for pending */}
      {isPending && (
        <div className="mt-3 pt-3 border-t border-border/30 flex justify-end">
          <button
            onClick={onReview}
            className="bg-[#2978B5] text-white px-4 py-1.5 rounded-md text-xs font-medium hover:opacity-90 inline-flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />去审核
          </button>
        </div>
      )}
    </div>
  );
}
