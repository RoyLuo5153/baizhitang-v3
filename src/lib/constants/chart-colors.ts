/**
 * 图表颜色常量 — 工单I统一规范
 * 绿色=达标 / 黄色=预警 / 红色=危险
 */

export const CHART_COLORS = {
  /** 达标 — 健康/合格 */
  green: '#22C55E',
  /** 预警 — 介于达标和危险之间 */
  yellow: '#F59E0B',
  /** 危险 — 低于合格线 */
  red: '#EF4444',

  /** 数据蓝 — 中性数据展示 */
  blue: '#2978B5',
  /** 深蓝 — 标题/主色 */
  darkBlue: '#102A43',

  /** 暖底背景 */
  warmBg: '#F8F6F0',
  /** 网格线 */
  gridLine: '#E6E1D8',
  /** 次要文字 */
  muted: '#667085',
} as const;

/** 根据分数获取状态色 */
export function getStatusColor(value: number, thresholds: { green: number; yellow: number }): string {
  if (value >= thresholds.green) return CHART_COLORS.green;
  if (value >= thresholds.yellow) return CHART_COLORS.yellow;
  return CHART_COLORS.red;
}

/** 根据象限获取颜色 */
export function getQuadrantColor(quadrant: string): string {
  switch (quadrant) {
    case 'A': return CHART_COLORS.green;
    case 'B': return CHART_COLORS.yellow;
    case 'C': return CHART_COLORS.yellow;
    case 'D': return CHART_COLORS.red;
    default: return CHART_COLORS.muted;
  }
}

/** 根据象限获取背景色（低透明度） */
export function getQuadrantBgColor(quadrant: string): string {
  switch (quadrant) {
    case 'A': return 'rgba(34, 197, 94, 0.12)';
    case 'B': return 'rgba(245, 158, 11, 0.12)';
    case 'C': return 'rgba(245, 158, 11, 0.12)';
    case 'D': return 'rgba(239, 68, 68, 0.12)';
    default: return 'rgba(102, 112, 133, 0.08)';
  }
}
