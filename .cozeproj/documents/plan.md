# 工单J：阶段通关验证改造 + 双线状态机

## 概述

将闯关学习从21关线性推进改造为模块化阶段通关验证（4基础模块+4实操模块），同时在trainee_profiles新增双线状态字段（process_status / result_status），为后续P1实操带教和P2归因体系铺路。Web平台，Supabase数据库。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 数据库变更 | 新增assessment_modules + module_progress表，扩展questions/trainee_profiles字段 | 与旧表并存，不破坏level_progress/quiz_attempts |
| 阶段状态 | trainee_profiles.stage/process_status/result_status | 工单指定，users.stage保留向后兼容 |
| API策略 | 新增模块化API(/api/learning/modules)，旧21关API保留 | 平滑迁移，前端依赖新API |
| 关卡结构 | 8个模块(4基础+4实操)替代21关 | 工单J2定义 |
| 向后兼容 | level_progress/quiz_attempts/learning_levels表保留不动 | 旧数据不丢失 |

## 功能模块

### M1. 数据库迁移（J1+J2+J3+J5）

**新增表：**

```
assessment_modules:
  id, code(unique), name, stage(foundation/practice),
  description, sort_order, is_active, pass_threshold(default 80),
  question_count(default 10), created_at, updated_at
  预置数据：4基础(diabetes_basics/service_standards/service_language/compliance)
           +4实操(first_call/followup_call/appointment_call/visit_day)

module_progress:
  id, user_id(→users), module_code, status(locked/active/in_progress/passed),
  best_score, attempts, last_attempt_at, passed_at,
  created_at, updated_at
  UNIQUE(user_id, module_code)
```

**扩展字段：**
- questions: +module(varchar 50), +stage(varchar 20 default 'foundation')
- learning_levels: +module(varchar 50), +pass_threshold(int default 80), +question_count(int default 10)
- trainee_profiles: +stage(varchar 20 default 'foundation'), +process_status(varchar 20 default 'not_started'), +result_status(varchar 20 default 'not_started')

**数据反填：**
- questions按level_id反填module/stage
- learning_levels按level_id反填module
- trainee_profiles按users.stage反填stage/process_status/result_status

### M2. 模块化API（J4+J5）

**GET /api/learning/modules** — 模块列表+进度
- 读取assessment_modules表，关联module_progress
- 返回每个模块：code, name, stage, questionCount, passThreshold, status, bestScore, attempts
- 返回currentStage, processStatus, resultStatus, stageProgress
- 删除FALLBACK_NAMES硬编码

**POST /api/learning/modules/[moduleCode]/submit** — 模块化答题提交
- 按module+stage从questions表随机抽题
- 评分逻辑不变
- 通过→检查同stage全部模块→触发阶段转换
- 未通过→推送错题关联知识库复习通知

**GET /api/learning/modules/list** — 供题库管理用的模块定义列表

### M3. 触发器升级（J6）

新增onModulePassed / onModuleFailed：
- onModulePassed：检查同stage所有模块是否passed→全部通过则更新trainee_profiles双线状态
- onModuleFailed：推送复习通知→连续3次通知带教老师
- 保留原有onQuizPassed/onQuizFailed（向后兼容）

状态转换规则：
```
基础通关全通过 → stage=practice, process_status=monitoring, result_status=insufficient_data
实操通关全通过 → stage=qualified, process_status=passed, result_status=passed
```

### M4. 前端改版（J7）

learning/page.tsx：从21关地图→阶段+模块卡片网格
- 删除STAGE_LABELS/STAGE_SHORT硬编码
- 基础通关：4模块卡片（糖尿病基础/服务标准/服务用语/合规红线）
- 实操通关：4模块卡片（基础通关通过后解锁）
- 底部"我的状态"卡片：当前阶段 + process_status + result_status
- 点击模块卡片→弹出答题面板（复用现有答题组件）

### M5. 题库管理适配（J8）

questions API：GET新增module/stage筛选，POST支持module/stage
题库管理UI：题目筛选新增module/stage，创建/编辑题目可选module

## 是否有原型设计

是（设计引导已开启）

## 实施步骤

1. **数据库迁移**：执行SQL迁移（新建assessment_modules + module_progress表，扩展questions/learning_levels/trainee_profiles字段，反填数据，更新schema.ts） — 涉及 schema.ts + SQL迁移
2. **模块化API开发**：重写/api/learning为模块化列表API，新建/api/learning/modules/[moduleCode]/submit提交API，更新/api/questions支持module/stage筛选 — 涉及 learning/route.ts + learning/modules/ + questions/route.ts
3. **触发器升级**：新增onModulePassed/onModuleFailed，实现双线状态自动转换 — 涉及 triggers.ts
4. **前端改版**：重写learning/page.tsx，21关地图→模块卡片网格，新增"我的状态"卡片 — 涉及 learning/page.tsx
5. **题库管理适配**：题库管理页新增module/stage筛选和编辑字段 — 涉及 settings/page.tsx或question-bank/page.tsx
6. **联调测试**：模块化答题+阶段转换+双线状态更新全流程验证

## 页面规格

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页
- @page(/learning) 阶段通关
- @page(/growth) 成长档案
- @page(/diagnosis) 双轨诊断
- @page(/empowerment) 赋能中心
- @page(/dashboard) 数据看板
- @page(/overview) 全局概览
- @page(/question-bank) 题库管理
- @page(/resources) 资料中心
- @page(/qc-review) 质检审核
- @page(/assessment) 日常考核
- @page(/trainee-board) 新人看板
- @page(/trainee-profiles) 新人档案
- @page(/practice) 演练任务
- @page(/courses) 课程管理
- @page(/settings) 系统设置

##### @page(/learning) 阶段通关

**核心职责**：模块化阶段通关验证，替代原21关线性闯关
**访问路径**：顶部导航直达
**布局**：顶部标题栏(阶段通关+已通过数) → 阶段进度条(基础通关/实操通关) → 基础通关4模块卡片网格 → 实操通关4模块卡片(基础通关通过后解锁) → 底部"我的状态"卡片(当前阶段+过程线状态+结果线状态)
**列表项字段**：模块名 / 模块状态(✅可考🔒已通过📋进行中) / 最高分 / 答题次数 / 题目数量

**弹窗 quiz-panel**：
- 点击模块卡片弹出答题面板
- 随机抽取该模块题目
- 提交后显示得分和通过/未通过
- 未通过显示推荐复习知识点

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 模块卡片(可考) | 点击 | 弹出 @modal(quiz-panel) | moduleCode | status=active |
| 模块卡片(已通过) | 点击 | 弹出 @modal(quiz-panel) 查看历史成绩 | moduleCode | status=passed，可重考 |
| 模块卡片(锁定) | 点击 | Toast提示"完成前置阶段后解锁" | — | status=locked |
| 答题面板提交 | 点击 | 评分→更新进度→判断阶段转换 | moduleCode, answers | 通过时检查全阶段 |
| 答题未通过 | — | 推送复习通知 | moduleCode | 关联知识库内容 |
| 我的状态卡片 | 展示 | 当前阶段+双线状态 | — | process_status/result_status |
