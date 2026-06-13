'use client';

import { useEffect, useState } from 'react';
import { Shield, Brain, Heart, Zap, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';

// === Types ===

interface TrustScoreResult {
  cognitiveScore: number;
  professionalScore: number;
  safetyScore: number;
  obstacleClearanceScore: number;
  totalTrust: number;
  bottleneck: string;
  suggestion: string;
}

interface TrustDashboardProps {
  userId: string;
  nodeId?: number;
  className?: string;
}

// === Constants ===

const DIMENSIONS = [
  { key: 'safetyScore', label: '安全感', icon: Shield, color: '#F59E0B', order: 1, desc: '信任建立第一步' },
  { key: 'professionalScore', label: '专业感知', icon: Brain, color: '#22C55E', order: 2, desc: '专业能力体现' },
  { key: 'cognitiveScore', label: '认知水平', icon: Heart, color: '#2978B5', order: 3, desc: '知识理解深度' },
  { key: 'obstacleClearanceScore', label: '障碍清除', icon: Zap, color: '#EF4444', order: 4, desc: '成交关键一步' },
];

function getScoreColor(score: number): string {
  if (score >= 70) return '#22C55E';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 40) return '一般';
  return '需提升';
}

// === Component ===

export default function TrustDashboard({ userId, nodeId, className = '' }: TrustDashboardProps) {
  const [data, setData] = useState<TrustScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchTrust = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ userId });
        if (nodeId) params.set('nodeId', String(nodeId));
        const res = await fetch(`/api/trust-score?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          const err = await res.json().catch(() => ({ error: '请求失败' }));
          setError(err.error || '获取信任度数据失败');
        }
      } catch (err) {
        setError('网络请求失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTrust();
  }, [userId, nodeId]);

  if (loading) {
    return (
      <div className={`bg-card rounded-xl border border-border p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">信任度仪表盘</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`bg-card rounded-xl border border-border p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">信任度仪表盘</h3>
        </div>
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          {error || '暂无数据'}
        </div>
      </div>
    );
  }

  const totalColor = getScoreColor(data.totalTrust);
  const totalLabel = getScoreLabel(data.totalTrust);

  return (
    <div className={`bg-card rounded-xl border border-border p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">信任度仪表盘</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          患者信任度
        </span>
      </div>

      {/* Total score */}
      <div className="mb-5">
        <div className="flex items-end justify-between mb-2">
          <span className="text-xs text-muted-foreground">综合信任度</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: totalColor, backgroundColor: totalColor + '15' }}>
            {totalLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${data.totalTrust}%`, backgroundColor: totalColor }}
            />
          </div>
          <span className="text-xl font-bold text-foreground tabular-nums min-w-[3ch] text-right">
            {data.totalTrust}
          </span>
        </div>
      </div>

      {/* 4 dimensions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {DIMENSIONS.map((dim) => {
          const score = (data as any)[dim.key] as number;
          const color = getScoreColor(score);
          const isBottleneck = data.bottleneck === dim.label;
          const Icon = dim.icon;
          return (
            <div
              key={dim.key}
              className="bg-muted/50 rounded-lg p-3 border transition-all"
              style={{ borderColor: isBottleneck ? color : 'transparent' }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-xs font-medium text-foreground">{dim.label}</span>
                {isBottleneck && (
                  <AlertTriangle className="w-3 h-3" style={{ color }} />
                )}
              </div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-lg font-bold text-foreground tabular-nums">{Math.round(score)}</span>
                <span className="text-[10px] text-muted-foreground">{dim.desc}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottleneck & suggestion */}
      {data.bottleneck && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 mb-0.5">
              瓶颈维度：{data.bottleneck}
            </p>
            <p className="text-xs text-amber-600">{data.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}
