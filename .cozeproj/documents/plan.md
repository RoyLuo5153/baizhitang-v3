# 待落地工单执行计划

> 机制零：工单不落地 = 系统不可用。以下为昨今讨论的所有改进方案，按优先级排序，小步快跑逐项落地。

## 工单总览

| 编号 | 工单名称 | 优先级 | 状态 | 核心改动 |
|------|---------|--------|------|---------|
| J | 阶段通关验证改造+双线状态机 | P0 | 原型已完成，待开发 | 21关→8模块、双线状态、考后闭环 |
| K | 赋能中心处方化改造 | P0 | 待开发 | content渲染修复、4段式处方、indicator_key可读化 |
| L | 用户管理期数字段 | P1 | 待开发 | settings页加cohort编辑、关联trainee_profiles |

## 工单J：阶段通关验证改造+双线状态机

### 改动范围
1. **数据库迁移**：新建assessment_modules + module_progress表，扩展questions/learning_levels/trainee_profiles字段
2. **后端API**：重写/api/learning为模块化、新建/api/learning/modules/[moduleCode]/submit、更新/api/questions
3. **触发器**：新增onModulePassed/onModuleFailed
4. **前端**：重写learning/page.tsx（21关地图→模块卡片网格+双线状态卡）
5. **题库适配**：题库管理加module/stage筛选

### 执行步骤
1. 数据库迁移SQL执行 + schema.ts更新
2. 后端API开发（模块列表+答题提交+题库筛选）
3. 触发器升级（onModulePassed/onModuleFailed + 双线状态转换）
4. 前端learning/page.tsx重写
5. 题库管理页module/stage适配
6. 联调测试

## 工单K：赋能中心处方化改造

### 问题描述
- content字段是{steps:[...]}对象，渲染为[object Object]（已有部分兼容但不够完善）
- indicator_key显示内部key（如qc_communication）而非可读标签
- 方案内容不像处方：缺乏病情分析→调理方向→具体药方→达标标准的4段式结构
- 系统未根据不合格指标自动匹配推荐赋能方案

### 改动范围
1. **content渲染修复**：完善4段式处方卡片展示（病情分析/调理方向/具体药方/达标标准）
2. **indicator_key可读化**：建立映射表，qc_communication→质检-沟通能力
3. **数据库赋能方案内容升级**：更新现有8条empower_plans的content为4段式处方结构
4. **自动匹配推荐**：诊断结果中不合格指标→自动关联对应赋能方案
5. **推送弹窗增强**：展示完整处方预览而非简单方案名

### 执行步骤
1. 前端content渲染修复 + indicator_key映射
2. 数据库方案内容升级为4段式处方
3. 自动匹配推荐逻辑
4. 推送弹窗增强
5. 测试验证

## 工单L：用户管理期数字段

### 改动范围
1. **settings/page.tsx**：用户管理表格加cohort列，支持内联编辑
2. **API**：/api/users支持cohort字段读写
3. **关联**：cohort字段与trainee_profiles的cohort同步

### 执行步骤
1. API加cohort字段
2. settings页加cohort列和编辑
3. 测试验证

## 执行顺序（小步快跑）

按影响面和紧迫性：
1. **工单J**（阶段通关改造）— 已有原型，最大结构性改造，为P1/P2铺路
2. **工单K**（赋能处方化）— 用户带截图反馈的痛点，直接影响使用体验
3. **工单L**（期数字段）— 小改动，穿插完成
