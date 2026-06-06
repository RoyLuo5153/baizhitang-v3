# 三层递进质量把控体系补全方案

## 概述

百芝堂培训管理系统的核心价值在于"三层递进质量把控"：培训过程(教他做)→过程质检(查他做得对不对)→结果倒推(看效果好不好)。当前系统三层各自有基础数据，但层间联动断裂、自动触发缺失。本方案打通三层联动链路，实现不合格→自动匹配赋能→推送的闭环。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 16 + App Router | 已有项目 |
| 数据库 | Supabase PostgreSQL | 已有 |
| 触发机制 | 后端triggers.ts扩展 | 已有基础设施 |
| 前端 | Shadcn/ui + Tailwind | 已有 |
| 图表 | Recharts | 已有 |

## 功能模块

### 模块1：结果线自动预警+赋能触发
- 业务指标(business_data)写入后，自动与thresholds对比
- 低于合格线的指标→自动创建empower_execution→匹配empower_plans→通知导师+培训经理
- 新增 `/api/empower/auto-trigger` 接口
- 扩展 `triggers.ts` 新增 `onResultBelowThreshold`

### 模块2：质检与19核心动作打通
- qc_records新增 `node_key` 字段(关联服务节点：首通/回访/预约/面诊)
- qc_records的4维度评分映射到19动作的节点分组
- 新增"服务流程质量追踪"视图：首通→回访→预约→面诊，每节点显示质检分数+动作完成率
- 扩展 `/api/qc` 支持按node_key查询

### 模块3：阶段进阶硬控制
- 阶段进阶条件改为服务端校验，不满足条件不允许进阶
- 学习期→练习期：闯关/课程全部完成
- 练习期→独立期：连续2周过程线全部达标（系统自动检查，非手动确认）
- 独立期→熟练期：连续4周A类
- 新增 `/api/stage-applications` 审批接口，支持自动审批

### 模块4：三层层级驾驶舱
- 首页按角色分化增加三层质量总览
- 第一层：培训进度概览（课程完成率/闯关通过率/阶段分布）
- 第二层：过程质量概览（4节点质检热力图/19动作通过率/低分预警）
- 第三层：结果达标概览（6指标仪表盘/预警列表/赋能执行率）

## 是否有原型设计
是（设计引导已开启）

## 实施步骤

1. **阶段一：原型设计** — 加载design-canvas技能，设计三层质量驾驶舱+服务流程质量追踪页面原型
2. **后端：结果线自动预警触发** — 扩展triggers.ts新增onResultBelowThreshold + 新增/api/empower/auto-trigger接口 + business_data写入后自动对比阈值（涉及文件：triggers.ts, api/empower/auto-trigger/route.ts, api/business/route.ts）
3. **后端：质检与19动作打通** — qc_records新增node_key字段 + 扩展/api/qc支持节点查询 + 服务流程质量API（涉及文件：api/qc/route.ts, DB migration）
4. **后端：阶段进阶硬控制** — 完善stage-applications接口 + 自动审批逻辑 + 条件校验（涉及文件：api/stage-applications/route.ts, triggers.ts）
5. **前端：三层质量驾驶舱** — 首页/overview页增加三层总览区域（培训进度+过程质量+结果达标）（涉及文件：page.tsx, overview/page.tsx）
6. **前端：服务流程质量追踪** — 新增/qc-flow页面，按服务节点展示质量追踪（首通→回访→预约→面诊）（涉及文件：qc-flow/page.tsx, 侧边栏导航）
7. **代码检查与验证 + push GitHub**

## 页面规格

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页
- @page(/diagnosis) 双轨诊断
- @page(/empowerment) 赋能中心
- @page(/qc-flow) 服务质量追踪
- @page(/trainee-board) 新人看板
- @page(/overview) 全局概览

##### @page(/qc-flow) 服务质量追踪

**核心职责**：按4个服务节点(首通→回访→预约→面诊)追踪新人服务全流程质量，每节点展示质检分数+19动作完成率+低分预警
**访问路径**：侧边栏导航直达
**布局**：顶部阶段切换(学习期/练习期/独立期) + 节点流程横向泳道(4个节点从左到右) + 每节点卡片(质检分数/动作完成率/低分动作列表) + 底部特殊患者情况区

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 节点卡片 | 点击 | 展开该节点的19动作详情 | node_key | — |
| 动作行 | 点击 | 弹出评分详情+话术模板 | action_id | — |
| 低分预警标签 | 点击 | 跳转 @page(/empowerment) | — | 带indicator参数 |
| 特殊患者类型 | 点击 | 展开对应的补充动作 | case_type | — |

##### @page(/) 首页(三层驾驶舱)

**核心职责**：按角色展示三层递进质量总览——培训进度(第一层)→过程质量(第二层)→结果达标(第三层)
**访问路径**：导航栏Logo
**布局**：
- training_manager: 三层横排(培训进度/过程质量/结果达标)，每层一个统计卡片区
- trainee: 我的成长进度(当前阶段+待完成任务+我的处方)
- mentor: 带教学员质量概览(学员4节点分数+低分预警)
- boss: 经营指标仪表盘(已有overview)

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 三层卡片 | 点击 | 跳转对应功能页 | — | 培训→learning, 过程→qc-flow, 结果→diagnosis |
| 预警条目 | 点击 | 跳转 @page(/empowerment) | — | — |
