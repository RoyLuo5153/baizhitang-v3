'use client';

import { useEffect, useState } from 'react';
import {
  Database, Upload, FileSpreadsheet, Save, AlertCircle,
  CheckCircle2, Calendar, TrendingUp,
} from 'lucide-react';

interface BusinessRecord {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  wechat_add_rate: number | null;
  consultation_rate: number | null;
  reception_rate: number | null;
  delivery_rate: number | null;
  medication_rate: number | null;
  appointment_rate: number | null;
  total_patients: number | null;
  new_patients: number | null;
  source: string;
  notes: string | null;
}

export default function ScrmImportPage() {
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [bizRes, usersRes] = await Promise.all([
        fetch('/api/business'),
        fetch('/api/auth/me'),
      ]);
      if (bizRes.ok) {
        const json = await bizRes.json();
        setRecords(json.data || []);
      }
    } catch {
      // empty
    }
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">业务数据</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">录入和管理SCRM业务数据，支撑结果线对标</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <Upload className="w-3.5 h-3.5" />录入数据
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-card rounded-lg shadow-card border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">数据记录</h2>
          <span className="text-xs text-muted-foreground ml-2">共 {records.length} 条</span>
        </div>
        {records.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">暂无业务数据</p>
            <p className="text-xs text-muted-foreground mt-1">点击"录入数据"开始录入</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">周期</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">加V率</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">面诊率</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">接诊率</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">签收率</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">用药率</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">挂号率</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">来源</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2.5 text-foreground font-medium">{r.period_label}</td>
                    <td className="px-4 py-2.5 text-center">
                      <ThresholdValue value={r.wechat_add_rate} threshold={90} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ThresholdValue value={r.consultation_rate} threshold={85} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ThresholdValue value={r.reception_rate} threshold={80} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ThresholdValue value={r.delivery_rate} threshold={85} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ThresholdValue value={r.medication_rate} threshold={90} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ThresholdValue value={r.appointment_rate} threshold={80} />
                    </td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Input Form Dialog */}
      {showForm && (
        <BusinessDataForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />
      )}
    </div>
  );
}

function ThresholdValue({ value, threshold }: { value: number | null; threshold: number }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  const pass = value >= threshold;
  return (
    <span className={`font-medium ${pass ? 'text-[#22c55e]' : 'text-destructive'}`}>
      {value}%
    </span>
  );
}

function BusinessDataForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [userId, setUserId] = useState('1');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [wechatAddRate, setWechatAddRate] = useState('');
  const [consultationRate, setConsultationRate] = useState('');
  const [receptionRate, setReceptionRate] = useState('');
  const [deliveryRate, setDeliveryRate] = useState('');
  const [medicationRate, setMedicationRate] = useState('');
  const [appointmentRate, setAppointmentRate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          periodStart,
          periodEnd,
          wechatAddRate: wechatAddRate ? parseFloat(wechatAddRate) : null,
          consultationRate: consultationRate ? parseFloat(consultationRate) : null,
          receptionRate: receptionRate ? parseFloat(receptionRate) : null,
          deliveryRate: deliveryRate ? parseFloat(deliveryRate) : null,
          medicationRate: medicationRate ? parseFloat(medicationRate) : null,
          appointmentRate: appointmentRate ? parseFloat(appointmentRate) : null,
          source: 'manual',
          notes,
        }),
      });
      if (res.ok) onSaved();
    } catch {
      // ignore
    }
    setSaving(false);
  }

  const fields = [
    { label: '加V率', value: wechatAddRate, set: setWechatAddRate, threshold: '90%' },
    { label: '面诊率', value: consultationRate, set: setConsultationRate, threshold: '85%' },
    { label: '接诊率', value: receptionRate, set: setReceptionRate, threshold: '80%' },
    { label: '签收率', value: deliveryRate, set: setDeliveryRate, threshold: '85%' },
    { label: '用药率', value: medicationRate, set: setMedicationRate, threshold: '90%' },
    { label: '挂号率', value: appointmentRate, set: setAppointmentRate, threshold: '80%' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-card rounded-xl shadow-dialog p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-foreground mb-4">录入业务数据</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">开始日期</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">结束日期</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.label}>
                <label className="text-sm font-medium text-foreground">{f.label}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="w-full mt-1 px-3 py-2 pr-8 rounded-md border border-border bg-background text-foreground text-sm"
                    placeholder={f.threshold}
                    min={0}
                    max={100}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">备注</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">取消</button>
          <button onClick={handleSave} disabled={saving || !periodStart || !periodEnd}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
