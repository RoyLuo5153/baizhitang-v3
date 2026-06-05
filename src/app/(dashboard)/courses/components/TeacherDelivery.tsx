'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, QrCode, FileText, Star, CheckCircle2, Users, Hash } from 'lucide-react';

interface Delivery {
  id: number;
  batch_id: number;
  stage_id: number;
  course_id: number;
  user_id: string;
  teacher_id: string;
  schedule_mode: string;
  status: string;
  scheduled_date: string;
  attendance_status: string;
  assignment_score: number;
  assignment_feedback: string;
  assignment_content: string;
  assignment_submitted_at: string;
  traineeName: string;
  teacherName: string;
  courses: { name: string; category: string };
  plan_stages: { stage_name: string; schedule_mode: string };
}

export function TeacherDelivery() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'checkin' | 'assignments'>('courses');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [checkinCode, setCheckinCode] = useState('');
  const [checkinCountdown, setCheckinCountdown] = useState(300);
  const [scheduleForm, setScheduleForm] = useState({ deliveryId: 0, scheduledDate: '', location: '' });
  const [homeworkForm, setHomeworkForm] = useState({ deliveryId: 0, title: '', description: '', dueDate: '' });
  const [reviewForm, setReviewForm] = useState({ deliveryId: 0, score: 0, feedback: '' });

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch('/api/course-deliveries?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  // 课程按阶段分组
  const groupedCourses = deliveries.reduce((acc, d) => {
    const key = `${d.stage_id}-${d.plan_stages?.stage_name || '未知阶段'}`;
    if (!acc[key]) acc[key] = { stageId: d.stage_id, stageName: d.plan_stages?.stage_name || '', deliveries: [] };
    acc[key].deliveries.push(d);
    return acc;
  }, {} as Record<string, { stageId: number; stageName: string; deliveries: Delivery[] }>);

  const pendingReview = deliveries.filter(d => d.assignment_content && !d.assignment_score);
  const reviewed = deliveries.filter(d => d.assignment_score);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待排课', color: 'text-muted-foreground', bg: 'bg-muted' },
    scheduled: { label: '已排课', color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10' },
    in_progress: { label: '进行中', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
  };

  const handleSchedule = async () => {
    if (!scheduleForm.scheduledDate) return;
    try {
      await fetch('/api/course-deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scheduleForm.deliveryId, scheduledDate: scheduleForm.scheduledDate, status: 'scheduled' }),
      });
      setShowScheduleModal(false);
      fetchDeliveries();
    } catch { /* ignore */ }
  };

  const handleGenerateCode = async (deliveryIds: number[]) => {
    try {
      const res = await fetch('/api/course-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateCode', deliveryIds }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckinCode(data.code);
        setCheckinCountdown(300);
        setShowCheckinModal(true);
      }
    } catch { /* ignore */ }
  };

  const handleManualCheckin = async (deliveryId: number, status: string) => {
    try {
      await fetch('/api/course-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manualCheckIn', deliveryId, attendanceStatus: status }),
      });
      fetchDeliveries();
    } catch { /* ignore */ }
  };

  const handleReviewSubmit = async () => {
    if (!reviewForm.score) return;
    try {
      await fetch('/api/course-deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reviewForm.deliveryId,
          assignmentScore: reviewForm.score,
          assignmentFeedback: reviewForm.feedback,
        }),
      });
      setShowReviewModal(false);
      fetchDeliveries();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!showCheckinModal || checkinCountdown <= 0) return;
    const timer = setInterval(() => setCheckinCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [showCheckinModal, checkinCountdown]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3" /></div>)}</div>;
  }

  const pendingSchedule = deliveries.filter(d => d.status === 'pending').length;
  const inProgressCount = deliveries.filter(d => d.status === 'in_progress' || d.status === 'scheduled').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '待排课', value: pendingSchedule, icon: Calendar, color: 'text-muted-foreground', bg: 'bg-muted' },
          { label: '进行中', value: inProgressCount, icon: Clock, color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10' },
          { label: '待点评作业', value: pendingReview.length, icon: FileText, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
          { label: '平均出勤率', value: '92%', icon: Users, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
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

      {/* Tabs */}
      <div className="flex bg-muted rounded-lg p-1 w-fit">
        {(['courses', 'checkin', 'assignments'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'courses' ? '被指派课程' : t === 'checkin' ? '签到管理' : '作业管理'}
          </button>
        ))}
      </div>

      {/* Courses tab */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          {Object.entries(groupedCourses).map(([key, group]) => (
            <div key={key} className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="bg-[#102A43]/5 px-5 py-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-[#102A43]">{group.stageName}</span>
              </div>
              <div className="divide-y divide-border/30">
                {group.deliveries.map(d => {
                  const cfg = statusConfig[d.status] || statusConfig.pending;
                  return (
                    <div key={d.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">{d.courses?.name || '未知课程'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {d.traineeName} · {d.scheduled_date || '待排课'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {d.status === 'pending' && (
                          <button
                            onClick={() => { setScheduleForm({ deliveryId: d.id, scheduledDate: '', location: '' }); setShowScheduleModal(true); }}
                            className="text-xs bg-[#2978B5] text-white px-2.5 py-1 rounded hover:bg-[#2978B5]/90 transition"
                          >
                            排课
                          </button>
                        )}
                        {d.status === 'scheduled' && (
                          <button
                            onClick={() => handleGenerateCode([d.id])}
                            className="text-xs bg-[#102A43] text-white px-2.5 py-1 rounded hover:bg-[#102A43]/90 transition"
                          >
                            签到码
                          </button>
                        )}
                        {d.status !== 'pending' && (
                          <button
                            onClick={() => { setHomeworkForm({ deliveryId: d.id, title: '', description: '', dueDate: '' }); setShowHomeworkModal(true); }}
                            className="text-xs bg-[#f59e0b]/10 text-[#f59e0b] px-2.5 py-1 rounded hover:bg-[#f59e0b]/20 transition"
                          >
                            布置作业
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkin tab */}
      {activeTab === 'checkin' && (
        <div className="bg-card rounded-lg shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">签到管理</h3>
          <div className="space-y-3">
            {deliveries.filter(d => d.status === 'scheduled' || d.status === 'in_progress').map(d => {
              const attCfg: Record<string, { label: string; color: string }> = {
                present: { label: '已签到', color: 'text-[#22c55e]' },
                late: { label: '迟到', color: 'text-[#f59e0b]' },
                leave: { label: '请假', color: 'text-[#2978B5]' },
                absent: { label: '缺勤', color: 'text-red-500' },
              };
              const att = attCfg[d.attendance_status || ''] || { label: '未签到', color: 'text-muted-foreground' };
              return (
                <div key={d.id} className="flex items-center justify-between bg-[#F8F6F0] rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{d.traineeName}</span>
                    <span className="text-xs text-muted-foreground">{d.courses?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${att.color}`}>{att.label}</span>
                    {!d.attendance_status && (
                      <button onClick={() => handleManualCheckin(d.id, 'present')} className="text-xs bg-[#22c55e]/10 text-[#22c55e] px-2 py-0.5 rounded hover:bg-[#22c55e]/20">签到</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignments tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex bg-muted rounded-lg p-1 w-fit">
            <button onClick={() => setActiveTab('assignments')} className="px-4 py-1.5 text-sm font-medium rounded-md bg-card text-foreground shadow-sm">
              待点评 ({pendingReview.length})
            </button>
            <button className="px-4 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground">
              已点评 ({reviewed.length})
            </button>
          </div>
          <div className="space-y-2">
            {pendingReview.map(d => (
              <div key={d.id} className="bg-card rounded-lg shadow-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.traineeName} - {d.courses?.name}</div>
                  <div className="text-xs text-muted-foreground">已提交 · {d.assignment_submitted_at ? new Date(d.assignment_submitted_at).toLocaleDateString() : ''}</div>
                </div>
                <button
                  onClick={() => { setReviewForm({ deliveryId: d.id, score: 0, feedback: '' }); setShowReviewModal(true); setSelectedDelivery(d); }}
                  className="text-xs bg-[#2978B5] text-white px-3 py-1.5 rounded hover:bg-[#2978B5]/90 transition"
                >
                  点评
                </button>
              </div>
            ))}
            {pendingReview.length === 0 && (
              <div className="bg-card rounded-lg shadow-card p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">暂无待点评作业</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">排课</h2>
            <p className="text-xs text-[#2978B5] bg-[#2978B5]/10 rounded px-2 py-1 mb-4">排课直接生效，无需审批。系统自动同步给新人和培训负责人。</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">上课日期</label>
                <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={scheduleForm.scheduledDate} onChange={e => setScheduleForm(prev => ({ ...prev, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">地点</label>
                <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={scheduleForm.location} onChange={e => setScheduleForm(prev => ({ ...prev, location: e.target.value }))} placeholder="培训室A" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
              <button onClick={handleSchedule} className="px-4 py-2 bg-[#2978B5] text-white rounded-lg text-sm font-medium hover:bg-[#2978B5]/90">确认排课</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkin modal */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCheckinModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md p-6 text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">签到码</h2>
            <div className="bg-[#102A43] rounded-xl p-6 mb-4">
              <div className="text-4xl font-mono font-bold text-white tracking-[0.3em]">{checkinCode}</div>
            </div>
            <div className="text-sm text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-1" />
              剩余 {Math.floor(checkinCountdown / 60)}:{(checkinCountdown % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground mt-2">请通知新人输入此签到码</p>
            <button onClick={() => setShowCheckinModal(false)} className="mt-4 px-4 py-2 bg-muted text-foreground rounded-lg text-sm">关闭</button>
          </div>
        </div>
      )}

      {/* Homework modal */}
      {showHomeworkModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowHomeworkModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">布置作业</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">作业标题</label>
                <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={homeworkForm.title} onChange={e => setHomeworkForm(prev => ({ ...prev, title: e.target.value }))} placeholder="课后作业标题" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">作业要求</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" rows={3}
                  value={homeworkForm.description} onChange={e => setHomeworkForm(prev => ({ ...prev, description: e.target.value }))} placeholder="描述作业要求..." />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">截止日期</label>
                <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={homeworkForm.dueDate} onChange={e => setHomeworkForm(prev => ({ ...prev, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowHomeworkModal(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
              <button onClick={() => setShowHomeworkModal(false)} className="px-4 py-2 bg-[#f59e0b] text-white rounded-lg text-sm font-medium">确认布置</button>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowReviewModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">作业点评</h2>
            {selectedDelivery && (
              <div className="bg-[#F8F6F0] rounded-lg p-3 mb-4">
                <div className="text-sm font-medium text-foreground">{selectedDelivery.traineeName} - {selectedDelivery.courses?.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{selectedDelivery.assignment_content}</div>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">评分 (0-100)</label>
                <input type="number" min={0} max={100} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={reviewForm.score} onChange={e => setReviewForm(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))} />
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className={`rounded-full h-2 transition-all ${reviewForm.score >= 90 ? 'bg-[#22c55e]' : reviewForm.score >= 70 ? 'bg-[#2978B5]' : 'bg-[#f59e0b]'}`}
                    style={{ width: `${reviewForm.score}%` }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">点评内容</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" rows={3}
                  value={reviewForm.feedback} onChange={e => setReviewForm(prev => ({ ...prev, feedback: e.target.value }))} placeholder="写下你的点评..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
              <button onClick={handleReviewSubmit} className="px-4 py-2 bg-[#2978B5] text-white rounded-lg text-sm font-medium">提交点评</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
