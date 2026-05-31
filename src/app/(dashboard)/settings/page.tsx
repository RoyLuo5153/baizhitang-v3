'use client';

import { Settings as SettingsIcon, Shield, Users, Database, Save } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ThresholdConfig {
  id: string;
  metric_key: string;
  metric_name: string;
  category: string;
  qualified_value: number;
  good_value: number;
  excellent_value: number;
}

export default function SettingsPage() {
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/thresholds');
        if (res.ok) {
          const json = await res.json();
          setThresholds(json.data || json || []);
        }
      } catch {
        // use defaults
        setThresholds([
          { id: '1', metric_key: 'wechatAddRate', metric_name: '加V率', category: 'result', qualified_value: 90, good_value: 95, excellent_value: 98 },
          { id: '2', metric_key: 'consultationRate', metric_name: '面诊率', category: 'result', qualified_value: 85, good_value: 90, excellent_value: 95 },
          { id: '3', metric_key: 'receptionRate', metric_name: '接诊率', category: 'result', qualified_value: 80, good_value: 88, excellent_value: 95 },
          { id: '4', metric_key: 'deliveryRate', metric_name: '签收率', category: 'result', qualified_value: 85, good_value: 90, excellent_value: 95 },
          { id: '5', metric_key: 'medicationRate', metric_name: '用药率', category: 'result', qualified_value: 90, good_value: 95, excellent_value: 98 },
          { id: '6', metric_key: 'appointmentRate', metric_name: '挂号率', category: 'result', qualified_value: 80, good_value: 88, excellent_value: 95 },
        ]);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">系统设置</h1>
      </div>

      {/* Threshold Config */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">对标阈值配置</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">指标</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">类别</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#ef4444]">合格线</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#f59e0b]">良好线</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#22c55e]">优秀线</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {thresholds.map(t => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 text-foreground font-medium">{t.metric_name}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">
                    {t.category === 'result' ? '结果线' : t.category === 'process' ? '过程线' : t.category}
                  </td>
                  <td className="px-4 py-2.5 text-center text-destructive font-medium">{t.qualified_value}</td>
                  <td className="px-4 py-2.5 text-center text-[#f59e0b] font-medium">{t.good_value}</td>
                  <td className="px-4 py-2.5 text-center text-[#22c55e] font-medium">{t.excellent_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
