'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, MessageSquare, Eye, Users, Phone, Video, MessageCircle, Mic } from 'lucide-react';

// === Types ===

export interface ActionScoreInputProps {
  actionNo: number;
  actionName: string;
  trustElement: string; // 认知水平|专业感知|安全感|障碍清除
  isV2New: boolean; // ✨v2新增标记
  weight: number; // 1.0 或 1.5
  timeType: string; // 时间点|时间段
  currentScore?: number;
  perspective: 'high_level' | 'assistant' | 'patient';
  onScoreChange: (score: number, perspective: string, executionForm?: string, notes?: string) => void;
  existingScores?: Record<string, { score: number; executionForm?: string; notes?: string }>;
}

// === Constants ===

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  5: { label: '全面完成有亮点', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300' },
  4: { label: '按要求完成', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-300' },
  3: { label: '勉强完成', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-300' },
  2: { label: '明显遗漏', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-300' },
  0: { label: '未执行', color: 'text-red-600', bg: 'bg-red-50 border-red-300' },
};

const PERSPECTIVES = [
  { key: 'high_level', label: '管理者', color: '#2978B5', icon: Eye },
  { key: 'assistant', label: '助理自评', color: '#22C55E', icon: Users },
  { key: 'patient', label: '患者反馈', color: '#F59E0B', icon: MessageSquare },
];

const EXECUTION_FORMS = [
  { key: '电话', label: '电话', icon: Phone },
  { key: '微信', label: '微信', icon: MessageCircle },
  { key: '语音', label: '语音', icon: Mic },
  { key: '视频', label: '视频', icon: Video },
];

const TRUST_ELEMENT_COLORS: Record<string, string> = {
  '认知水平': '#2978B5',
  '专业感知': '#22C55E',
  '安全感': '#F59E0B',
  '障碍清除': '#EF4444',
};

// === Component ===

export default function ActionScoreInput({
  actionNo,
  actionName,
  trustElement,
  isV2New,
  weight,
  timeType,
  currentScore,
  perspective,
  onScoreChange,
  existingScores = {},
}: ActionScoreInputProps) {
  const [activePerspective, setActivePerspective] = useState(perspective);
  const [selectedScore, setSelectedScore] = useState<number | null>(
    existingScores[activePerspective]?.score ?? currentScore ?? null
  );
  const [executionForm, setExecutionForm] = useState<string>(
    existingScores[activePerspective]?.executionForm || ''
  );
  const [notes, setNotes] = useState<string>(
    existingScores[activePerspective]?.notes || ''
  );

  const isTimeSlot = timeType === '时间段';

  const handlePerspectiveChange = (p: string) => {
    setActivePerspective(p as 'high_level' | 'assistant' | 'patient');
    const existing = existingScores[p];
    setSelectedScore(existing?.score ?? null);
    setExecutionForm(existing?.executionForm || '');
    setNotes(existing?.notes || '');
  };

  const handleScoreSelect = (score: number) => {
    setSelectedScore(score);
    onScoreChange(score, activePerspective, isTimeSlot ? executionForm : undefined, notes || undefined);
  };

  const handleFormChange = (form: string) => {
    setExecutionForm(form);
    if (selectedScore !== null) {
      onScoreChange(selectedScore, activePerspective, form, notes || undefined);
    }
  };

  const handleNotesBlur = () => {
    if (selectedScore !== null) {
      onScoreChange(selectedScore, activePerspective, isTimeSlot ? executionForm : undefined, notes || undefined);
    }
  };

  return (
    <div className={cn(
      'bg-card rounded-lg border p-4 transition-all',
      isV2New ? 'border-blue-200 bg-blue-50/30' : 'border-border'
    )}>
      {/* Header: action name + tags */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            #{actionNo}
          </span>
          <h4 className="text-sm font-semibold text-foreground truncate">{actionName}</h4>
          {isV2New && (
            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              ✨v2新增
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: TRUST_ELEMENT_COLORS[trustElement] + '15', color: TRUST_ELEMENT_COLORS[trustElement] }}
          >
            {trustElement}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            权重 {weight}
          </span>
        </div>
      </div>

      {/* 3-perspective tabs */}
      <div className="flex gap-1 mb-3 bg-muted rounded-lg p-1">
        {PERSPECTIVES.map((p) => {
          const hasScore = existingScores[p.key]?.score !== undefined && existingScores[p.key]?.score !== null;
          return (
            <button
              key={p.key}
              onClick={() => handlePerspectiveChange(p.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                activePerspective === p.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <p.icon className="w-3.5 h-3.5" style={{ color: p.color }} />
              <span>{p.label}</span>
              {hasScore && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Score buttons */}
      <div className="flex gap-1.5 mb-3">
        {[5, 4, 3, 2, 0].map((score) => {
          const info = SCORE_LABELS[score];
          const isSelected = selectedScore === score;
          return (
            <button
              key={score}
              onClick={() => handleScoreSelect(score)}
              className={cn(
                'flex-1 py-2 rounded-md text-center text-xs font-medium border transition-all',
                isSelected
                  ? `${info.bg} ${info.color} border-current shadow-sm scale-105`
                  : 'bg-muted text-muted-foreground border-transparent hover:border-border'
              )}
              title={info.label}
            >
              <div className="flex items-center justify-center gap-0.5">
                {score > 0 && <Star className={cn('w-3 h-3', isSelected ? 'fill-current' : '')} />}
                <span className="font-bold">{score}分</span>
              </div>
              <div className="text-[10px] mt-0.5 leading-tight">{info.label}</div>
            </button>
          );
        })}
      </div>

      {/* Execution form selector (only for 时间段 actions) */}
      {isTimeSlot && selectedScore !== null && (
        <div className="mb-3">
          <span className="text-xs text-muted-foreground mb-1.5 block">执行渠道</span>
          <div className="flex gap-1.5">
            {EXECUTION_FORMS.map((form) => {
              const Icon = form.icon;
              const isActive = executionForm === form.key;
              return (
                <button
                  key={form.key}
                  onClick={() => handleFormChange(form.key)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border transition-all',
                    isActive
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-muted border-transparent text-muted-foreground hover:border-border'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {form.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes input */}
      {selectedScore !== null && (
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="添加备注（可选）..."
            className="w-full text-xs bg-muted border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            rows={2}
          />
        </div>
      )}
    </div>
  );
}
