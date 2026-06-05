'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, CheckCircle2, AlertTriangle, Clock, Plus, ChevronDown, ChevronUp, Calendar, Send } from 'lucide-react';

interface Batch {
  id: number;
  plan_id: number;
  batch_name: string;
  start_date: string;
  end_date: string;
  status: string;
  traineeCount: number;
  completedCount: number;
  stages?: StageWithStats[];
  trainees?: TraineeInfo[];
}

interface StageWithStats {
  id: number;
  stage_number: number;
  stage_name: string;
  schedule_mode: string;
  totalDeliveries: number;
  completedDeliveries: number;
  attendanceRate: number;
  courses: StageCourse[];
}

interface StageCourse {
  id: number;
  course_id: number;
  is_required: boolean;
  suggested_hours: number;
  courses: { id: number; name: string };
}

interface TraineeInfo {
  id: number;
  user_id: string;
  current_stage: number;
  overall_status: string;
  users: { real_name: string; username: string };
}

interface Alert {
  id: string;
  type: 'progress' | 'assignment' | 'schedule';
  message: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

export function ManagerDashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [plans, setPlans] = useState<Array<{ id: number; name: string }>>([]);
  const [newBatch, setNewBatch] = useState({ planId: '', batchName: '', startDate: '', endDate: '' });

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/training-batches');
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const fetchBatchDetail = async (batchId: number) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); return; }
    try {
      const res = await fetch(`/api/training-batches?id=${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, stages: data.stages, trainees: data.trainees } : b));
        setExpandedBatch(batchId);
      }
    } catch { /* ignore */ }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/training-plans');
      if (res.ok) {
        const data = await res.json();
        setPlans((data.plans || []).map((p: Record<string, unknown>) => ({ id: p.id as number, name: p.name as string })));
      }
    } catch { /* ignore */ }
  };

  const handleCreateBatch = async () => {
    if (!newBatch.planId || !newBatch.batchName) return;
    try {
      const res = await fetch('/api/training-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBatch),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewBatch({ planId: '', batchName: '', startDate: '', endDate: '' });
        fetchBatches();
      }
    } catch { /* ignore */ }
  };

  const batchStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    preparing: { label: '准备中', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
    in_progress: { label: '进行中', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
  };

  // 生成预警
  const alerts: Alert[] = [];
  batches.filter(b => b.status === 'in_progress').forEach(b => {
    (b.trainees || []).forEach(t => {
      if (t.overall_status === 'in_progress' && t.current_stage < 2 && b.start_date) {
        const daysSinceStart = Math.floor((Date.now() - new Date(b.start_date).getTime()) / 86400000);
        if (daysSinceStart > 14) {
          alerts.push({ id: `progress-${t.user_id}`, type: 'progress', message: `${t.users?.real_name || '新人'} 进度落后`, detail: `当前仍在阶段${t.current_stage}，已开训${daysSinceStart}天`, severity: 'high' });
        }
      }
    });
  });

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3" /><div className="h-3 bg-muted rounded w-2/3" /></div>)}</div>;
  }

  const activeBatches = batches.filter(b => b.status === 'in_progress');
  const totalTrainees = activeBatches.reduce((s, b) => s + b.traineeCount, 0);
  const avgAttendance = 87;
  const assignmentRate = 72;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '进行中期数', value: activeBatches.length, icon: BarChart3, color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10' },
          { label: '当期新人数', value: totalTrainees, icon: Users, color: 'text-[#102A43]', bg: 'bg-[#102A43]/10' },
          { label: '平均出勤率', value: `${avgAttendance}%`, icon: CheckCircle2, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
          { label: '作业完成率', value: `${assignmentRate}%`, icon: Clock, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-card rounded-lg shadow-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
            <h3 className="text-sm font-semibold text-foreground">预警项</h3>
            <span className="text-xs bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded">{alerts.length}</span>
          </div>
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-[#F8F6F0] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${a.severity === 'high' ? 'bg-red-500' : 'bg-[#f59e0b]'}`} />
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.message}</div>
                    <div className="text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                </div>
                <button className="flex items-center gap-1 text-xs text-[#2978B5] hover:underline">
                  <Send className="w-3 h-3" />提醒
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch list */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">培训批次</h3>
        <button
          onClick={() => { fetchPlans(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 bg-[#2978B5] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#2978B5]/90 transition"
        >
          <Plus className="w-4 h-4" />创建新期
        </button>
      </div>

      <div className="space-y-3">
        {batches.map(batch => {
          const cfg = batchStatusConfig[batch.status] || batchStatusConfig.preparing;
          const isExpanded = expandedBatch === batch.id;
          return (
            <div key={batch.id} className="bg-card rounded-lg shadow-card overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition"
                onClick={() => fetchBatchDetail(batch.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-lg font-bold text-foreground">{batch.batch_name}</div>
                  <span className={`text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{batch.traineeCount}人</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{batch.start_date || '待定'} ~ {batch.end_date || '待定'}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {isExpanded && batch.stages && (
                <div className="border-t border-border/40 p-4 space-y-4">
                  {batch.stages.map(stage => (
                    <div key={stage.id} className="bg-[#F8F6F0] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">阶段{stage.stage_number}：{stage.stage_name}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            {stage.schedule_mode === 'batch' ? '按期统一' : '带教安排'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>出勤率 <b className="text-foreground">{stage.attendanceRate}%</b></span>
                          <span>完成 <b className="text-foreground">{stage.completedDeliveries}/{stage.totalDeliveries}</b></span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-[#2978B5] rounded-full h-1.5 transition-all"
                          style={{ width: stage.totalDeliveries ? `${(stage.completedDeliveries / stage.totalDeliveries) * 100}%` : '0%' }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {stage.courses.map((sc: StageCourse) => (
                          <span key={sc.id} className="text-xs bg-white border border-border/40 px-2 py-1 rounded">
                            {sc.courses?.name || `课程${sc.course_id}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create batch modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">创建新培训期</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">培训计划</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={newBatch.planId}
                  onChange={e => setNewBatch(prev => ({ ...prev, planId: e.target.value }))}
                >
                  <option value="">选择培训计划</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">期数名称</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  placeholder="如：第3期"
                  value={newBatch.batchName}
                  onChange={e => setNewBatch(prev => ({ ...prev, batchName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">开始日期</label>
                  <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={newBatch.startDate} onChange={e => setNewBatch(prev => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">结束日期</label>
                  <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={newBatch.endDate} onChange={e => setNewBatch(prev => ({ ...prev, endDate: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">取消</button>
              <button onClick={handleCreateBatch} className="px-4 py-2 bg-[#2978B5] text-white rounded-lg text-sm font-medium hover:bg-[#2978B5]/90 transition">确认创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
