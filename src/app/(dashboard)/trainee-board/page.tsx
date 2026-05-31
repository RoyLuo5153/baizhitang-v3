'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, AlertTriangle, Plus, Save, Loader2, ChevronDown,
} from 'lucide-react';

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
  mentor_name: string | null;
  profile_status: string;
  remark: string;
  passed_levels: number;
  completed_tasks: number;
  open_weaknesses: number;
  monthly_data: Record<string, MonthlyData>;
  user_status: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  training: { label: '在培训', color: '#2978B5' },
  assigned: { label: '下组', color: '#22c55e' },
  rotating: { label: '轮组', color: '#F59E0B' },
  resigned: { label: '离职', color: '#94a3b8' },
};

const MONTH_HEADERS = [
  { label: '入职当月', cols: 5, color: '#2978B5', subHeaders: ['月份', '资源数', '接诊率', '均价', '达标'] },
  { label: '入职第二月', cols: 5, color: '#2978B5', subHeaders: ['月份', '资源数', '接诊率', '均价', '达标'] },
  { label: '下组第1月', cols: 4, color: '#22c55e', subHeaders: ['月份', '资源数', '接诊率', '诊单价'] },
  { label: '下组第2月', cols: 4, color: '#22c55e', subHeaders: ['月份', '资源数', '接诊率', '诊单价'] },
  { label: '下组第3月', cols: 4, color: '#22c55e', subHeaders: ['月份', '资源数', '接诊率', '诊单价'] },
];

export default function TraineeBoardPage() {
  const [profiles, setProfiles] = useState<TraineeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTrainee, setNewTrainee] = useState({ username: '', real_name: '', password: 'bt2026', department: '', position: '' });

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/trainee-profiles');
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.profiles || []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Update a profile field
  const updateProfile = async (userId: string, field: string, value: string) => {
    setSaving(userId + field);
    try {
      await fetch('/api/trainee-profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      });
      setProfiles(prev => prev.map(p => p.user_id === userId ? { ...p, [field === 'status' ? 'profile_status' : field]: value } : p));
    } catch { /* ignore */ }
    setSaving(null);
  };

  // Update monthly data
  const updateMonthly = async (userId: string, monthIndex: number, field: string, value: string | number | boolean) => {
    try {
      await fetch('/api/trainee-monthly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, monthIndex, field, value }),
      });
    } catch { /* ignore */ }
  };

  // Add new trainee
  const addTrainee = async () => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTrainee, role: 'trainee' }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewTrainee({ username: '', real_name: '', password: 'bt2026', department: '', position: '' });
        fetchProfiles();
      }
    } catch { /* ignore */ }
  };

  // Format date to YYYY-MM-DD
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Generate month options for select
  const getMonthOptions = () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -6; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const label = `${d.getFullYear()}年${d.getMonth() + 1}月1日`;
      options.push({ value: val, label });
    }
    return options;
  };

  // Render date select with YYYY-MM-DD precision
  const renderDateSelect = (field: string, userId: string, currentValue: string, placeholder: string) => {
    const dateVal = formatDate(currentValue);
    const options = getMonthOptions();
    return (
      <select
        className="w-full text-xs px-1 py-1 border border-border rounded bg-background text-foreground"
        value={dateVal}
        onChange={(e) => updateProfile(userId, field, e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  };

  // Render a date input with YYYY-MM-DD precision (free input)
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

  // Render monthly data cell
  const renderMonthlyCell = (userId: string, monthIndex: number, md: MonthlyData | undefined, type: 'training' | 'assigned') => {
    if (!md) md = {} as MonthlyData;
    const isTraining = type === 'training';

    return (
      <>
        {/* Month key */}
        <td className="px-1 py-1 text-center border-b border-r border-border">
          <input
            type="text"
            className="w-full text-xs text-center px-0.5 py-0.5 border border-transparent hover:border-border rounded bg-transparent"
            defaultValue={md.month_key || ''}
            placeholder="2026-05"
            onBlur={(e) => updateMonthly(userId, monthIndex, 'month_key', e.target.value)}
          />
        </td>
        {/* Resource count */}
        <td className="px-1 py-1 text-center border-b border-r border-border">
          <input
            type="number"
            className="w-full text-xs text-center px-0.5 py-0.5 border border-transparent hover:border-border rounded bg-transparent"
            defaultValue={md.resource_count || ''}
            placeholder="0"
            onBlur={(e) => updateMonthly(userId, monthIndex, 'resource_count', Number(e.target.value) || 0)}
          />
        </td>
        {/* Reception rate */}
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
        {/* Avg price / clinic unit price */}
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
        {/* Qualified status (training only) */}
        {isTraining && (
          <td className="px-1 py-1 text-center border-b border-r border-border">
            <span className={`inline-block w-4 h-4 rounded-full ${md.is_qualified ? 'bg-[#22c55e]' : 'bg-[#ef4444]/40'}`} />
          </td>
        )}
      </>
    );
  };

  // Stats
  const total = profiles.length;
  const trainingCount = profiles.filter(p => p.profile_status === 'training').length;
  const assignedCount = profiles.filter(p => p.profile_status === 'assigned').length;

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
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">新人档案管理</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">完整业务数据追踪表格</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加新人
        </button>
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
              {/* Row 1: Main headers */}
              <tr className="bg-[#102A43] text-white">
                <th rowSpan={3} className="px-2 py-2 text-left border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>名字</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '120px' }}>入职日期</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '130px' }}>预计下组时间</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>部门</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>职位</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>带教老师</th>
                {/* Training period: 10 cols */}
                <th colSpan={10} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ background: '#2978B5' }}>新人培训周期</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '120px' }}>入组日期</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '80px' }}>状态</th>
                <th rowSpan={3} className="px-2 py-2 text-center border-r border-white/20 font-medium" style={{ minWidth: '120px' }}>备注</th>
                {/* Post-group: 12 cols */}
                <th colSpan={12} className="px-2 py-2 text-center font-medium" style={{ background: '#22c55e' }}>下组后达标情况</th>
              </tr>
              {/* Row 2: Sub-headers */}
              <tr className="bg-[#102A43] text-white">
                {MONTH_HEADERS.slice(0, 2).map((h, i) => (
                  <th key={i} colSpan={h.cols} className="px-2 py-1.5 text-center border-r border-white/20 font-normal" style={{ background: h.color + 'cc' }}>{h.label}</th>
                ))}
                {MONTH_HEADERS.slice(2).map((h, i) => (
                  <th key={i} colSpan={h.cols} className="px-2 py-1.5 text-center border-r border-white/20 font-normal" style={{ background: h.color + 'cc' }}>{h.label}</th>
                ))}
              </tr>
              {/* Row 3: Detail headers */}
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
                  <td colSpan={31} className="text-center py-12 text-muted-foreground">
                    暂无新人数据，点击上方「添加新人」创建
                  </td>
                </tr>
              ) : (
                profiles.map((p, idx) => (
                  <tr key={p.user_id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    {/* Name */}
                    <td className="px-2 py-1.5 border-b border-r border-border font-medium text-foreground">
                      {p.real_name || p.username}
                    </td>
                    {/* Hire date - date picker YYYY-MM-DD */}
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderDateInput('hire_date', p.user_id, p.hire_date, '入职日期')}
                    </td>
                    {/* Expected group date - date picker YYYY-MM-DD */}
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderDateInput('expected_group_date', p.user_id, p.expected_group_date, '预计下组')}
                    </td>
                    {/* Department */}
                    <td className="px-1 py-1 border-b border-r border-border text-center text-muted-foreground">
                      {p.department || '-'}
                    </td>
                    {/* Position */}
                    <td className="px-1 py-1 border-b border-r border-border text-center text-muted-foreground">
                      {p.position || '-'}
                    </td>
                    {/* Mentor */}
                    <td className="px-1 py-1 border-b border-r border-border text-center">
                      {p.mentor_name || <span className="text-muted-foreground/50">未分配</span>}
                    </td>
                    {/* Training month 1 */}
                    {renderMonthlyCell(p.user_id, 1, p.monthly_data['1'], 'training')}
                    {/* Training month 2 */}
                    {renderMonthlyCell(p.user_id, 2, p.monthly_data['2'], 'training')}
                    {/* Group date - date picker YYYY-MM-DD */}
                    <td className="px-1 py-1 border-b border-r border-border">
                      {renderDateInput('group_date', p.user_id, p.group_date ?? '', '入组日期')}
                    </td>
                    {/* Status */}
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
                    {/* Remark */}
                    <td className="px-1 py-1 border-b border-r border-border">
                      <input
                        type="text"
                        className="w-full text-xs px-1 py-1 border border-transparent hover:border-border rounded bg-transparent"
                        defaultValue={p.remark || ''}
                        placeholder="备注"
                        onBlur={(e) => updateProfile(p.user_id, 'remark', e.target.value)}
                      />
                    </td>
                    {/* Post-group months 3-5 */}
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

      {/* Saving indicator */}
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
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.username}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="请输入用户名"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">真实姓名</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.real_name}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, real_name: e.target.value }))}
                  placeholder="请输入真实姓名"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">密码</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.password}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">部门</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.department}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="如：培训部"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">职位</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm mt-1"
                  value={newTrainee.position}
                  onChange={(e) => setNewTrainee(prev => ({ ...prev, position: e.target.value }))}
                  placeholder="如：健康顾问"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
              <button
                onClick={addTrainee}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
