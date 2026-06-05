'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Calendar, Clock, FileText, Star, Hash, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface TraineeView {
  batchName: string;
  currentStage: number;
  stageName: string;
  stages: StageInfo[];
  upcomingCourses: UpcomingCourse[];
  pendingAssignments: AssignmentItem[];
  reviewedAssignments: AssignmentItem[];
}

interface StageInfo {
  stageNumber: number;
  stageName: string;
  scheduleMode: string;
  totalCourses: number;
  completedCourses: number;
  status: 'current' | 'upcoming' | 'completed';
}

interface UpcomingCourse {
  id: number;
  courseName: string;
  teacherName: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  status: string;
  attendanceStatus: string;
}

interface AssignmentItem {
  id: number;
  courseName: string;
  title: string;
  dueDate: string;
  status: string;
  score: number;
  feedback: string;
  feedbackExpanded: boolean;
}

export function TraineeLearning() {
  const [data, setData] = useState<TraineeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinInput, setCheckinInput] = useState('');
  const [checkinError, setCheckinError] = useState('');
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/course-deliveries?view=trainee');
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckin = async () => {
    if (checkinInput.length !== 6) {
      setCheckinError('请输入6位签到码');
      return;
    }
    try {
      const res = await fetch('/api/course-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkIn', code: checkinInput }),
      });
      if (res.ok) {
        setCheckinSuccess(true);
        setTimeout(() => {
          setShowCheckinModal(false);
          setCheckinInput('');
          setCheckinSuccess(false);
          fetchData();
        }, 1200);
      } else {
        const d = await res.json();
        setCheckinError(d.error || '签到码无效');
      }
    } catch {
      setCheckinError('签到失败，请重试');
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3" /></div>)}</div>;
  }

  if (!data) {
    return (
      <div className="bg-card rounded-lg shadow-card p-8 text-center">
        <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">暂无培训计划</p>
      </div>
    );
  }

  const totalCourses = data.stages.reduce((s, st) => s + st.totalCourses, 0);
  const completedCourses = data.stages.reduce((s, st) => s + st.completedCourses, 0);
  const overallProgress = totalCourses ? Math.round((completedCourses / totalCourses) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{data.batchName}</span>
              <span className="text-xs bg-[#2978B5]/10 text-[#2978B5] px-2 py-0.5 rounded">阶段{data.currentStage} · {data.stageName}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              已完成 {completedCourses}/{totalCourses} 门课程
            </div>
          </div>
          <button
            onClick={() => { setCheckinInput(''); setCheckinError(''); setShowCheckinModal(true); }}
            className="flex items-center gap-1.5 bg-[#2978B5] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#2978B5]/90 transition"
          >
            <Hash className="w-4 h-4" />输入签到码
          </button>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-[#2978B5] rounded-full h-2 transition-all" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="text-xs text-right text-muted-foreground mt-1">{overallProgress}%</div>
      </div>

      {/* Stage indicators */}
      <div className="grid grid-cols-3 gap-3">
        {data.stages.map(stage => (
          <div key={stage.stageNumber} className={`bg-card rounded-lg shadow-card p-4 border-l-4 ${stage.status === 'current' ? 'border-l-[#2978B5]' : stage.status === 'completed' ? 'border-l-[#22c55e]' : 'border-l-muted'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">阶段{stage.stageNumber}</span>
              {stage.status === 'current' && <span className="text-xs bg-[#2978B5]/10 text-[#2978B5] px-2 py-0.5 rounded">进行中</span>}
              {stage.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />}
            </div>
            <div className="text-xs text-muted-foreground mb-2">{stage.stageName}</div>
            <div className="w-full bg-muted rounded-full h-1">
              <div className={`rounded-full h-1 ${stage.status === 'current' ? 'bg-[#2978B5]' : stage.status === 'completed' ? 'bg-[#22c55e]' : 'bg-muted-foreground/20'}`}
                style={{ width: stage.totalCourses ? `${(stage.completedCourses / stage.totalCourses) * 100}%` : '0%' }} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">{stage.completedCourses}/{stage.totalCourses} 门</div>
          </div>
        ))}
      </div>

      {/* Upcoming courses */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#2978B5]" />近期课程
        </h3>
        <div className="space-y-2">
          {data.upcomingCourses.map((c, i) => {
            const statusCfg: Record<string, { label: string; color: string }> = {
              completed: { label: '已完成', color: 'text-[#22c55e]' },
              scheduled: { label: '已排课', color: 'text-[#2978B5]' },
              in_progress: { label: '待上课', color: 'text-[#f59e0b]' },
            };
            const s = statusCfg[c.status] || statusCfg.scheduled;
            const attCfg: Record<string, { label: string; color: string }> = {
              present: { label: '出勤', color: 'text-[#22c55e]' },
              late: { label: '迟到', color: 'text-[#f59e0b]' },
              absent: { label: '缺勤', color: 'text-red-500' },
            };
            return (
              <div key={i} className="flex items-center justify-between bg-[#F8F6F0] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground w-16">{c.scheduledDate}</div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{c.courseName}</div>
                    <div className="text-xs text-muted-foreground">{c.teacherName} · {c.scheduledTime || '待定'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.attendanceStatus && attCfg[c.attendanceStatus] && (
                    <span className={`text-xs ${attCfg[c.attendanceStatus].color}`}>{attCfg[c.attendanceStatus].label}</span>
                  )}
                  <span className={`text-xs ${s.color}`}>{s.label}</span>
                </div>
              </div>
            );
          })}
          {data.upcomingCourses.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">暂无近期课程</div>
          )}
        </div>
      </div>

      {/* Pending assignments */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#f59e0b]" />待完成作业
          {data.pendingAssignments.length > 0 && <span className="text-xs bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded">{data.pendingAssignments.length}</span>}
        </h3>
        <div className="space-y-2">
          {data.pendingAssignments.map(a => {
            const isOverdue = a.dueDate && new Date(a.dueDate) < new Date();
            return (
              <div key={a.id} className={`flex items-center justify-between rounded-lg p-3 ${isOverdue ? 'bg-[#f59e0b]/5 border-l-2 border-[#f59e0b]' : 'bg-[#F8F6F0]'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{a.courseName}</span>
                    {isOverdue && <span className="text-xs text-[#f59e0b]">逾期</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.title} · 截止 {a.dueDate}</div>
                </div>
                <span className={`text-xs ${a.status === 'submitted' ? 'text-muted-foreground' : 'text-[#2978B5]'}`}>
                  {a.status === 'submitted' ? '已提交待点评' : '待提交'}
                </span>
              </div>
            );
          })}
          {data.pendingAssignments.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">暂无待完成作业</div>
          )}
        </div>
      </div>

      {/* Reviewed assignments */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-[#22c55e]" />已点评作业
        </h3>
        <div className="space-y-2">
          {data.reviewedAssignments.map(a => {
            const scoreColor = a.score >= 90 ? 'text-[#22c55e]' : a.score >= 70 ? 'text-[#2978B5]' : 'text-[#f59e0b]';
            const isExpanded = expandedFeedback === a.id;
            return (
              <div key={a.id} className="bg-[#F8F6F0] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{a.courseName}</span>
                    <span className="text-xs text-muted-foreground ml-2">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${scoreColor}`}>{a.score}</span>
                    <button onClick={() => setExpandedFeedback(isExpanded ? null : a.id)} className="text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {a.feedback && (
                  <div className="text-xs text-muted-foreground mt-1">{isExpanded ? a.feedback : a.feedback.substring(0, 50) + (a.feedback.length > 50 ? '...' : '')}</div>
                )}
              </div>
            );
          })}
          {data.reviewedAssignments.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">暂无已点评作业</div>
          )}
        </div>
      </div>

      {/* Checkin modal */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCheckinModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4 text-center">签到</h2>
            {checkinSuccess ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-[#22c55e] mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium">签到成功！</p>
              </div>
            ) : (
              <div>
                <input
                  className="w-full border border-border rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] bg-background"
                  placeholder="------"
                  maxLength={6}
                  value={checkinInput}
                  onChange={e => { setCheckinInput(e.target.value.replace(/\D/g, '')); setCheckinError(''); }}
                />
                {checkinError && <p className="text-xs text-red-500 mt-2 text-center">{checkinError}</p>}
                <button onClick={handleCheckin} className="w-full mt-4 bg-[#2978B5] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#2978B5]/90 transition">
                  确认签到
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
