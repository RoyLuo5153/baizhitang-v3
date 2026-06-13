# 母表前端展示入口 — 实施计划

## 概述

为工单 V3-20260613-DT 已完成的 4 张母表（config_dict、stage_definitions、events、capability_scores）补齐前端可视化入口。在 settings 页面新增"配置中心"和"阶段规则"两个子 Tab；在 trainee-profiles 详情页嵌入事件时间线组件；在 diagnosis 诊断页嵌入能力雷达图组件。平台：web。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 16 App Router + React 19 | 项目既定技术栈 |
| UI 组件 | shadcn/ui + Tailwind CSS 4 | 项目既定组件库 |
| 数据获取 | 已有 `/api/config`、`/api/stage-definitions`、`/api/events`、`/api/capability` | 上轮已建好 API |
| 图表 | Recharts（雷达图） | 轻量、React 原生、项目已安装 |
| 路由 | 不新增独立页面，在现有页面内嵌 Tab/组件 | 减少导航复杂度 |

## 功能模块

### 1. 配置中心（settings 页新增 Tab）

**职责**：config_dict 18 条配置的可视化查看与编辑。
**入口**：settings 页面新增 `config-center` Tab，仅 training_manager / boss 可见。
**数据结构**：
```ts
interface ConfigEntry {
  id: number;
  category: string;
  config_key: string;
  config_value: string;
  value_type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  updated_by: string | null;
  updated_at: string;
}
```
**要点**：
- 按 category 分组折叠展示（thresholds / weights / stages / system）
- 每行显示 key、当前值、描述，点击可编辑
- 编辑弹窗根据 value_type 渲染不同输入控件（数字/文本/开关/JSON）
- 保存调用 `PUT /api/config`

### 2. 阶段规则管理（settings 页新增 Tab）

**职责**：stage_definitions 4 阶段规则的可视化查看与编辑。
**入口**：settings 页面新增 `stage-rules` Tab，仅 training_manager / boss 可见。
**数据结构**：
```ts
interface StageDefinition {
  id: number;
  stage_name: string;
  stage_order: number;
  duration_days: number;
  rule_type: string;
  exit_criteria: Record<string, unknown> | null;
  auto_trigger_rules: Record<string, unknown> | null;
  daily_checklist: string[] | null;
  warning_thresholds: Record<string, unknown> | null;
  is_active: boolean;
}
```
**要点**：
- 4 阶段卡片网格展示（学习期/练习期/独立期/熟练期）
- 每卡片显示：阶段名、天数、退出条件摘要、预警阈值
- 点击卡片弹出编辑抽屉，可修改 duration_days / exit_criteria / warning_thresholds
- 保存调用 `PUT /api/stage-definitions`

### 3. 事件时间线（trainee-profiles 详情页嵌入）

**职责**：在 trainee-profiles 详情页展示该用户的统一事件流。
**入口**：trainee-profiles 页面中，点击某行学员 → 详情面板新增"事件时间线"区块。
**数据结构**：
```ts
interface EventRecord {
  id: number;
  event_type: string;
  user_id: string;
  actor_id: string | null;
  source_table: string;
  source_id: string;
  event_data: Record<string, unknown> | null;
  happened_at: string;
}
```
**要点**：
- 时间线纵向排列，最新在上
- 每条显示：事件类型图标 + 描述文本 + 时间
- 支持按事件类型筛选（质检/任务/赋能/阶段变更）
- 默认展示最近 30 天，可切换 7/30/90 天
- 数据来源 `GET /api/events?user_id=xxx`

### 4. 能力雷达图（diagnosis 诊断页嵌入）

**职责**：在 diagnosis 诊断页展示选中学员的 5 维能力雷达图。
**入口**：diagnosis 页面，点击某学员 → 详情面板新增"能力雷达"区块。
**数据结构**：
```ts
interface RadarPoint {
  dimension: string;  // 沟通力/专业力/执行力/数据力/成长力
  score: number;      // 0-100
}
```
**要点**：
- 使用 Recharts RadarChart 渲染五边形雷达图
- 5 个维度：沟通力、专业力、执行力、数据力、成长力
- 无数据时显示空态提示"暂无能力评分"
- 数据来源 `GET /api/capability?user_id=xxx`

## 是否有原型设计

是

## 实施步骤

### 阶段一：原型设计

1. 加载 design-canvas 技能，按技能流程完成 4 个前端入口的原型 HTML 设计（配置中心 Tab、阶段规则 Tab、事件时间线组件、能力雷达图组件）

### 阶段二：代码开发

2. settings 页新增"配置中心"和"阶段规则"两个子 Tab，实现 config_dict 和 stage_definitions 的可视化编辑
   - 涉及文件：`src/app/(dashboard)/settings/page.tsx`

3. trainee-profiles 详情面板嵌入事件时间线组件，支持筛选和分时间范围查看
   - 涉及文件：`src/app/(dashboard)/trainee-profiles/page.tsx`

4. diagnosis 诊断页详情面板嵌入能力雷达图组件，使用 Recharts 渲染 5 维雷达
   - 涉及文件：`src/app/(dashboard)/diagnosis/page.tsx`

5. 执行代码检查与接口测试验证
