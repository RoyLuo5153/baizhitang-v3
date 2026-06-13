'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, AlertTriangle, Plus, Loader2, Archive, GraduationCap, CheckCircle, XCircle,
  Clock, Search, Filter, ChevronDown, ChevronUp, X, Activity, Zap, RotateCw, FileCheck,
} from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/context';

// === Types ===

interface MonthlyData {
  month_key?: string;
  resource_count?: number;
  reception_rate?: number;
  avg_price?: number;
  is_qualified?: boolean;
  data_type?: string;
}

interface TraineeProfile {
  user_id: string;
  real_name: string;
  username: string;
  hire_date: string;
  expected_group_date: string;
  group_date: string | null;
  department: string;
  position: string;
  phone: string;
  mentor_id: string | null;
  mentor_name: string | null;
  profile_status: string;
  remark: string;
  cohort: string;
  passed_levels: number;
  completed_tasks: number;
  open_weaknesses: number;
  monthly_data: Record<string, MonthlyData>;
  user_status: string;
  created_at: string;
  qualification_period_days: number;
  qualification_deadline: string | null;
  is_overdue: boolean;
  overdue_days: number;
  // 出师相关
  graduation_date?: string | null;
  graduation_confirmed_by?: string | null;
  // 阶段和闯关
  stage?: number;
  total_levels?: number;
}

interface EventItem {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  happened_at: string;
  actor_name?: string;
}

interface MentorOption {
  id: string;
  real_name: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  training: { label: '在培训', color: '#2978B5' },
  assigned: { label: '下组', color: '#22c55e' },
  rotating: { label: '轮组', color: '#F59E0B' },
  resigned: { label: '离职', color: '#94a3b8' },
};

const DEPARTMENTS = [
  '糖尿病管理一部',
  '糖尿病管理二部',
  '糖尿病管理三部',
  '慢病管理部',
  '健康管理部',
  '运营部',
];

const POSITIONS = [
  '服务助理',
  '高级顾问',
  '健康管理师',
  '健康顾问',
  '慢病管理师',
];

const MONTH_HEADERS = [
  { label: '入职当月', cols: 5, color: '#2978B5', subHeaders: ['月份', '资源数', '接诊率', '均价', '达标'] },
  { label: '入职第二月', cols: 5, color: '#2978B5', subHeaders: ['月份', '资源数', '接诊率', '均价', '达标'] },
  { label: '下组第1月', cols: 4, color: '#22c55e', subHeaders: ['月份', '资源数', '接诊率', '诊单价'] },
  { label: '下组第2月', cols: 4, color: '#22c55e', subHeaders: ['月份', '资源数', '接诊率', '诊单价'] },
  { label: '下组第3月', cols: 4, color: '#22c55e', subHeaders: ['月份', '资源数', '接诊率', '诊单价'] },
];

export default function TraineeProfilesPage() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<TraineeProfile[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [graduationChecks, setGraduationChecks] = useState<Record<string, { eligible: boolean; missingConditions: string[]; checking: boolean }>>({});
  const [graduating, setGraduating] = useState<string | null>(null);
  const [showGraduationModal, setShowGraduationModal] = useState<{ userId: string; name: string } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<TraineeProfile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [eventDays, setEventDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'training' | 'graduated'>('training');
  const [newTrainee, setNewTrainee] = useState({
    username: '', real_name: '', password: 'bt2026',
    department: '', position: '', mentor_id: '',
  });

  const fetchProfiles = useCallback(async () => {
    const result = await apiGet<{ trainees: Record<string, unknown>[] }>('/api/trainee-profiles', { trainees: [] });
    setProfiles(result.trainees.map((p) => ({
      user_id: String(p.id),
      real_name: (p.realName as string) || '',
      username: (p.username as string) || '',
      hire_date: (p.hireDate as string) || '',
      expected_group_date: (p.expectedGroupDate as string) || '',
      group_date: (p.groupDate as string) || null,
      department: (p.department as string) || '',
      position: (p.position as string) || '',
      phone: '',
      mentor_id: (p.mentorId as string) || null,
      mentor_name: (p.mentorName as string) || null,
      profile_status: (p.profileStatus as string) || 'training',
      remark: (p.remarks as string) || '',
      cohort: (p.cohort as string) || '',
      passed_levels: 0,
      completed_tasks: 0,
      open_weaknesses: 0,
      monthly_data: {},
      user_status: 'active',
      created_at: '',
      qualification_period_days: (p.qualificationPeriodDays as number) || 90,
      qualification_deadline: (p.qualificationDeadline as string) || null,
      is_overdue: (p.isOverdue as boolean) || false,
      overdue_days: (p.overdueDays as number) || 0,
    })));
    setLoading(false);
  }, []);

  const fetchMentors = useCallback(async () => {
    const result = await apiGet<{ users: { id: string; realName: string }[] }>('/api/users?roleId=2', { users: [] });
    setMentors(result.users.map((u) => ({
      id: u.id,
      real_name: u.realName,
    })));
  }, []);

  useEffect(() => { fetchProfiles(); fetchMentors(); }, [fetchProfiles, fetchMentors]);

  const updateProfile = async (userId: string, field: string, value: string) => {
    setSaving(userId + field);
    try {
      await fetch('/api/trainee-profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      });
      // Update local state
      setProfiles(prev => prev.map(p => {
        if (p.user_id !== userId) return p;
        if (field === 'status') return { ...p, profile_status: value };
        if (field === 'mentor_id') {
          const mentor = mentors.find(m => m.id === value);
          return { ...p, mentor_id: value, mentor_name: mentor?.real_name || null };
        }
        if (field === 'cohort') return { ...p, cohort: value };
        return { ...p, [field]: value };
      }));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const updateMonthly = async (userId: string, monthIndex: number, field: string, value: string | number | boolean) => {
    try {
      await fetch('/api/trainee-monthly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, monthIndex, field, value }),
      });
    } catch { /* ignore */ }
  };

  const addTrainee = async () => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTrainee,
          role: 'trainee',
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewTrainee({ username: '', real_name: '', password: 'bt2026', department: '', position: '', mentor_id: '' });
        fetchProfiles();
      }
    } catch { /* ignore */ }
  };

  // Fetch events for selected profile
  const fetchEvents = async (userId: string) => {
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/events?user_id=${userId}&days=${eventDays}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch { setEvents([]); }
    setEventsLoading(false);
  };

  const handleSelectProfile = (p: TraineeProfile) => {
    setSelectedProfile(p);
    fetchEvents(p.user_id);
  };

  // Check graduation eligibility
  const checkGraduation = async (userId: string) => {
    setGraduationChecks(prev => ({ ...prev, [userId]: { eligible: false, missingConditions: [], checking: true } }));
    try {
      const res = await fetch(`/api/graduation?userId=${userId}`);
      const data = await res.json();
      setGraduationChecks(prev => ({
        ...prev,
        [userId]: { eligible: data.eligible, missingConditions: data.missingConditions || [], checking: false },
      }));
    } catch {
      setGraduationChecks(prev => ({ ...prev, [userId]: { eligible: false, missingConditions: ['检查失败'], checking: false } }));
    }
  };

  // Confirm graduation
  const confirmGraduation = async (userId: string) => {
    setGraduating(userId);
    try {
      const res = await fetch('/api/graduation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowGraduationModal(null);
        fetchProfiles();
      } else {
        alert(data.message || '出师失败');
      }
    } catch {
      alert('出师请求失败');
    }
    setGraduating(null);
  };

  const isManager = currentUser?.role === 'training_manager' || currentUser?.role === 'boss';

  // Filter profiles based on active tab
  const filteredProfiles = profiles.filter(p => {
    if (activeTab === 'training') {
      return !p.graduation_date; // 在培新人（未出师）
    } else {
      return !!p.graduation_date; // 已出师新人
    }
  });

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const renderDateInput = (field: string, userId: string, currentValue: string, placeholder: string) => {
    const dateVal = formatDate(currentValue);
    return (
      <input
        type="date"
        className="w-full text-xs px-1 py-1 border border-border rounded bg-background text-foreground"
        value={dateVal}
        placeholder={placeholder}
        onChange={(e) => updateProfile(userId, field, e.target.value)}
      />
    );
  };

  const renderSelect = (
    field: string,
    userId: string,
    currentValue: string,
    options: { value: string; label: string }[],
    placeholder: string,
  ) => (
    <select
      className="w-full text-xs px-1 py-1 border border-border rounded bg-background text-foreground"
      value={currentValue || ''}
      onChange={(e) => updateProfile(userId, field, e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  const renderMonthlyCell = (userId: string, monthIndex: number, md: MonthlyData | undefined, type: 'training' | 'assigned') => {
    if (!md) md = {} as MonthlyData;
    const isTraining = type === 'training';

    return (
      <>
        <td className="px-1 py-1 text-center border-b border-r border-border">
          <input
            type="text"
            className="w-full text-xs text-center px-0.5 py-0.5 border border-transparent hover:border-border rounded bg-transparent"
            defaultValue={md.month_key || ''}
            placeholder="2026-05"
            onBlur={(e) => updateMonthly(userId, monthIndex, 'month_key', e.target.value)}
          />
        </td>
        <td className="px-1 py-1 text-center border-b border-r border-border">
          <input
            type="number"
            className="w-full text-xs text-center px-0.5 py-0.5 border border-transparent hover:border-border rounded bg-transparent"
            defaultValue={md.resource_count || ''}
            placeholder="0"
            onBlur={(e) => updateMonthly(userId, monthIndex, 'resource_count', Number(e.target.value) || 0)}
          />
        </td>
        <td className="px-1 py-1 text-center border-b border-r border-border">
          <input
            type="number"
            step="0.1"
            className="w-full text-xs text-center px-0.5 py-0.5 border border-transparent hover:border-border rounded bg-transparent"
            defaultValue={md.reception_rate || ''}
            placeholder="0"
            onBlur={(e) => updateMonthly(userId, monthIndex, 'reception_rate', Number(e.target.value) || 0)}
          />
        </td>
        <td className="px-1 py-1 text-center border-b border-r border-border">
          <input
            type="number"
            step="0.01"
            className="w-full text-xs text-center px-0.5 py-0.5 border border-transparent hover:border-border rounded bg-transparent"
            defaultValue={md.avg_price || ''}
            placeholder="0"
            onBlur={(e) => updateMonthly(userId, monthIndex, 'avg_price', Number(e.target.value) || 0)}
          />
        </td>
        {isTraining && (
          <td className="px-1 py-1 text-center border-b border-r border-border">
            <span className={`inline-block w-4 h-4 rounded-full ${md.is_qualified ? 'bg-[#22c55e]' : 'bg-[#ef4444]/40'}`} />
          </td>
        )}
      </>
    );
  };

  const total = filteredProfiles.length;
  const trainingCount = filteredProfiles.filter(p => p.profile_status === 'training').length;
  const assignedCount = filteredProfiles.filter(p => p.profile_status === 'assigned').length;
  const graduatedCount = profiles.filter(p => p.graduation_date).length;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">新人档案管理</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">完整业务数据追踪表格</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('training')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'training'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              在培新人
            </button>
            <button
              onClick={() => setActiveTab('graduated')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'graduated'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              已出师
              {graduatedCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full" style={{ background: '#16A34A', color: 'white' }}>
                  {graduatedCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加新人
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">总新人</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2978B5]/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#2978B5]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#2978B5]">{trainingCount}</p>
              <p className="text-xs text-muted-foreground">在培训</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#22c55e]">{assignedCount}</p>
              <p className="text-xs text-muted-foreground">已下组</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="w-full text-xs border-collapse" style={{ minWidth: '2400px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#102A43] text-white">
                <th rowSpan={3} className="px-2 py-2 text-left border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>名字</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '120px' }}>入职日期</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '130px' }}>预计下组时间</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '100px' }}>部门</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '100px' }}>职位</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '100px' }}>带教老师</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>期数</th>
                <th colSpan={10} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ background: '#2978B5' }}>新人培训周期</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '120px' }}>入组日期</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>状态</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '120px' }}>备注</th>
                <th colSpan={12} className="px-2 py-2 text-center font-medium" style={{ background: '#22c55e' }}>下组后达标情况</th>
              </tr>
              <tr className="bg-[#102A43] text-white">
                {MONTH_HEADERS.slice(0, 2).map((h, i) => (
                  <th key={i} colSpan={h.cols} className="px-2 py-1.5 text-center border-r border-white/20 font-normal" style={{ background: h.color + 'cc' }}>{h.label}</th>
                ))}
                {MONTH_HEADERS.slice(2).map((h, i) => (
                  <th key={i} colSpan={h.cols} className="px-2 py-1.5 text-center border-r border-white/20 font-normal" style={{ background: h.color + 'cc' }}>{h.label}</th>
                ))}
              </tr>
              <tr className="bg-[#102A43] text-white/90">
                {MONTH_HEADERS.map((h, gi) =>
                  h.subHeaders.map((sh, si) => (
                    <th key={`${gi}-${si}`} className="px-1 py-1 text-center border-r border-white/20 font-normal text-[10px]" style={{ minWidth: '55px' }}>{sh}</th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={32} className="text-center py-12 text-muted-foreground">
                    暂无新人数据，点击上方「添加新人」创建
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p, idx) => (
                  <tr key={p.user_id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} onClick={() => handleSelectProfile(p)} style={{ cursor: 'pointer' }}>
                    <td className="px-2 py-1.5 border-b border-r border-border font-medium text-foreground">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span>{p.real_name || p.username}</span>
                          {isManager && (
                            <button
                              onClick={() => {
                                const gc = graduationChecks[p.user_id];
                                if (gc?.eligible) {
                                  setShowGraduationModal({ userId: p.user_id, name: p.real_name || p.username });
                                } else {
                                  checkGraduation(p.user_id);
                                }
                              }}
                              disabled={graduationChecks[p.user_id]?.checking || graduating === p.user_id}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors"
                              style={{
                                background: graduationChecks[p.user_id]?.eligible ? '#DCFCE7' : '#FEF3C7',
                                color: graduationChecks[p.user_id]?.eligible ? '#16A34A' : '#D97706',
                              }}
                              title={graduationChecks[p.user_id]?.eligible ? '点击确认出师' : '检查出师条件'}
                            >
                              {graduationChecks[p.user_id]?.checking ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : graduationChecks[p.user_id]?.eligible ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : (
                                <GraduationCap className="w-3 h-3" />
                              )}
                              出师
                            </button>
                          )}
                        </div>
                        {/* Graduation check result tooltip */}
                        {graduationChecks[p.user_id] && !graduationChecks[p.user_id].checking && !graduationChecks[p.user_id].eligible && graduationChecks[p.user_id].missingConditions.length > 0 && (
                          <div className="text-[10px] px-1.5 py-0.5 rounded leading-tight" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                            {graduationChecks[p.user_id].missingConditions.map((c, i) => (
                              <div key={i} className="flex items-center gap-0.5">
                                <XCircle className="w-2.5 h-2.5 flex-shrink-0" />
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {p.is_overdue ? (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium leading-none"
                            style={{
                              background: p.overdue_days >= 15 ? '#FEE2E2' : '#FEF3C7',
                              color: p.overdue_days >= 15 ? '#DC2626' : '#D97706',
                            }}>
                            {p.overdue_days >= 15 ? '严重超期' : `已超期${p.overdue_days}天`}
                          </span>
                        ) : p.qualification_deadline ? (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium leading-none"
                            style={{ background: '#DCFCE7', color: '#16A34A' }}>
                            资格期内 ✓
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      <div className="flex flex-col gap-0.5">
                        {renderDateInput('hire_date', p.user_id, p.hire_date, '入职日期')}
                        {p.hire_date && (
                          <span className="text-[10px] text-muted-foreground text-center">
                            在职{Math.ceil((Date.now() - new Date(p.hire_date).getTime()) / (1000 * 60 * 60 * 24))}天
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderDateInput('expected_group_date', p.user_id, p.expected_group_date, '预计下组')}
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderSelect('department', p.user_id, p.department,
                        DEPARTMENTS.map(d => ({ value: d, label: d })),
                        '选择部门'
                      )}
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderSelect('position', p.user_id, p.position,
                        POSITIONS.map(p => ({ value: p, label: p })),
                        '选择职位'
                      )}
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderSelect('mentor_id', p.user_id, p.mentor_id || '',
                        mentors.map(m => ({ value: m.id, label: m.real_name })),
                        '选择带教老师'
                      )}
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      <input
                        type="text"
                        className="w-full text-xs text-center px-1 py-1 border border-transparent hover:border-border rounded bg-transparent"
                        defaultValue={p.cohort || ''}
                        placeholder="第1期"
                        onBlur={(e) => updateProfile(p.user_id, 'cohort', e.target.value)}
                      />
                    </td>
                    {renderMonthlyCell(p.user_id, 1, p.monthly_data['1'], 'training')}
                    {renderMonthlyCell(p.user_id, 2, p.monthly_data['2'], 'training')}
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderDateInput('group_date', p.user_id, p.group_date ?? '', '入组日期')}
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      <select
                        className="w-full text-xs px-1 py-1 border border-border rounded bg-background font-medium"
                        style={{ color: STATUS_MAP[p.profile_status]?.color || '#667085' }}
                        value={p.profile_status}
                        onChange={(e) => updateProfile(p.user_id, 'status', e.target.value)}
                      >
                        {Object.entries(STATUS_MAP).map(([val, s]) => (
                          <option key={val} value={val}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1 border-b border-r border-border">
                      <input
                        type="text"
                        className="w-full text-xs px-1 py-1 border border-transparent hover:border-border rounded bg-transparent"
                        defaultValue={p.remark || ''}
                        placeholder="备注"
                        onBlur={(e) => updateProfile(p.user_id, 'remark', e.target.value)}
                      />
                    </td>
                    {renderMonthlyCell(p.user_id, 3, p.monthly_data['3'], 'assigned')}
                    {renderMonthlyCell(p.user_id, 4, p.monthly_data['4'], 'assigned')}
                    {renderMonthlyCell(p.user_id, 5, p.monthly_data['5'], 'assigned')}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-card shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 border border-border">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">保存中...</span>
        </div>
      )}

      {/* Add Trainee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">添加新人</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">用户名</label>
                <input type="text" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1" value={newTrainee.username} onChange={(e) => setNewTrainee(prev => ({ ...prev, username: e.target.value }))} placeholder="请输入用户名" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">真实姓名</label>
                <input type="text" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1" value={newTrainee.real_name} onChange={(e) => setNewTrainee(prev => ({ ...prev, real_name: e.target.value }))} placeholder="请输入真实姓名" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">密码</label>
                <input type="text" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1" value={newTrainee.password} onChange={(e) => setNewTrainee(prev => ({ ...prev, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">部门</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.department}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, department: e.target.value }))}
                >
                  <option value="">选择部门</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">职位</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.position}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, position: e.target.value }))}
                >
                  <option value="">选择职位</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">带教老师</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.mentor_id}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, mentor_id: e.target.value }))}
                >
                  <option value="">选择带教老师</option>
                  {mentors.map(m => <option key={m.id} value={m.id}>{m.real_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">取消</button>
              <button onClick={addTrainee} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">确认添加</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Detail Panel with Event Timeline */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-40 pt-16" onClick={() => setSelectedProfile(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-foreground">{selectedProfile.real_name}</h2>
                <p className="text-sm text-muted-foreground">{selectedProfile.department} · {selectedProfile.position}</p>
              </div>
              <button onClick={() => setSelectedProfile(null)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            {/* Content */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Basic Info */}
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" /> 基本信息
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">手机</span><span className="text-foreground font-medium">{selectedProfile.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">入职日期</span><span className="text-foreground font-medium">{selectedProfile.hire_date?.split('T')[0] || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">预计下组</span><span className="text-foreground font-medium">{selectedProfile.expected_group_date?.split('T')[0] || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">实际下组</span><span className="text-foreground font-medium">{selectedProfile.group_date?.split('T')[0] || '未下组'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">带教老师</span><span className="text-foreground font-medium">{selectedProfile.mentor_name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">当前阶段</span><span className="text-foreground font-medium">阶段 {selectedProfile.stage || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">闯关进度</span><span className="text-foreground font-medium">{selectedProfile.passed_levels || 0} / {selectedProfile.total_levels || 21} 关</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">出师状态</span>
                    <span className={`font-medium ${selectedProfile.graduation_date ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {selectedProfile.graduation_date ? `已出师 ${selectedProfile.graduation_date.split('T')[0]}` : '未出师'}
                    </span>
                  </div>
                </div>
              </div>
              {/* Right: Event Timeline */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" /> 事件时间线
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Event type filter */}
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="text-xs px-2 py-1 rounded-md border border-border bg-muted text-foreground"
                    >
                      <option value="all">全部</option>
                      <option value="qc">质检</option>
                      <option value="task">任务</option>
                      <option value="empower">赋能</option>
                      <option value="stage_change">阶段变更</option>
                    </select>
                    {/* Days filter */}
                    <div className="flex rounded-md border border-border overflow-hidden">
                      {[7, 30, 90].map(d => (
                        <button
                          key={d}
                          onClick={() => { setEventDays(d); fetchEvents(selectedProfile.user_id); }}
                          className={`text-xs px-2 py-1 transition-colors ${eventDays === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        >
                          {d}天
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">暂无事件记录</div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-border space-y-4">
                    {events
                      .filter(e => eventFilter === 'all' || e.event_type === eventFilter)
                      .map((e) => {
                        const iconMap: Record<string, { icon: React.ReactNode; bg: string }> = {
                          qc: { icon: <FileCheck className="w-3.5 h-3.5" />, bg: '#DBEAFE' },
                          task: { icon: <CheckCircle className="w-3.5 h-3.5" />, bg: '#DCFCE7' },
                          empower: { icon: <Zap className="w-3.5 h-3.5" />, bg: '#FEF3C7' },
                          stage_change: { icon: <RotateCw className="w-3.5 h-3.5" />, bg: '#F3E8FF' },
                        };
                        const typeLabel: Record<string, string> = { qc: '质检', task: '任务', empower: '赋能', stage_change: '阶段变更' };
                        const info = iconMap[e.event_type] || iconMap.task;
                        return (
                          <div key={e.id} className="relative">
                            <div className="absolute -left-[29px] p-1 rounded-full border-2 border-card" style={{ background: info.bg }}>
                              {info.icon}
                            </div>
                            <div className="bg-muted/50 rounded-lg px-4 py-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: info.bg, color: '#1D2733' }}>
                                  {typeLabel[e.event_type] || e.event_type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(e.happened_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-sm text-foreground">
                                {typeof e.event_data === 'object' && e.event_data !== null
                                  ? ((e.event_data as Record<string, unknown>).description as string) || (e.event_data as Record<string, unknown>).title as string || JSON.stringify(e.event_data).slice(0, 80)
                                  : String(e.event_data || '')}
                              </p>
                              {e.actor_name && <p className="text-xs text-muted-foreground mt-1">操作人：{e.actor_name}</p>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graduation Confirm Modal */}
      {showGraduationModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowGraduationModal(null)}>
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: '#DCFCE7' }}>
                <GraduationCap className="w-6 h-6" style={{ color: '#16A34A' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">确认出师</h2>
                <p className="text-sm text-muted-foreground">{showGraduationModal.name}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg mb-4" style={{ background: '#F0FDF4' }}>
              <p className="text-sm" style={{ color: '#166534' }}>
                确认该新人满足出师条件：
              </p>
              <ul className="mt-2 text-sm space-y-1" style={{ color: '#15803D' }}>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> 已达到独立服务阶段 (stage=3)
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> 最近3次质检合格 ({'>='}60分)
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> 管理员手动确认
                </li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              出师后新人将从"在培"列表移至"已出师"列表，并通知培训负责人和老板。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGraduationModal(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
              <button
                onClick={() => confirmGraduation(showGraduationModal.userId)}
                disabled={graduating === showGraduationModal.userId}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{ background: '#16A34A', color: 'white' }}
              >
                {graduating === showGraduationModal.userId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    确认中...
                  </>
                ) : (
                  '确认出师'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
