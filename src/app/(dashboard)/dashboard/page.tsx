'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ChartBar, Users, TrendingUp, Target, AlertTriangle,
  CheckCircle2, Clock, Award,
} from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface DashboardData {
  summary: {
    totalMembers: number;
    avgLearningProgress: number;
    avgQcScore: number;
    avgBusinessScore: number;
  };
  quadrantDistribution: { A: number; B: number; C: number; D: number };
}

/* ── Level metadata: 21 levels across 3 stages ── */
const LEVEL_NAMES = [
  '服务礼仪', '企业文化', '产品知识(基础)', '沟通技巧', '系统操作', '工单流程', '质检标准',
  '投诉处理', '产品知识(进阶)', '疑难工单', '服务用语规范', '情绪管理', '数据录入', '跨部门协作',
  '独立接诊', '复杂案例', '业务复盘', '带教指导', '流程优化', '客户经营', '团队管理',
] as const;

const STAGE_RANGES: { stage: number; label: string; range: string }[] = [
  { stage: 1, label: '基础培训', range: 'L1–L7' },
  { stage: 2, label: '进阶培训', range: 'L8–L14' },
  { stage: 3, label: '独立接诊', range: 'L15–L21' },
];

/* status: passed=2, in-progress=1, locked=0 */
type CellStatus = 0 | 1 | 2;

interface TraineeProgress {
  name: string;
  id: string;
  levels: CellStatus[];
  scores: (number | null)[];
}

interface HeatmapData {
  levels: { id: number; name: string; stage: number }[];
  trainees: TraineeProgress[];
}

/* ── Color palette matching shadcn variables ── */
const COLORS = {
  passed: '#22c55e',
  inProgress: 'var(--primary)',
  locked: 'var(--muted)',
  passedBg: 'rgba(34,197,94,0.12)',
  inProgressBg: 'rgba(var(--primary),0.12)',
};

/* ── Heatmap cell ── */
function HeatmapCell({
  status, score, levelName, traineeName,
}: {
  status: CellStatus; score: number | null; levelName: string; traineeName: string;
}) {
  const [hovered, setHovered] = useState(false);
  const fill =
    status === 2 ? COLORS.passed :
    status === 1 ? COLORS.inProgress :
    COLORS.locked;
  const label =
    status === 2 ? '已通过' :
    status === 1 ? '进行中' :
    '未解锁';
  const scoreText = score !== null ? `${score}分` : '—';

  return (
    <div className="relative">
      <div
        className="w-full aspect-square rounded-[3px] cursor-pointer transition-all duration-150"
        style={{ backgroundColor: fill, opacity: status === 0 ? 0.35 : 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <div className="absolute z-50 bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2
                        bg-popover text-popover-foreground text-xs rounded-lg shadow-float
                        px-3 py-2 whitespace-nowrap pointer-events-none border border-border">
          <p className="font-semibold">{traineeName} · {levelName}</p>
          <p className="text-muted-foreground mt-0.5">
            状态: {label} {score !== null && `| 分数: ${scoreText}`}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
        </div>
      )}
    </div>
  );
}

/* ── computeStageStats from real data ── */
function computeStageStats(trainees: TraineeProgress[]) {
  const totalTrainees = trainees.length || 1;
  return STAGE_RANGES.map(s => {
    const start = (s.stage - 1) * 7;
    const end = start + 7;
    let allPassed = 0;
    let anyInProgress = 0;
    trainees.forEach(t => {
      const slice = t.levels.slice(start, end);
      const allDone = slice.every(st => st === 2);
      const hasProgress = slice.some(st => st === 1);
      if (allDone) allPassed++;
      else if (hasProgress) anyInProgress++;
    });
    const notStarted = totalTrainees - allPassed - anyInProgress;
    return { stage: s.stage, totalTrainees, allPassed, anyInProgress, notStarted };
  });
}

/* ── Progress Heatmap ── */
function ProgressHeatmap({ data }: { data: HeatmapData | null }) {
  const cellSize = 'minmax(16px, 1fr)';

  if (!data || data.trainees.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">进度热力图</h2>
        <div className="text-center py-8">
          <ChartBar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">暂无学员进度数据</p>
        </div>
      </div>
    );
  }

  const levelCount = data.levels.length || 21;

  return (
    <div className="bg-card rounded-lg shadow-card p-5">
      {/* Title & Legend */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">进度热力图</h2>
          <span className="text-xs text-muted-foreground">{levelCount}个关卡 × {data.trainees.length}人</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[2px]" style={{ backgroundColor: COLORS.passed }} /> 已通过
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[2px]" style={{ backgroundColor: COLORS.inProgress }} /> 进行中
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[2px] opacity-35" style={{ backgroundColor: COLORS.locked }} /> 未解锁
          </span>
        </div>
      </div>

      {/* Column headers — level numbers */}
      <div
        className="grid gap-[3px] mb-1 pl-[72px]"
        style={{ gridTemplateColumns: `repeat(${levelCount}, ${cellSize})` }}
      >
        {Array.from({ length: levelCount }, (_, i) => (
          <div key={i} className="text-[10px] text-muted-foreground text-center font-mono leading-none">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Stage indicator row */}
      {data.levels.length > 0 && (
        <div
          className="grid gap-[3px] mb-2 pl-[72px]"
          style={{ gridTemplateColumns: `repeat(${levelCount}, ${cellSize})` }}
        >
          {STAGE_RANGES.filter(s => {
            const start = (s.stage - 1) * 7;
            return start < levelCount;
          }).map(s => {
            const start = (s.stage - 1) * 7;
            const span = Math.min(7, levelCount - start);
            return (
              <div key={s.stage} className="col-span-7 text-center" style={{ gridColumn: `${start + 1} / span ${span}` }}>
                <span
                  className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: s.stage === 1 ? 'rgba(34,197,94,0.1)' : s.stage === 2 ? 'rgba(var(--primary),0.1)' : 'rgba(168,85,247,0.1)',
                    color: s.stage === 1 ? '#22c55e' : s.stage === 2 ? 'var(--primary)' : '#a855f7',
                  }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Rows — one per trainee */}
      <div className="space-y-[3px]">
        {data.trainees.map(trainee => (
          <div key={trainee.id} className="flex items-center gap-0">
            {/* Name label */}
            <div className="w-[72px] shrink-0 text-xs text-foreground font-medium truncate pr-2 text-right">
              {trainee.name}
            </div>
            {/* Level cells */}
            <div
              className="grid gap-[3px] flex-1"
              style={{ gridTemplateColumns: `repeat(${levelCount}, ${cellSize})` }}
            >
              {trainee.levels.map((status, li) => (
                <HeatmapCell
                  key={li}
                  status={status}
                  score={trainee.scores[li]}
                  levelName={data.levels[li]?.name || LEVEL_NAMES[li] || `关卡${li + 1}`}
                  traineeName={trainee.name}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* X-axis label */}
      <div className="mt-3 pl-[72px] text-center">
        <span className="text-[10px] text-muted-foreground">关卡编号 →</span>
      </div>
    </div>
  );
}

/* ── Stage Distribution Bar Chart (inline SVG) ── */
function StageDistributionChart({ trainees }: { trainees: TraineeProgress[] }) {
  const stageStats = useMemo(() => computeStageStats(trainees), [trainees]);
  const totalTrainees = trainees.length || 1;

  /* SVG dimensions */
  const svgW = 520;
  const svgH = 300;
  const padL = 50;
  const padR = 30;
  const padT = 30;
  const padB = 60;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  /* Bar layout */
  const barGap = 60;
  const barW = (chartW - barGap * 2) / 3;

  /* Y scale: 0..totalTrainees */
  const yScale = (v: number) => padT + chartH - (v / totalTrainees) * chartH;

  /* Grid lines */
  const gridLines = Array.from({ length: totalTrainees + 1 }, (_, i) => i);

  if (trainees.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">阶段分布柱状图</h2>
        <div className="text-center py-8">
          <ChartBar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">暂无学员数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">阶段分布柱状图</h2>
          <span className="text-xs text-muted-foreground">各阶段人员分布</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[2px]" style={{ backgroundColor: COLORS.passed }} /> 全部通过
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[2px]" style={{ backgroundColor: COLORS.inProgress }} /> 进行中
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[2px]" style={{ backgroundColor: COLORS.locked, opacity: 0.4 }} /> 未开始
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full max-w-[560px] mx-auto"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {/* Y-axis grid lines */}
        {gridLines.map(v => (
          <g key={v}>
            <line
              x1={padL} y1={yScale(v)} x2={svgW - padR} y2={yScale(v)}
              stroke="var(--border)" strokeWidth={0.5} strokeDasharray={v === 0 ? 'none' : '3,3'}
            />
            <text
              x={padL - 8} y={yScale(v) + 4}
              textAnchor="end" fill="var(--muted-foreground)" fontSize={10}
            >
              {v}
            </text>
          </g>
        ))}

        {/* Y-axis label */}
        <text
          x={14} y={padT + chartH / 2}
          textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}
          transform={`rotate(-90,14,${padT + chartH / 2})`}
        >
          人数
        </text>

        {/* Bars */}
        {stageStats.map((s, i) => {
          const x = padL + i * (barW + barGap);
          const passedH = (s.allPassed / totalTrainees) * chartH;
          const inProgressH = (s.anyInProgress / totalTrainees) * chartH;
          const notStartedH = (s.notStarted / totalTrainees) * chartH;

          const yNotStarted = yScale(s.notStarted);
          const yInProgress = yScale(s.notStarted + s.anyInProgress);
          const yPassed = yScale(s.notStarted + s.anyInProgress + s.allPassed);

          const passRate = totalTrainees > 0 ? Math.round((s.allPassed / totalTrainees) * 100) : 0;

          return (
            <g key={s.stage}>
              {/* Not started (bottom) */}
              <rect
                x={x} y={yNotStarted}
                width={barW} height={notStartedH}
                rx={2} fill="var(--muted)" opacity={0.35}
              />
              {/* In progress (middle) */}
              <rect
                x={x} y={yInProgress}
                width={barW} height={inProgressH}
                rx={0} fill="var(--primary)"
              />
              {/* Passed (top) — top corners rounded */}
              <rect
                x={x} y={yPassed}
                width={barW} height={passedH}
                rx={2} fill={COLORS.passed}
              />
              {passedH > 4 && (s.anyInProgress > 0 || s.notStarted > 0) && (
                <rect
                  x={x} y={yPassed + passedH - 4}
                  width={barW} height={4}
                  fill={COLORS.passed}
                />
              )}

              {/* Value labels inside bars */}
              {s.allPassed > 0 && (
                <text
                  x={x + barW / 2} y={yPassed + passedH / 2 + 4}
                  textAnchor="middle" fill="white" fontSize={11} fontWeight={600}
                >
                  {s.allPassed}
                </text>
              )}
              {s.anyInProgress > 0 && (
                <text
                  x={x + barW / 2} y={yInProgress + inProgressH / 2 + 4}
                  textAnchor="middle" fill="white" fontSize={11} fontWeight={600}
                >
                  {s.anyInProgress}
                </text>
              )}
              {s.notStarted > 0 && notStartedH > 14 && (
                <text
                  x={x + barW / 2} y={yNotStarted + notStartedH / 2 + 4}
                  textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}
                >
                  {s.notStarted}
                </text>
              )}

              {/* X-axis: Stage label */}
              <text
                x={x + barW / 2} y={padT + chartH + 20}
                textAnchor="middle" fill="var(--foreground)" fontSize={12} fontWeight={600}
              >
                阶段{s.stage}
              </text>
              <text
                x={x + barW / 2} y={padT + chartH + 34}
                textAnchor="middle" fill="var(--muted-foreground)" fontSize={9}
              >
                {STAGE_RANGES[i].range}
              </text>

              {/* Pass rate badge */}
              <text
                x={x + barW / 2} y={padT + chartH + 50}
                textAnchor="middle" fontSize={11} fontWeight={700}
                fill={passRate >= 50 ? COLORS.passed : passRate > 0 ? '#f59e0b' : 'var(--muted-foreground)'}
              >
                通过率 {passRate}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const [diagResult, heatmapResult] = await Promise.all([
        apiGet<{ summary: { A: number; B: number; C: number; D: number; total: number } }>('/api/diagnosis?view=team', { summary: { A: 0, B: 0, C: 0, D: 0, total: 0 } }),
        apiGet<any>('/api/learning/heatmap', {}),
      ]);

      let quadrantDist = { A: 0, B: 0, C: 0, D: 0 };
      let totalMembers = 0;

      quadrantDist = diagResult.summary;
      totalMembers = diagResult.summary.total;

      setHeatmapData(heatmapResult);
      if (heatmapResult.trainees?.length > 0) {
        totalMembers = heatmapResult.trainees.length;
      }

        // Compute real avg learning progress from heatmap data
        let avgLearningProgress = 0;
        if (heatmapData?.trainees?.length) {
          const progresses = heatmapData.trainees.map((t: TraineeProgress) => {
            const passed = t.levels.filter((s: CellStatus) => s === 2).length;
            return Math.round((passed / Math.max(t.levels.length, 1)) * 100);
          });
          avgLearningProgress = Math.round(progresses.reduce((a: number, b: number) => a + b, 0) / progresses.length);
        }

        setData({
          summary: {
            totalMembers,
            avgLearningProgress,
            avgQcScore: 0,
            avgBusinessScore: 0,
          },
          quadrantDistribution: quadrantDist,
        });
      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ChartBar className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">数据看板</h1>
          <span className="text-sm text-muted-foreground">培训体系全景数据</span>
        </div>
        <div className="bg-card rounded-lg shadow-card p-12 text-center">
          <ChartBar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无数据，培训数据将随着使用逐步积累</p>
        </div>
      </div>
    );
  }

  const { summary, quadrantDistribution: qd } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ChartBar className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">数据看板</h1>
        <span className="text-sm text-muted-foreground">培训体系全景数据</span>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '团队人数', value: summary.totalMembers, icon: Users, color: 'text-primary', unit: '人' },
          { label: '平均学习进度', value: summary.avgLearningProgress, icon: TrendingUp, color: 'text-[#22c55e]', unit: '%' },
          { label: '平均质检分', value: summary.avgQcScore, icon: Target, color: 'text-[#f59e0b]', unit: '分' },
          { label: '业务达标率', value: summary.avgBusinessScore, icon: Award, color: 'text-primary', unit: '%' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-lg shadow-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{stat.value || '—'}</span>
                {stat.value > 0 && <span className="text-sm text-muted-foreground">{stat.unit}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Heatmap */}
      <ProgressHeatmap data={heatmapData} />

      {/* Stage Distribution Bar Chart */}
      <StageDistributionChart trainees={heatmapData?.trainees || []} />

      {/* Quadrant Distribution */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-lg shadow-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">四象限分布</h2>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'A', label: 'A类 · 达标', color: '#22c55e', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/30' },
              { key: 'B', label: 'B类 · 结果待提升', color: '#f59e0b', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/30' },
              { key: 'C', label: 'C类 · 过程待提升', color: '#ef4444', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/30' },
              { key: 'D', label: 'D类 · 全面待提升', color: '#ef4444', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/30' },
            ] as const).map(q => {
              const count = qd[q.key as keyof typeof qd] || 0;
              const total = (qd.A || 0) + (qd.B || 0) + (qd.C || 0) + (qd.D || 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={q.key} className={`${q.bg} rounded-lg p-4 border ${q.border}`}>
                  <p className="text-xs font-semibold mb-1" style={{ color: q.color }}>{q.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground">人 ({pct}%)</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: q.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Alerts */}
        <div className="bg-card rounded-lg shadow-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">预警提示</h2>
          <div className="space-y-3">
            {qd.D > 0 && (
              <div className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{qd.D}人处于D类</p>
                  <p className="text-xs text-muted-foreground">过程+结果双不达标，建议立即推送复训方案</p>
                </div>
              </div>
            )}
            {qd.C > 0 && (
              <div className="flex items-start gap-3 p-3 bg-[#f59e0b]/5 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{qd.C}人过程线待提升</p>
                  <p className="text-xs text-muted-foreground">过程存在隐患，可能存在运气型表现</p>
                </div>
              </div>
            )}
            {qd.A > 0 && (
              <div className="flex items-start gap-3 p-3 bg-[#22c55e]/5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{qd.A}人全面达标</p>
                  <p className="text-xs text-muted-foreground">可进入阶段三独立接诊</p>
                </div>
              </div>
            )}
            {qd.A === 0 && qd.D === 0 && qd.C === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">暂无预警</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-card rounded-lg shadow-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">最近动态</h2>
        <div className="text-center py-8">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">培训数据将随着使用逐步积累</p>
        </div>
      </div>
    </div>
  );
}
