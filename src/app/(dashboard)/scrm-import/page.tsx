'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Database, Upload, FileSpreadsheet, Save, AlertCircle,
  CheckCircle2, TrendingUp, ChevronUp,
  FileUp, Download, X, FileText,
} from 'lucide-react';
import { apiGet } from '@/lib/api-client';

/* ── Types ── */
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

/* ── Funnel stage config ── */
const FUNNEL_STAGES = [
  { key: 'wechat_add_rate',    label: '加V',  threshold: 90 },
  { key: 'consultation_rate',  label: '面诊', threshold: 85 },
  { key: 'reception_rate',     label: '接诊', threshold: 80 },
  { key: 'delivery_rate',      label: '签收', threshold: 85 },
  { key: 'medication_rate',    label: '用药', threshold: 90 },
  { key: 'appointment_rate',   label: '挂号', threshold: 80 },
] as const;

type FunnelStageKey = typeof FUNNEL_STAGES[number]['key'];



/* ── Main Page ── */
export default function ScrmImportPage() {
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const result = await apiGet<{ data: BusinessRecord[] }>('/api/business', { data: [] });
    setRecords(result.data);
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">业务数据</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">录入和管理SCRM业务数据，支撑结果线对标</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 批量导入 button */}
          <button
            onClick={() => setShowBatchImport(true)}
            className="border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted/60 active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            <FileUp className="w-3.5 h-3.5" />批量导入
          </button>
          {/* 录入数据 button */}
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />录入数据
          </button>
        </div>
      </div>

      {/* Funnel Visualization */}
      <FunnelChart />

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

      {/* Batch Import Modal */}
      {showBatchImport && (
        <BatchImportModal onClose={() => setShowBatchImport(false)} />
      )}
    </div>
  );
}

/* ── Threshold display helper ── */
function ThresholdValue({ value, threshold }: { value: number | null; threshold: number }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  const pass = value >= threshold;
  return (
    <span className={`font-medium ${pass ? 'text-[#22c55e]' : 'text-destructive'}`}>
      {value}%
    </span>
  );
}

/* ══════════════════════════════════════════════
   Funnel Chart Component (inline SVG)
   ══════════════════════════════════════════════ */
function FunnelChart() {
  const [expandedStage, setExpandedStage] = useState<FunnelStageKey | null>(null);
  const [teamAverages, setTeamAverages] = useState<Record<FunnelStageKey, number> | null>(null);
  const [traineeBreakdowns, setTraineeBreakdowns] = useState<Record<FunnelStageKey, { name: string; rate: number }[]> | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(true);

  useEffect(() => {
    async function fetchFunnel() {
      const result = await apiGet<{ teamAverages?: Record<FunnelStageKey, number>; traineeBreakdowns?: Record<FunnelStageKey, { name: string; rate: number }[]> }>('/api/business/funnel', {});
      if (result.teamAverages) setTeamAverages(result.teamAverages);
      if (result.traineeBreakdowns) setTraineeBreakdowns(result.traineeBreakdowns);
      setFunnelLoading(false);
    }
    fetchFunnel();
  }, []);

  const handleStageClick = (key: FunnelStageKey) => {
    if (!teamAverages) return;
    setExpandedStage(prev => (prev === key ? null : key));
  };

  /* SVG layout constants */
  const svgW = 780;
  const svgH = 140;
  const stageCount = FUNNEL_STAGES.length;
  const padX = 16;
  const gap = 6;
  const stageW = (svgW - padX * 2 - gap * (stageCount - 1)) / stageCount;
  const topH = 56;    // height at top (widest part)
  const bottomH = 36;  // height at bottom (narrowest part)
  const centerY = svgH / 2;
  const thresholdLineY = centerY + topH / 2 + 14; // below the funnel shape

  return (
    <div className="bg-card rounded-lg shadow-card border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">漏斗详情</h2>
          <span className="text-xs text-muted-foreground ml-1">团队最新周均值 · 点击阶段展开明细</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} /> 达标
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--destructive)' }} /> 未达标
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 border-t-2 border-dashed border-muted-foreground/40" /> 合格线
          </span>
        </div>
      </div>

      {/* Funnel SVG */}
      {funnelLoading ? (
        <div className="px-4 pt-4 pb-2 flex items-center justify-center h-[160px]">
          <p className="text-sm text-muted-foreground">加载漏斗数据...</p>
        </div>
      ) : !teamAverages ? (
        <div className="px-4 pt-6 pb-4 flex flex-col items-center justify-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">暂无漏斗数据</p>
          <p className="text-xs text-muted-foreground mt-1">录入业务数据后自动生成</p>
        </div>
      ) : (
      <div className="px-4 pt-4 pb-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          style={{ fontFamily: 'var(--font-sans)', maxHeight: 160 }}
        >
          <defs>
            {/* Green gradient for passing stages */}
            <linearGradient id="funnelGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.08" />
            </linearGradient>
            {/* Red gradient for failing stages */}
            <linearGradient id="funnelRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity="0.06" />
            </linearGradient>
            {/* Arrow marker for connectors */}
            <marker id="arrowHead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--muted-foreground)" strokeWidth="1" opacity="0.5" />
            </marker>
          </defs>

          {FUNNEL_STAGES.map((stage, i) => {
            const rate = teamAverages[stage.key];
            const pass = rate >= stage.threshold;
            const isExpanded = expandedStage === stage.key;

            /* Trapezoid: narrows from left to right */
            const x = padX + i * (stageW + gap);
            /* Top edge: full height, bottom edge: slightly less */
            const shrinkPerStage = (topH - bottomH) / (stageCount - 1);
            const currentTopHalf = topH / 2;
            const currentBottomHalf = topH / 2 - shrinkPerStage * i * 0.5;

            const topLeft = centerY - currentTopHalf;
            const bottomLeft = centerY + currentTopHalf;
            const topRight = centerY - currentBottomHalf;
            const bottomRight = centerY + currentBottomHalf;

            const fillColor = pass ? 'url(#funnelGreen)' : 'url(#funnelRed)';
            const strokeColor = pass ? '#22c55e' : 'var(--destructive)';
            const textColor = pass ? '#22c55e' : 'var(--destructive)';

            return (
              <g
                key={stage.key}
                onClick={() => handleStageClick(stage.key)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${stage.label} ${rate}% ${pass ? '达标' : '未达标'}`}
              >
                {/* Trapezoid shape */}
                <polygon
                  points={`${x},${topLeft} ${x + stageW},${topRight} ${x + stageW},${bottomRight} ${x},${bottomLeft}`}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isExpanded ? 2 : 1.2}
                  strokeLinejoin="round"
                  style={{ transition: 'stroke-width 0.15s ease' }}
                />

                {/* Hover highlight overlay */}
                <polygon
                  points={`${x},${topLeft} ${x + stageW},${topRight} ${x + stageW},${bottomRight} ${x},${bottomLeft}`}
                  fill="white"
                  opacity={0}
                  className="funnel-hover-overlay"
                  style={{ transition: 'opacity 0.15s ease' }}
                  onMouseEnter={e => { (e.target as SVGElement).setAttribute('opacity', '0.06'); }}
                  onMouseLeave={e => { (e.target as SVGElement).setAttribute('opacity', '0'); }}
                />

                {/* Stage label (top) */}
                <text
                  x={x + stageW / 2}
                  y={centerY - 8}
                  textAnchor="middle"
                  fill="var(--foreground)"
                  fontSize={12}
                  fontWeight={600}
                >
                  {stage.label}
                </text>

                {/* Rate percentage (center) */}
                <text
                  x={x + stageW / 2}
                  y={centerY + 12}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize={16}
                  fontWeight={700}
                >
                  {rate}%
                </text>

                {/* Arrow connector between stages */}
                {i < stageCount - 1 && (
                  <path
                    d={`M${x + stageW + 1.5},${centerY} L${x + stageW + gap - 1.5},${centerY}`}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.2}
                    markerEnd="url(#arrowHead)"
                    opacity={0.5}
                  />
                )}

                {/* Threshold dashed line below */}
                <line
                  x1={x + 4}
                  y1={thresholdLineY}
                  x2={x + stageW - 4}
                  y2={thresholdLineY}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.2}
                  strokeDasharray="4,3"
                  opacity={0.5}
                />
                <text
                  x={x + stageW / 2}
                  y={thresholdLineY + 12}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontSize={9}
                >
                  合格 {stage.threshold}%
                </text>

                {/* Expanded indicator */}
                {isExpanded && (
                  <polygon
                    points={`${x + stageW / 2 - 5},${bottomLeft + 4} ${x + stageW / 2 + 5},${bottomLeft + 4} ${x + stageW / 2},${bottomLeft + 10}`}
                    fill={strokeColor}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      )}

      {/* Expanded trainee breakdown */}
      {expandedStage && traineeBreakdowns && (
        <TraineeBreakdown
          stageKey={expandedStage}
          stageConfig={FUNNEL_STAGES.find(s => s.key === expandedStage)!}
          data={traineeBreakdowns[expandedStage] || []}
          onClose={() => setExpandedStage(null)}
        />
      )}
    </div>
  );
}

/* ── Trainee breakdown panel (expanded below funnel) ── */
function TraineeBreakdown({
  stageKey,
  stageConfig,
  data,
  onClose,
}: {
  stageKey: FunnelStageKey;
  stageConfig: { key: FunnelStageKey; label: string; threshold: number };
  data: { name: string; rate: number }[];
  onClose: () => void;
}) {
  const sorted = [...data].sort((a, b) => b.rate - a.rate);
  const aboveCount = sorted.filter(d => d.rate >= stageConfig.threshold).length;
  const belowCount = sorted.length - aboveCount;

  /* Mini bar chart dimensions */
  const maxRate = 100;
  const barHeight = 18;
  const barGap = 6;
  const labelW = 56;
  const valueW = 48;
  const chartPadR = 12;

  return (
    <div className="border-t border-border bg-muted/20 animate-in slide-in-from-top-1 duration-200">
      <div className="px-5 py-4">
        {/* Sub-header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              「{stageConfig.label}」个人明细
            </h3>
            <span className="text-xs text-muted-foreground">
              合格线 {stageConfig.threshold}% · 达标 {aboveCount}/{sorted.length} 人
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e]">
            <CheckCircle2 className="w-3 h-3" /> {aboveCount}人达标
          </span>
          {belowCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="w-3 h-3" /> {belowCount}人未达标
            </span>
          )}
        </div>

        {/* Bar chart grid */}
        <div className="space-y-0">
          {sorted.map((trainee, i) => {
            const pass = trainee.rate >= stageConfig.threshold;
            const barColor = pass ? '#22c55e' : 'var(--destructive)';
            const barBg = pass ? 'rgba(34,197,94,0.08)' : 'rgba(var(--destructive),0.06)';
            const barW = (trainee.rate / maxRate) * 100;
            const thresholdX = (stageConfig.threshold / maxRate) * 100;

            return (
              <div
                key={trainee.name}
                className="flex items-center gap-0 py-[3px]"
              >
                {/* Rank + Name */}
                <div className="flex items-center gap-2" style={{ width: labelW, minWidth: labelW }}>
                  <span className={`text-[10px] font-mono w-4 text-right ${i < 3 ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <span className="text-xs text-foreground font-medium truncate">{trainee.name}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 relative h-5">
                  {/* Background track */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{ width: `${barW}%`, backgroundColor: barBg }}
                  />
                  {/* Filled portion */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                    style={{ width: `${barW}%`, backgroundColor: barColor, opacity: 0.7 }}
                  />
                  {/* Threshold marker */}
                  <div
                    className="absolute inset-y-0"
                    style={{ left: `${thresholdX}%` }}
                  >
                    <div className="w-0 h-full border-l border-dashed border-muted-foreground/40" />
                  </div>
                </div>

                {/* Value */}
                <div style={{ width: valueW, minWidth: valueW }} className="text-right pr-1">
                  <span className={`text-xs font-bold ${pass ? 'text-[#22c55e]' : 'text-destructive'}`}>
                    {trainee.rate}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Batch Import Modal
   ══════════════════════════════════════════════ */
function BatchImportModal({ onClose }: { onClose: () => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parseStep, setParseStep] = useState<'upload' | 'preview'>('upload');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setUploadedFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  }, []);

  const handleSimulateParse = () => {
    /* V1: just move to preview step with placeholder data */
    setParseStep('preview');
  };

  /* Mock preview rows */
  const PREVIEW_ROWS = [
    { period: '2024-W45', name: '张明', wechat: 96, consultation: 89, reception: 85, delivery: 92, medication: 94, appointment: 80 },
    { period: '2024-W45', name: '李婷', wechat: 94, consultation: 85, reception: 82, delivery: 90, medication: 88, appointment: 78 },
    { period: '2024-W45', name: '王磊', wechat: 88, consultation: 72, reception: 70, delivery: 80, medication: 78, appointment: 62 },
    { period: '2024-W45', name: '赵雪', wechat: 91, consultation: 88, reception: 90, delivery: 94, medication: 92, appointment: 82 },
    { period: '2024-W45', name: '陈浩', wechat: 82, consultation: 68, reception: 65, delivery: 78, medication: 74, appointment: 58 },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-dialog w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border/50">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">批量导入</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {parseStep === 'upload' ? (
            <div className="space-y-5">
              {/* Drag-and-drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                  ${dragActive
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : uploadedFile
                      ? 'border-[#22c55e] bg-[#22c55e]/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }
                `}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-3">
                  {uploadedFile ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto">
                        <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          拖拽文件到此处，或<span className="text-primary underline underline-offset-2">点击上传</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          支持 .xlsx、.xls、.csv 格式，单次最大 5MB
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Template download link */}
              <div className="flex items-center justify-center gap-2">
                <Download className="w-3.5 h-3.5 text-primary" />
                <button className="text-sm text-primary hover:underline underline-offset-2 font-medium">
                  下载导入模板
                </button>
                <span className="text-xs text-muted-foreground">（含字段说明和示例数据）</span>
              </div>

              {/* Template format guide */}
              <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">模板字段说明</p>
                <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">周期开始 <span className="text-foreground font-medium">日期</span></span>
                  <span className="text-muted-foreground">周期结束 <span className="text-foreground font-medium">日期</span></span>
                  <span className="text-muted-foreground">姓名 <span className="text-foreground font-medium">文本</span></span>
                  <span className="text-muted-foreground">加V率 <span className="text-foreground font-medium">0-100</span></span>
                  <span className="text-muted-foreground">面诊率 <span className="text-foreground font-medium">0-100</span></span>
                  <span className="text-muted-foreground">接诊率 <span className="text-foreground font-medium">0-100</span></span>
                  <span className="text-muted-foreground">签收率 <span className="text-foreground font-medium">0-100</span></span>
                  <span className="text-muted-foreground">用药率 <span className="text-foreground font-medium">0-100</span></span>
                  <span className="text-muted-foreground">挂号率 <span className="text-foreground font-medium">0-100</span></span>
                  <span className="text-muted-foreground">备注 <span className="text-foreground font-medium">文本(可选)</span></span>
                </div>
              </div>

              {/* V1 placeholder notice */}
              <div className="flex items-start gap-3 p-3 bg-[#f59e0b]/5 rounded-lg border border-[#f59e0b]/20">
                <AlertCircle className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">功能预告</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Excel解析功能即将上线，当前请使用单条录入。下方预览为演示数据。
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSimulateParse}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  预览数据
                </button>
              </div>
            </div>
          ) : (
            /* Preview step */
            <div className="space-y-5">
              {/* Success message */}
              <div className="flex items-start gap-3 p-3 bg-[#22c55e]/5 rounded-lg border border-[#22c55e]/20">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">数据解析完成</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    共解析 {PREVIEW_ROWS.length} 条记录（预览前5行）
                  </p>
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">周期</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">姓名</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">加V率</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">面诊率</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">接诊率</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">签收率</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">用药率</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">挂号率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {PREVIEW_ROWS.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-foreground font-medium">{row.period}</td>
                        <td className="px-3 py-2 text-foreground">{row.name}</td>
                        <td className="px-3 py-2 text-center">
                          <ThresholdValue value={row.wechat} threshold={90} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ThresholdValue value={row.consultation} threshold={85} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ThresholdValue value={row.reception} threshold={80} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ThresholdValue value={row.delivery} threshold={85} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ThresholdValue value={row.medication} threshold={90} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ThresholdValue value={row.appointment} threshold={80} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Validation summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{PREVIEW_ROWS.length}</p>
                  <p className="text-[10px] text-muted-foreground">有效记录</p>
                </div>
                <div className="bg-[#22c55e]/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-[#22c55e]">3</p>
                  <p className="text-[10px] text-muted-foreground">全部达标</p>
                </div>
                <div className="bg-destructive/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-destructive">2</p>
                  <p className="text-[10px] text-muted-foreground">存在不达标项</p>
                </div>
              </div>

              {/* V1 notice on confirm */}
              <div className="flex items-start gap-3 p-3 bg-[#f59e0b]/5 rounded-lg border border-[#f59e0b]/20">
                <AlertCircle className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">功能预告</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Excel解析功能即将上线，当前请使用单条录入。确认导入按钮暂时不可用。
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setParseStep('upload')}
                  className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                >
                  返回上传
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    取消
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground opacity-50 cursor-not-allowed inline-flex items-center gap-2"
                    title="Excel解析功能即将上线"
                  >
                    <Save className="w-3.5 h-3.5" />
                    确认导入
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Business Data Form (existing, unchanged) ── */
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
