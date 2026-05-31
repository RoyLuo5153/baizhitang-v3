'use client';

import { useEffect, useState } from 'react';
import {
  Mic, CheckCircle2, XCircle, MessageSquare, Shield,
  Plus, Star, FileText,
} from 'lucide-react';

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
  reviewer_id: string | null;
  notes: string | null;
  audio_url: string | null;
  chat_screenshots: any;
  created_at: string;
}

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">质检审核</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">录音质检、微信质检、日常考核管理与审核</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />新建质检
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
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

      {/* Records List */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="bg-card rounded-lg shadow-card p-12 text-center">
            <Mic className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">暂无质检记录</p>
          </div>
        ) : (
          filteredRecords.map(record => {
            const typeConfig = QC_TYPE_LABELS[record.qc_type] || QC_TYPE_LABELS.recording;
            const TypeIcon = typeConfig.icon;
            const passed = record.score >= 70;

            return (
              <div key={record.id} className="bg-card rounded-lg shadow-card p-5 border border-border/50">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    passed ? 'bg-[#22c55e]/10' : 'bg-destructive/10'
                  }`}>
                    <TypeIcon className={`w-5 h-5 ${passed ? 'text-[#22c55e]' : 'text-destructive'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{typeConfig.label}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${
                        passed ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-destructive/15 text-destructive'
                      }`}>
                        {passed ? '达标' : '不达标'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className={`font-bold text-lg ${passed ? 'text-[#22c55e]' : 'text-destructive'}`}>
                        {record.score}分
                      </span>
                      {record.dimension_scores && Object.entries(record.dimension_scores).map(([key, val]) => (
                        <span key={key} className="text-muted-foreground">
                          {DIMENSION_LABELS[key] || key}: <span className={val >= 70 ? 'text-foreground' : 'text-destructive'}>{val}</span>
                        </span>
                      ))}
                    </div>
                    {record.notes && (
                      <p className="text-xs text-muted-foreground mt-2">{record.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New QC Form */}
      {showForm && (
        <QcFormDialog onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchRecords(); }} />
      )}
    </div>
  );
}

function QcFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [qcType, setQcType] = useState('recording');
  const [userId, setUserId] = useState('1');
  const [score, setScore] = useState('');
  const [communication, setCommunication] = useState('');
  const [professional, setProfessional] = useState('');
  const [service, setService] = useState('');
  const [compliance, setCompliance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          qcType,
          score: parseInt(score) || 0,
          dimensionScores: {
            communication: parseInt(communication) || 0,
            professional: parseInt(professional) || 0,
            service: parseInt(service) || 0,
            compliance: parseInt(compliance) || 0,
          },
          notes,
        }),
      });
      if (res.ok) onSaved();
    } catch {
      // ignore
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold text-foreground mb-4">新建质检记录</h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            {Object.entries(QC_TYPE_LABELS).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setQcType(key)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5 ${
                    qcType === key ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />{config.label}
                </button>
              );
            })}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">总分</label>
            <input type="number" value={score} onChange={e => setScore(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              min={0} max={100} placeholder="0-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '沟通表达', value: communication, set: setCommunication },
              { label: '专业能力', value: professional, set: setProfessional },
              { label: '服务态度', value: service, set: setService },
              { label: '合规规范', value: compliance, set: setCompliance },
            ].map(f => (
              <div key={f.label}>
                <label className="text-sm font-medium text-foreground">{f.label}</label>
                <input type="number" value={f.value} onChange={e => f.set(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  min={0} max={100} placeholder="0-100" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">备注</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">取消</button>
          <button onClick={handleSave} disabled={saving || !score}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
