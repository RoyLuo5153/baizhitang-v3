'use client';

import { PieChart, Pie, Cell } from 'recharts';
import { CHART_COLORS, getStatusColor } from '@/lib/constants/chart-colors';

interface RingProgressProps {
  value: number;       // 0-100 百分比
  size?: number;
  strokeWidth?: number;
  thresholds?: { green: number; yellow: number };
  label?: string;
  targetLabel?: string; // 如 "目标 80%"
  showTarget?: boolean;
  targetValue?: number; // 目标线位置
}

/**
 * 环形进度图 — 显示百分比 + 可选目标线
 */
export function RingProgress({
  value,
  size = 120,
  strokeWidth = 10,
  thresholds = { green: 80, yellow: 60 },
  label,
  targetLabel,
  showTarget,
  targetValue = 80,
}: RingProgressProps) {
  const color = getStatusColor(value, thresholds);
  const clampedValue = Math.min(Math.max(value, 0), 100);

  const fgData = [
    { value: clampedValue },
    { value: 100 - clampedValue },
  ];

  return (
    <div className="relative inline-flex flex-col items-center">
      <PieChart width={size} height={size}>
        <Pie
          data={fgData}
          dataKey="value"
          cx={size / 2}
          cy={size / 2}
          innerRadius={size / 2 - strokeWidth - 4}
          outerRadius={size / 2 - 4}
          startAngle={90}
          endAngle={-270}
          cornerRadius={4}
          stroke="none"
        >
          <Cell fill={color} />
          <Cell fill="#E6E1D8" />
        </Pie>
        {/* 目标线 — 用一个小扇区模拟 */}
        {showTarget && targetValue > 0 && targetValue < 100 && (
          <Pie
            data={[{ value: 0.8 }]}
            dataKey="value"
            cx={size / 2}
            cy={size / 2}
            innerRadius={size / 2 - strokeWidth - 6}
            outerRadius={size / 2 - 2}
            startAngle={90 - (targetValue / 100) * 360}
            endAngle={90 - (targetValue / 100) * 360 - 3}
            stroke="none"
          >
            <Cell fill={CHART_COLORS.muted} />
          </Pie>
        )}
      </PieChart>
      {/* 中心数值 */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <span className="text-lg font-bold" style={{ color }}>
          {value}%
        </span>
        {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
        {targetLabel && <span className="text-[9px] text-muted-foreground">{targetLabel}</span>}
      </div>
    </div>
  );
}
