'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CHART_COLORS } from '@/lib/constants/chart-colors';

interface RadarDataPoint {
  dimension: string;
  actual: number;
  benchmark: number;
  fullMark: number;
}

interface BenchmarkRadarProps {
  data: RadarDataPoint[];
  actualLabel?: string;
  benchmarkLabel?: string;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: RadarDataPoint;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const actual = payload.find(p => p.name === '实际值');
  const benchmark = payload.find(p => p.name === '基准线');

  return (
    <div className="bg-card border border-border rounded-md shadow-md px-3 py-2 text-xs">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {actual && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CHART_COLORS.blue }} />
          实际: <b>{actual.value}</b>
        </div>
      )}
      {benchmark && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CHART_COLORS.muted }} />
          基准: <b>{benchmark.value}</b>
        </div>
      )}
      {actual && benchmark && (
        <div className="mt-1 pt-1 border-t border-border/30 text-muted-foreground">
          差距: {actual.value - benchmark.value > 0 ? '+' : ''}{actual.value - benchmark.value}
        </div>
      )}
    </div>
  );
}

/**
 * 雷达图对标组件 — 实际值(实心) vs 基准线(虚线)
 */
export function BenchmarkRadar({
  data,
  actualLabel = '实际值',
  benchmarkLabel = '基准线',
}: BenchmarkRadarProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke={CHART_COLORS.gridLine} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: CHART_COLORS.muted }}
          axisLine={false}
        />
        {/* 实际值 — 实心填充 */}
        <Radar
          name={actualLabel}
          dataKey="actual"
          stroke={CHART_COLORS.blue}
          fill={CHART_COLORS.blue}
          fillOpacity={0.2}
          strokeWidth={2}
        />
        {/* 基准线 — 虚线描边 */}
        <Radar
          name={benchmarkLabel}
          dataKey="benchmark"
          stroke={CHART_COLORS.muted}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          iconType="line"
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
