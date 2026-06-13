'use client';

import { cn } from '@/lib/utils';
import { Phone, PhoneCall, CalendarCheck, Stethoscope, Clock, CheckCircle2, Lock } from 'lucide-react';

// === Types ===

export interface NodeInfo {
  id: number;
  name: string;
  timeType: string; // 时间点 | 时间段
  channels?: string; // 仅通话 | 多渠道
  weight?: number;
  trustFocus?: string;
  description?: string;
  sortOrder?: number;
  status: 'completed' | 'active' | 'locked';
  progress?: { completed: number; total: number };
  completed?: number;
  total?: number;
  channel?: string;
}

export interface NodeCardProps {
  node: NodeInfo;
  isSelected: boolean;
  onClick: () => void;
}

// === Constants ===

const NODE_ICONS: Record<number, React.ElementType> = {
  1: Phone,
  2: PhoneCall,
  3: CalendarCheck,
  4: Stethoscope,
};

const NODE_COLORS: Record<number, string> = {
  1: '#2978B5',
  2: '#22C55E',
  3: '#F59E0B',
  4: '#EF4444',
};

const TIME_TYPE_LABELS: Record<string, string> = {
  '时间点': '时间点',
  '时间段': '时间段',
};

// === Component ===

export default function NodeCard({ node, isSelected, onClick }: NodeCardProps) {
  const Icon = NODE_ICONS[node.id] || Phone;
  const color = NODE_COLORS[node.id] || '#2978B5';
  const isCompleted = node.status === 'completed';
  const isLocked = node.status === 'locked';
  const isActive = node.status === 'active';

  return (
    <button
      onClick={!isLocked ? onClick : undefined}
      disabled={isLocked}
      className={cn(
        'relative w-full text-left rounded-xl border-2 p-4 transition-all',
        isSelected
          ? 'border-primary shadow-md scale-[1.02]'
          : isCompleted
          ? 'border-green-300 bg-green-50/30'
          : isLocked
          ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
          : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
      )}
    >
      {/* Status indicator */}
      <div className="absolute top-3 right-3">
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : isLocked ? (
          <Lock className="w-5 h-5 text-muted-foreground" />
        ) : isActive ? (
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
        ) : null}
      </div>

      {/* Icon + name */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '15' }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{node.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {node.timeType}
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {node.channels}
            </span>
          </div>
        </div>
      </div>

      {/* Trust focus */}
      <p className="text-xs text-muted-foreground mb-2">
        <span className="font-medium text-foreground/70">信任要素：</span>
        {node.trustFocus}
      </p>

      {/* Progress bar */}
      {node.progress && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">
              {node.progress.completed}/{node.progress.total} 关
            </span>
            <span className="text-[10px] font-medium" style={{ color }}>
              {node.progress.total > 0 ? Math.round((node.progress.completed / node.progress.total) * 100) : 0}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${node.progress.total > 0 ? (node.progress.completed / node.progress.total) * 100 : 0}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      )}

      {/* Weight badge */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          权重 {Math.round((node.weight ?? 0) * 100)}%
        </span>
      </div>
    </button>
  );
}
