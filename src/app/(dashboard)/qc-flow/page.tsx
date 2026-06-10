'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  Phone, PhoneCall, CalendarCheck, Stethoscope, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, Clock, Shield, Zap,
  ChevronDown, ChevronUp, MessageSquare, Save
} from 'lucide-react';

interface ActionScore {
  id: number;
  index: number;
  name: string;
  description: string;
  standard: string;
  score: number | null;
  passed: boolean | null;
}

interface QcNode {
  key: string;
  name: string;
  weight: number;
  desc: string;
  actions: ActionScore[];
  avgScore: number | null;
  passRate: number;
  scoredCount: number;
  totalActions: number;
  status: string;
}

interface SpecialCase {
  key: string;
  name: string;
  actions: { id: number; index: number; name: string; description: string; scriptTemplate: string }[];
}

const nodeIcons: Record<string, any> = {
  first_call: Phone,
  day3_followup: PhoneCall,
  day5_appointment: CalendarCheck,
  clinic_day: Stethoscope,
};

const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  good: { bg: '#F0FDF4', text: '#22C55E', border: '#BBF7D0', label: '达标' },
  warning: { bg: '#FEF3C7', text: '#F59E0B', border: '#FDE68A', label: '预警' },
  danger: { bg: '#FEF2F2', text: '#EF4444', border: '#FECACA', label: '不达标' },
  pending: { bg: '#F8F6F0', text: '#667085', border: '#E6E1D8', label: '待评估' },
};

export default function QcFlowPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [mentorNote, setMentorNote] = useState('');
  const [selectedTrainee, setSelectedTrainee] = useState<{id: string; realName: string; stage: number} | null>(null);
  const [trainees, setTrainees] = useState<{id: string; realName: string; stage: number}[]>([]);

  const isTrainee = user?.role === 'trainee';
  const viewUserId = selectedTrainee?.id || user?.id;

  // Stage label helper
  const stageLabel = (stage: number | undefined) => {
    switch (stage) {
      case 1: return '学习期';
      case 2: return '练习期';
      case 3: return '独立期';
      case 4: return '熟练期';
      default: return '学习期';
    }
  };

  // Fetch trainee list for non-trainee roles
  useEffect(() => {
    if (!user?.id || isTrainee) return;
    const fetchTrainees = async () => {
      try {
        const res = await fetch('/api/users?roleId=1&isActive=true', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const json = await res.json();
          const list = (json.users || json || []).map((u: any) => ({
            id: u.id, realName: u.realName || u.username, stage: u.stage || 1,
          }));
          setTrainees(list);
          if (list.length > 0 && !selectedTrainee) {
            setSelectedTrainee(list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch trainees:', err);
      }
    };
    fetchTrainees();
  }, [user?.id, isTrainee]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!viewUserId) return;
    try {
      const res = await fetch(`/api/qc-flow?userId=${viewUserId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch qc-flow data:', err);
    } finally {
      setLoading(false);
    }
  }, [viewUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: '#667085' }}>加载中...</div>
      </div>
    );
  }

  const nodes: QcNode[] = data?.nodes || [];
  const weightedScore = data?.weightedScore;
  const quadrant = data?.quadrant || '--';
  const specialCases: SpecialCase[] = data?.specialCases || [];

  return (
    <div className="space-y-6">
      {/* 顶部标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#102A43' }}>服务质量追踪</h1>
          <p className="text-sm mt-1" style={{ color: '#667085' }}>4节点19核心动作质量追踪</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {/* Trainee selector for non-trainee roles */}
            {!isTrainee && trainees.length > 0 && (
              <select
                className="text-sm border rounded-lg px-3 py-1.5 bg-white"
                style={{ borderColor: '#E6E1D8', color: '#102A43' }}
                value={selectedTrainee?.id || ''}
                onChange={(e) => {
                  const t = trainees.find(tr => tr.id === e.target.value);
                  setSelectedTrainee(t || null);
                }}
              >
                {trainees.map(t => (
                  <option key={t.id} value={t.id}>{t.realName} ({stageLabel(t.stage)})</option>
                ))}
              </select>
            )}
            <span className="text-sm font-medium" style={{ color: '#102A43' }}>
              {selectedTrainee ? selectedTrainee.realName : (user.realName || user.username)}
            </span>
            {selectedTrainee ? (
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                {stageLabel(selectedTrainee.stage)}
              </span>
            ) : user.role === 'trainee' ? (
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                {stageLabel(user.stage)}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* 4节点横向泳道区 */}
      <div className="grid grid-cols-4 gap-4">
        {nodes.map((node, i) => {
          const Icon = nodeIcons[node.key] || Phone;
          const sc = statusColors[node.status] || statusColors.pending;
          return (
            <div key={node.key} className="bg-card rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
              {/* 节点头 */}
              <div className="p-4 border-b" style={{ borderColor: sc.border, backgroundColor: sc.bg }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5" style={{ color: sc.text }} />
                  <span className="text-sm font-bold" style={{ color: '#102A43' }}>{node.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: sc.text + '20', color: sc.text }}>
                    {sc.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: sc.text }}>
                    {node.avgScore ?? '--'}
                  </div>
                  <div className="text-xs" style={{ color: '#667085' }}>
                    <div>权重 {node.weight}%</div>
                    <div>通过率 {node.passRate}%</div>
                  </div>
                </div>
              </div>

              {/* 动作列表 */}
              <div className="p-3 space-y-1.5">
                {node.actions.map(action => (
                  <div key={action.id} className="flex items-center gap-2 p-1.5 rounded" style={{
                    backgroundColor: action.score != null
                      ? action.passed ? '#F0FDF4' : '#FEF2F2'
                      : '#F8F6F0'
                  }}>
                    {action.score != null ? (
                      action.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#22C55E' }} />
                        : <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#EF4444' }} />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: '#667085' }} />
                    )}
                    <span className="text-xs truncate" style={{
                      color: action.score != null
                        ? action.passed ? '#102A43' : '#EF4444'
                        : '#667085'
                    }}>
                      {action.name}
                    </span>
                    {action.score != null && (
                      <span className="text-xs font-bold ml-auto" style={{
                        color: action.passed ? '#22C55E' : '#EF4444'
                      }}>
                        {action.score}分
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 推荐赋能按钮 */}
              {node.status === 'danger' && (
                <div className="px-3 pb-3">
                  <a href="/empowerment" className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}>
                    <Zap className="w-3.5 h-3.5" /> 推荐赋能方案
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 综合评分区 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="text-xs mb-2" style={{ color: '#667085' }}>加权总分</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color: weightedScore != null ? (weightedScore >= 4 ? '#22C55E' : weightedScore >= 3 ? '#F59E0B' : '#EF4444') : '#667085' }}>
              {weightedScore ?? '--'}
            </span>
            <span className="text-sm" style={{ color: '#667085' }}>/ 5分</span>
          </div>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="text-xs mb-2" style={{ color: '#667085' }}>过程线评级</div>
          <div className="text-2xl font-bold" style={{ color: quadrant === 'A类' ? '#22C55E' : quadrant === 'C类' ? '#F59E0B' : quadrant === 'D类' ? '#EF4444' : '#667085' }}>
            {quadrant}
          </div>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="text-xs mb-2" style={{ color: '#667085' }}>低分节点</div>
          {nodes.filter(n => n.status === 'danger').map(n => (
            <div key={n.key} className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
              <span className="text-sm font-medium" style={{ color: '#EF4444' }}>{n.name} {n.avgScore}分</span>
              <span className="text-xs" style={{ color: '#667085' }}>→ 已触发赋能</span>
            </div>
          ))}
          {nodes.filter(n => n.status === 'danger').length === 0 && (
            <span className="text-sm" style={{ color: '#22C55E' }}>无低分节点</span>
          )}
        </div>
      </div>

      {/* 特殊患者情况区 */}
      <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5" style={{ color: '#2978B5' }} />
          <h3 className="text-sm font-bold" style={{ color: '#102A43' }}>4类特殊情况补充动作(10个)</h3>
        </div>
        <div className="space-y-2">
          {specialCases.map((sc) => (
            <div key={sc.key} className="border rounded-lg" style={{ borderColor: '#E6E1D8' }}>
              <button
                onClick={() => setExpandedCase(expandedCase === sc.key ? null : sc.key)}
                className="flex items-center justify-between w-full p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#102A43' }}>{sc.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#2978B515', color: '#2978B5' }}>
                    {sc.actions.length}个动作
                  </span>
                </div>
                {expandedCase === sc.key
                  ? <ChevronUp className="w-4 h-4" style={{ color: '#667085' }} />
                  : <ChevronDown className="w-4 h-4" style={{ color: '#667085' }} />
                }
              </button>
              {expandedCase === sc.key && (
                <div className="px-3 pb-3 space-y-2">
                  {sc.actions.map(action => (
                    <div key={action.id} className="p-2 rounded-lg" style={{ backgroundColor: '#F8F6F0' }}>
                      <div className="text-xs font-medium" style={{ color: '#102A43' }}>{action.name}</div>
                      {action.description && (
                        <div className="text-xs mt-1" style={{ color: '#667085' }}>{action.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 带教建议区 */}
      <div className="bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h3 className="text-sm font-bold" style={{ color: '#102A43' }}>带教建议</h3>
        </div>
        <textarea
          value={mentorNote}
          onChange={(e) => setMentorNote(e.target.value)}
          placeholder="针对低分节点，记录带教建议和指导要点..."
          className="w-full h-24 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2"
          style={{ borderColor: '#E6E1D8', color: '#102A43', backgroundColor: '#F8F6F0' }}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: '#667085' }}>仅带教老师和培训经理可见</span>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#2978B5' }}
            onClick={() => {
              // TODO: Save mentor note
              alert('带教建议已保存');
            }}
          >
            <Save className="w-3.5 h-3.5" /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
