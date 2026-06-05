'use client';

import { PieChart, Pie, Cell } from 'recharts';
import { CHART_COLORS, getStatusColor } from '@/lib/constants/chart-colors';

interface GaugeChartProps {
  value: number;       // 0-100
  size?: number;
  strokeWidth?: number;
  thresholds?: { green: number; yellow: number };
  label?: string;
}

/**
 * 仪表盘图 — 用半圆弧线模拟
 * 红(0-thresholds.yellow) / 黄(thresholds.yellow-thresholds.green) / 绿(thresholds.green-100)
 */
export function GaugeChart({
  value,
  size = 160,
  strokeWidth = 14,
  thresholds = { green: 70, yellow: 40 },
  label,
}: GaugeChartProps) {
  const color = getStatusColor(value, thresholds);

  // 用完整环形图显示仪表盘效果：背景弧 + 前景弧
  const bgData = [{ value: 1 }];
  const fgData = [{ value: Math.max(value, 0.5) }, { value: Math.max(100 - value, 0.5) }];

  return (
    <div className="relative inline-flex flex-col items-center">
      <PieChart width={size} height={size / 2 + 20}>
        {/* 背景弧 */}
        <Pie
          data={bgData}
          dataKey="value"
          cx={size / 2}
          cy={size / 2 + 10}
          innerRadius={size / 2 - strokeWidth - 10}
          outerRadius={size / 2 - 10}
          startAngle={180}
          endAngle={0}
          cornerRadius={4}
        >
          <Cell fill="#E6E1D8" />
        </Pie>
        {/* 前景弧 */}
        <Pie
          data={fgData}
          dataKey="value"
          cx={size / 2}
          cy={size / 2 + 10}
          innerRadius={size / 2 - strokeWidth - 10}
          outerRadius={size / 2 - 10}
          startAngle={180}
          endAngle={180 - (value / 100) * 180}
          cornerRadius={4}
        >
          <Cell fill={color} />
          <Cell fill="transparent" />
        </Pie>
      </PieChart>
      {/* 中心数值 */}
      <div
        className="absolute flex flex-col items-center"
        style={{ top: size / 4, left: '50%', transform: 'translateX(-50%)' }}
      >
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {label && <span className="text-[11px] text-muted-foreground mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
