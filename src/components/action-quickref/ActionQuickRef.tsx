'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Search, X, BookOpen, ChevronDown, ChevronRight, Star,
  Phone, PhoneCall, CalendarCheck, Stethoscope, Sparkles,
} from 'lucide-react';

// === Types ===

interface CoreAction {
  action_no: number;
  action_name: string;
  node_id: number;
  node_name?: string;
  trust_element: string;
  weight: number;
  scoring_criteria: Record<string, string> | null;
  key_points: string[] | null;
  is_v2_new?: boolean;
}

interface ActionQuickRefProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// === Constants ===

const NODE_ICONS: Record<number, React.ElementType> = {
  1: Phone,
  2: PhoneCall,
  3: CalendarCheck,
  4: Stethoscope,
};

const NODE_NAMES: Record<number, string> = {
  1: '首通电话',
  2: '三天回访',
  3: '五天预约',
  4: '面诊当天',
};

const TRUST_ELEMENT_COLORS: Record<string, string> = {
  '认知水平': '#2978B5',
  '专业感知': '#22C55E',
  '安全感': '#F59E0B',
  '障碍清除': '#EF4444',
};

// === Component ===

export default function ActionQuickRef({ isOpen: externalOpen, onClose: externalOnClose }: ActionQuickRefProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const onClose = externalOnClose || (() => setInternalOpen(false));
  const onOpen = () => setInternalOpen(true);
  const [actions, setActions] = useState<CoreAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedNode, setExpandedNode] = useState<number | null>(1);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchActions = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/core-actions?withNodes=true', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const json = await res.json();
          setActions(json.actions || []);
        }
      } catch (err) {
        console.error('Failed to fetch core actions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchActions();
  }, [isOpen]);

  // Group by node
  const grouped = useMemo(() => {
    const map: Record<number, CoreAction[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const a of actions) {
      const nodeId = a.node_id;
      if (map[nodeId]) map[nodeId].push(a);
    }
    return map;
  }, [actions]);

  // Filter by search
  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result: Record<number, CoreAction[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const nodeId of [1, 2, 3, 4]) {
      result[nodeId] = (grouped[nodeId] || []).filter(
        (a) =>
          a.action_name.toLowerCase().includes(q) ||
          String(a.action_no).includes(q) ||
          a.trust_element.includes(q)
      );
    }
    return result;
  }, [grouped, search]);

  if (!isOpen) {
    return (
      <button
        onClick={onOpen}
        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
        title="19核心动作速查"
      >
        <BookOpen className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">19核心动作速查</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索动作名称、编号或信任要素..."
              className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((nodeId) => {
                const nodeActions = filteredGrouped[nodeId] || [];
                if (search && nodeActions.length === 0) return null;
                const Icon = NODE_ICONS[nodeId] || Phone;
                const isExpanded = expandedNode === nodeId;

                return (
                  <div key={nodeId} className="bg-muted/30 rounded-lg overflow-hidden">
                    {/* Node header */}
                    <button
                      onClick={() => setExpandedNode(isExpanded ? null : nodeId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          {NODE_NAMES[nodeId]}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {nodeActions.length}个动作
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Actions list */}
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2">
                        {nodeActions.map((action) => {
                          const isActionExpanded = expandedAction === action.action_no;
                          return (
                            <div
                              key={action.action_no}
                              className={cn(
                                'bg-card rounded-lg border transition-all',
                                action.is_v2_new ? 'border-blue-200 bg-blue-50/20' : 'border-border'
                              )}
                            >
                              <button
                                onClick={() =>
                                  setExpandedAction(isActionExpanded ? null : action.action_no)
                                }
                                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                                    #{action.action_no}
                                  </span>
                                  <span className="text-sm text-foreground truncate">
                                    {action.action_name}
                                  </span>
                                  {action.is_v2_new && (
                                    <Sparkles className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor:
                                        (TRUST_ELEMENT_COLORS[action.trust_element] || '#2978B5') + '15',
                                      color: TRUST_ELEMENT_COLORS[action.trust_element] || '#2978B5',
                                    }}
                                  >
                                    {action.trust_element}
                                  </span>
                                  {isActionExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>
                              </button>

                              {/* Expanded detail */}
                              {isActionExpanded && (
                                <div className="px-3 pb-3 space-y-2">
                                  {/* Scoring criteria */}
                                  {action.scoring_criteria && (
                                    <div>
                                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                        评分标准
                                      </span>
                                      <div className="mt-1 space-y-1">
                                        {Object.entries(action.scoring_criteria).map(([score, desc]) => (
                                          <div key={score} className="flex items-start gap-2 text-xs">
                                            <span className="font-bold text-foreground min-w-[2ch]">
                                              {score}分
                                            </span>
                                            <span className="text-muted-foreground">{desc}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Key points */}
                                  {action.key_points && action.key_points.length > 0 && (
                                    <div>
                                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                        关键要点
                                      </span>
                                      <ul className="mt-1 space-y-0.5">
                                        {action.key_points.map((point, i) => (
                                          <li
                                            key={i}
                                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                                          >
                                            <Star className="w-2.5 h-2.5 text-primary flex-shrink-0 mt-0.5" />
                                            {point}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Weight */}
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>权重：{action.weight}</span>
                                    {action.is_v2_new && (
                                      <span className="text-blue-500 font-medium">v2新增</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
