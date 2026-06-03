'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Calendar, Clock, MapPin, Users, Plus, ChevronRight, CheckCircle2, XCircle, UserPlus } from 'lucide-react';

interface Course {
  id: number;
  name: string;
  description: string;
  category: string;
  instructor: string;
  duration_hours: number;
  target_stage: number;
  is_active: boolean;
  sessions?: CourseSession[];
}

interface CourseSession {
  id: number;
  course_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_attendees: number;
  status: string;
  notes: string;
  attendee_count?: number;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'sessions' | 'attendance'>('courses');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      } else {
        setCourses(MOCK_COURSES);
      }
    } catch {
      setCourses(MOCK_COURSES);
    }
    setLoading(false);
  };

  const stageLabels: Record<number, string> = { 1: '阶段一', 2: '阶段二', 3: '阶段三' };
  const sessionStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    scheduled: { label: '待开课', color: 'text-primary', bg: 'bg-primary/10' },
    in_progress: { label: '进行中', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
    completed: { label: '已完成', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
    cancelled: { label: '已取消', color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3" /><div className="h-3 bg-muted rounded w-2/3" /></div>)}</div>;
  }

  const allSessions = courses.flatMap(c => (c.sessions || []).map(s => ({ ...s, courseName: c.name })));
  const upcomingSessions = allSessions.filter(s => s.status === 'scheduled').sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">课程管理</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" /> 新建课程
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '课程总数', value: courses.length, icon: GraduationCap, color: 'text-primary', bg: 'bg-primary/10' },
          { label: '待开课场次', value: upcomingSessions.length, icon: Calendar, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
          { label: '总课时', value: courses.reduce((s, c) => s + (c.duration_hours || 0), 0) + 'h', icon: Clock, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
          { label: '活跃讲师', value: new Set(courses.map(c => c.instructor)).size, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
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
        {(['courses', 'sessions', 'attendance'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'courses' ? '课程列表' : t === 'sessions' ? '课程场次' : '出勤记录'}
          </button>
        ))}
      </div>

      {/* Courses tab */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map(course => (
            <div key={course.id} className="bg-card rounded-lg shadow-card p-5 hover:shadow-card/80 transition cursor-pointer" onClick={() => setSelectedCourse(selectedCourse?.id === course.id ? null : course)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{course.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{stageLabels[course.target_stage] || `阶段${course.target_stage}`}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{course.category}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${course.is_active ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground'}`}>
                  {course.is_active ? '进行中' : '已结束'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.instructor}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_hours}课时</span>
                </div>
                <span className="flex items-center gap-1 text-primary">
                  {(course.sessions || []).length}场次 <ChevronRight className="w-3 h-3" />
                </span>
              </div>

              {/* Expanded sessions */}
              {selectedCourse?.id === course.id && (course.sessions || []).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">课程场次</h4>
                  {(course.sessions || []).map(session => {
                    const cfg = sessionStatusConfig[session.status] || sessionStatusConfig.scheduled;
                    return (
                      <div key={session.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium text-foreground">{session.session_date}</div>
                            <div className="text-xs text-muted-foreground">{session.start_time} - {session.end_time}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {session.location && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{session.location}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sessions tab */}
      {activeTab === 'sessions' && (
        <div className="bg-card rounded-lg shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wide">课程名称</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wide">日期</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wide">时间</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wide">地点</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wide">状态</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody>
              {allSessions.map(session => {
                const cfg = sessionStatusConfig[session.status] || sessionStatusConfig.scheduled;
                return (
                  <tr key={session.id} className="border-t border-border/30 hover:bg-muted/30">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{session.courseName}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{session.session_date}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{session.start_time}-{session.end_time}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{session.location || '-'}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span></td>
                    <td className="px-5 py-3">
                      <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <UserPlus className="w-3 h-3" />签到
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === 'attendance' && (
        <div className="bg-card rounded-lg shadow-card p-6 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">出勤统计功能开发中</p>
          <p className="text-xs text-muted-foreground mt-1">可在课程场次中点击"签到"记录出勤</p>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">新建课程</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">课程名称</label>
                <input className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary" placeholder="输入课程名称" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">课程描述</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary" rows={3} placeholder="输入课程描述" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">分类</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm">
                    <option>医学基础</option><option>技能实训</option><option>专业进阶</option><option>管理提升</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">讲师</label>
                  <input className="w-full border border-border rounded-lg px-3 py-2 text-sm" placeholder="讲师姓名" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">课时(小时)</label>
                  <input type="number" className="w-full border border-border rounded-lg px-3 py-2 text-sm" placeholder="8" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">适用阶段</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm">
                    <option value={1}>阶段一</option><option value={2}>阶段二</option><option value={3}>阶段三</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">取消</button>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">创建课程</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MOCK_COURSES: Course[] = [
  { id: 1, name: '糖尿病基础知识培训', description: '糖尿病分类、病因、症状及诊断标准', category: '医学基础', instructor: '吴培训', duration_hours: 8, target_stage: 1, is_active: true, sessions: [
    { id: 1, course_id: 1, session_date: '2025-06-15', start_time: '09:00', end_time: '12:00', location: '培训室A', max_attendees: 20, status: 'scheduled', notes: '', attendee_count: 5 },
    { id: 2, course_id: 1, session_date: '2025-06-16', start_time: '09:00', end_time: '12:00', location: '培训室A', max_attendees: 20, status: 'scheduled', notes: '', attendee_count: 4 },
  ]},
  { id: 2, name: '服务助理服务用语实训', description: '电话沟通服务用语、微信沟通技巧、场景模拟', category: '技能实训', instructor: '陈带教老师', duration_hours: 16, target_stage: 1, is_active: true, sessions: [
    { id: 3, course_id: 2, session_date: '2025-06-20', start_time: '14:00', end_time: '17:00', location: '演练室B', max_attendees: 10, status: 'scheduled', notes: '', attendee_count: 0 },
    { id: 4, course_id: 2, session_date: '2025-06-21', start_time: '14:00', end_time: '17:00', location: '演练室B', max_attendees: 10, status: 'scheduled', notes: '', attendee_count: 0 },
  ]},
  { id: 3, name: '用药指导专项培训', description: '常用降糖药机制、用药方案、不良反应处理', category: '专业进阶', instructor: '周带教老师', duration_hours: 12, target_stage: 2, is_active: true, sessions: [
    { id: 5, course_id: 3, session_date: '2025-06-25', start_time: '09:00', end_time: '12:00', location: '培训室A', max_attendees: 15, status: 'scheduled', notes: '', attendee_count: 0 },
    { id: 6, course_id: 3, session_date: '2025-06-26', start_time: '09:00', end_time: '12:00', location: '培训室A', max_attendees: 15, status: 'scheduled', notes: '', attendee_count: 0 },
  ]},
  { id: 4, name: '患者管理高级课程', description: '复诊管理、用药依从性提升、数据驱动管理', category: '管理提升', instructor: '郑管理', duration_hours: 8, target_stage: 3, is_active: true },
];
