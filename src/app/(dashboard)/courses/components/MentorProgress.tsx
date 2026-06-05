'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, ChevronDown, ChevronUp, Calendar, Clock, Plus, AlertTriangle } from 'lucide-react';

interface Trainee {
  id: number;
  user_id: string;
  batch_id: number;
  current_stage: number;
  overall_status: string;
  mentor_id: string;
  realName: string;
  username: string;
  batchName: string;
  progress: number;
  deliveries: DeliveryItem[];
}

interface DeliveryItem {
  id: number;
  course_id: number;
  courseName: string;
  status: string;
  scheduled_date: string;
  assignment_score: number;
  assignment_feedback: string;
}

export function MentorProgress() {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ deliveryId: 0, userId: '', courseId: 0, scheduledDate: '', note: '' });

  const fetchTrainees = useCallback(async () => {
    try {
      const res = await fetch('/api/course-deliveries?view=mentor');
      if (res.ok) {
        const data = await res.json();
        setTrainees(data.trainees || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrainees(); }, [fetchTrainees]);

  const filtered = trainees.filter(t => {
    if (filterStage !== 'all') {
      if (filterStage === 'stage2' && t.current_stage !== 2) return false;
      if (filterStage === 'stage3' && t.current_stage !== 3) return false;
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'normal' && t.progress < 60) return false;
      if (filterStatus === 'behind' && (t.progress >= 30 && t.progress < 60)) return false;
      if (filterStatus === 'critical' && t.progress >= 60) return false;
    }
    return true;
  });

  const getStatusStyle = (progress: number) => {
    if (progress >= 60) return { label: '正常', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', bar: 'bg-[#22c55e]' };
    if (progress >= 30) return { label: '进度落后', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', bar: 'bg-[#f59e0b]' };
    return { label: '严重落后', color: 'text-red-500', bg: 'bg-red-500/10', bar: 'bg-red-500' };
  };

  const handleScheduleProgress = async () => {
    if (!scheduleForm.scheduledDate || !scheduleForm.deliveryId) return;
    try {
      await fetch('/api/course-deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scheduleForm.deliveryId, scheduledDate: scheduleForm.scheduledDate, status: 'scheduled' }),
      });
      setShowScheduleModal(false);
      fetchTrainees();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3" /></div>)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-muted rounded-lg p-1">
          {['all', 'stage2', 'stage3'].map(v => (
            <button key={v} onClick={() => setFilterStage(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filterStage === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {v === 'all' ? '全部阶段' : v === 'stage2' ? '阶段二' : '阶段三'}
            </button>
          ))}
        </div>
        <div className="flex bg-muted rounded-lg p-1">
          {['all', 'normal', 'behind', 'critical'].map(v => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filterStatus === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {v === 'all' ? '全部' : v === 'normal' ? '正常' : v === 'behind' ? '进度落后' : '严重落后'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} 位新人</span>
      </div>

      {/* Trainee cards */}
      <div className="space-y-3">
        {filtered.map(t => {
          const status = getStatusStyle(t.progress);
          const isExpanded = expandedTrainee === t.user_id;
          return (
            <div key={t.user_id} className="bg-card rounded-lg shadow-card overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition"
                onClick={() => setExpandedTrainee(isExpanded ? null : t.user_id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#2978B5]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#2978B5]">{t.realName?.charAt(0) || '?'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{t.realName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.color}`}>{status.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      阶段{t.current_stage} · {t.batchName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-1.5">
                      <div className={`rounded-full h-1.5 transition-all ${status.bar}`} style={{ width: `${t.progress}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${status.color}`}>{t.progress}%</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border/30 p-4 space-y-4">
                  {/* Course progress table */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2">课程进度</h4>
                    <div className="space-y-2">
                      {t.deliveries.map(d => {
                        const dStatus: Record<string, { label: string; color: string }> = {
                          pending: { label: '待安排', color: 'text-muted-foreground' },
                          scheduled: { label: '已排课', color: 'text-[#2978B5]' },
                          completed: { label: '已完成', color: 'text-[#22c55e]' },
                        };
                        const ds = dStatus[d.status] || dStatus.pending;
                        return (
                          <div key={d.id} className="flex items-center justify-between bg-[#F8F6F0] rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-foreground">{d.courseName}</span>
                              <span className={`text-xs ${ds.color}`}>{ds.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {d.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{d.scheduled_date}</span>}
                              {d.assignment_score > 0 && <span className="flex items-center gap-1 font-medium text-foreground"><span>评分</span>{d.assignment_score}</span>}
                              {d.status === 'pending' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setScheduleForm({ deliveryId: d.id, userId: t.user_id, courseId: d.course_id, scheduledDate: '', note: '' }); setShowScheduleModal(true); }}
                                  className="bg-[#2978B5] text-white px-2 py-0.5 rounded text-xs hover:bg-[#2978B5]/90"
                                >
                                  安排进度
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assignment summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '已提交', value: t.deliveries.filter(d => d.assignment_score > 0).length, color: 'text-[#22c55e]' },
                      { label: '未提交', value: t.deliveries.filter(d => d.status === 'pending').length, color: 'text-muted-foreground' },
                      { label: '待点评', value: t.deliveries.filter(d => d.status === 'completed' && !d.assignment_score).length, color: 'text-[#f59e0b]' },
                    ].map((s, i) => (
                      <div key={i} className="bg-[#F8F6F0] rounded-lg p-3 text-center">
                        <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-card rounded-lg shadow-card p-8 text-center">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">暂无学员数据</p>
        </div>
      )}

      {/* Schedule modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">安排进度</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">上课日期</label>
                <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={scheduleForm.scheduledDate} onChange={e => setScheduleForm(prev => ({ ...prev, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">备注</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" rows={2}
                  value={scheduleForm.note} onChange={e => setScheduleForm(prev => ({ ...prev, note: e.target.value }))} placeholder="可选" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
              <button onClick={handleScheduleProgress} className="px-4 py-2 bg-[#2978B5] text-white rounded-lg text-sm font-medium">确认安排</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
