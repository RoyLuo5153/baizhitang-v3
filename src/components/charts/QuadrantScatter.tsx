'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CHART_COLORS, getQuadrantColor, getQuadrantBgColor } from '@/lib/constants/chart-colors';

interface ScatterPoint {
  name: string;
  processScore: number;
  resultScore: number;
  trainingDays: number;
  quadrant: string;
}

interface QuadrantScatterProps {
  data: ScatterPoint[];
  quadrantSummary?: { A: number; B: number; C: number; D: number; total: number };
}

interface TooltipPayloadItem {
  payload: ScatterPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const color = getQuadrantColor(d.quadrant);

  return (
    <div className="bg-card border border-border rounded-md shadow-md px-3 py-2 text-xs">
      <div className="font-semibold text-foreground mb-1">{d.name}</div>
      <div className="flex gap-3">
        <span>过程线: <b style={{ color: CHART_COLORS.blue }}>{d.processScore}</b></span>
        <span>结果线: <b style={{ color: CHART_COLORS.blue }}>{d.resultScore}</b></span>
      </div>
      <div className="text-muted-foreground mt-0.5">
        在培天数: {d.trainingDays}天 · {d.quadrant}类
      </div>
      <div className="mt-1" style={{ color }}>
        {d.quadrant === 'A' ? '全合格' : d.quadrant === 'B' ? '结果不合格' : d.quadrant === 'C' ? '过程不合格' : '全不合格'}
      </div>
    </div>
  );
}

/**
 * 四象限气泡散点图
 * X=过程线得分 Y=结果线得分 75分参考线分割
 */
export function QuadrantScatter({ data, quadrantSummary }: QuadrantScatterProps) {
  const summary = quadrantSummary || { A: 0, B: 0, C: 0, D: 0, total: data.length };

  const quadrantLabels = [
    { key: 'A', label: 'A类 全合格', desc: '过程✓ 结果✓' },
    { key: 'B', label: 'B类 结果不合格', desc: '过程✓ 结果✗' },
    { key: 'C', label: 'C类 过程不合格', desc: '过程✗ 结果✓' },
    { key: 'D', label: 'D类 全不合格', desc: '过程✗ 结果✗' },
  ];

  return (
    <div className="flex gap-4 h-full">
      {/* 散点图 左2/3 */}
      <div className="flex-[2] min-w-0">
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} />
            <XAxis
              type="number"
              dataKey="processScore"
              name="过程线"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
              label={{ value: '过程线得分', position: 'bottom', fontSize: 11, fill: CHART_COLORS.muted }}
            />
            <YAxis
              type="number"
              dataKey="resultScore"
              name="结果线"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
              label={{ value: '结果线得分', angle: -90, position: 'insideLeft', fontSize: 11, fill: CHART_COLORS.muted }}
            />
            <ZAxis type="number" dataKey="trainingDays" range={[60, 400]} name="在培天数" />
            {/* 75分合格线 */}
            <ReferenceLine x={75} stroke={CHART_COLORS.muted} strokeDasharray="4 4" strokeOpacity={0.6} />
            <ReferenceLine y={75} stroke={CHART_COLORS.muted} strokeDasharray="4 4" strokeOpacity={0.6} />
            {/* 象限标签 */}
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={data} fill="#8884d8">
              {data.map((entry, index) => (
                <Cell key={index} fill={getQuadrantColor(entry.quadrant)} fillOpacity={0.7} stroke={getQuadrantColor(entry.quadrant)} strokeWidth={1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* 象限统计摘要 右1/3 */}
      <div className="flex-1 flex flex-col justify-center gap-2 min-w-[160px]">
        <div className="text-sm font-semibold text-foreground mb-1">象限分布</div>
        {quadrantLabels.map(q => {
          const count = summary[q.key as keyof typeof summary] as number;
          const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
          return (
            <div
              key={q.key}
              className="rounded-md px-3 py-2"
              style={{ backgroundColor: getQuadrantBgColor(q.key) }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: getQuadrantColor(q.key) }}>
                  {q.label}
                </span>
                <span className="text-xs font-bold" style={{ color: getQuadrantColor(q.key) }}>
                  {count}人 {pct}%
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{q.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
