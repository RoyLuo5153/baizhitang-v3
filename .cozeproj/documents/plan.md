# 工单H：题库审核 + 日常考核修复 + 期数功能

## 概述
题库管理增加审核机制（teacher创建需审核，training_manager直接生效）；修复日常考核无法选择新人的bug；给trainee_profiles加期数字段，支持按期选择新人。Web平台，使用Supabase。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 审核模式 | 复用知识库审核模式 | 与knowledge_articles审核逻辑一致 |
| 期数字段 | trainee_profiles.cohort | 按入职批次分组，独立于部门 |

## 功能模块

### H1. 题库审核（复用知识库模式）
- questions表加3列：status(text default 'pending_review'), reviewed_by(integer), reviewed_at(timestamptz)
- POST：training_manager创建直接approved，其他角色pending_review
- 新建 review 接口：GET待审核列表 + PATCH审核操作
- 前端：审核状态列 + 待审核Tab + 审核操作按钮

### H2. 日常考核新人选择bug修复
- **根因**：assessment/page.tsx第484行读取 `json.profiles`，但API返回的是 `json.trainees`，字段名不匹配导致列表永远为空
- 修复：`json.profiles` → `json.trainees`，同时修正字段映射（id/name）

### H3. 期数功能
- trainee_profiles表加 cohort(text) 字段
- trainee-profiles API返回cohort字段
- 日常考核发布弹窗：加"按期选择"快捷按钮，点击某期自动勾选该期全部新人
- 新人档案页：可编辑期数

## 是否有原型设计
是

## 实施步骤

1. **阶段一：原型设计** — 加载design-canvas技能，完成题库管理+日常考核页面原型
2. 数据库DDL — questions表加3列 + trainee_profiles表加cohort列
3. 题库审核后端 — 改造questions API + 新建review接口 (questions/route.ts, questions/review/route.ts)
4. 题库审核前端 — 审核状态列 + 待审核Tab + 审核操作 (question-bank/page.tsx)
5. 日常考核bug修复 + 期数选择器 — json.trainees修复 + 期数下拉 (assessment/page.tsx)
6. 期数功能后端+档案页 — API返回cohort + 档案编辑 (trainee-profiles/route.ts, trainee-profiles/page.tsx)
7. 代码检查与验证

## 页面规格

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页
- @page(/question-bank) 题库管理
- @page(/assessment) 日常考核
- @page(/trainee-profiles) 新人档案

##### @page(/question-bank) 题库管理

**核心职责**：题库CRUD与审核管理
**访问路径**：侧边栏直达
**布局**：顶部Tab切换（全部题目/待审核）+ 搜索筛选区 + 题目列表卡片 + 新增/编辑弹窗
**列表项字段**：题目标题 / 题型 / 分类 / 审核状态 / 创建人 / 创建时间
**状态**：
- 空态：暂无题目
- 加载态：骨架屏

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 新增题目按钮 | 点击 | 打开@modal(question-form) | — | teacher/training_manager可见 |
| 题目卡片 | 点击 | 打开@modal(question-form)编辑模式 | question_id | teacher/training_manager可见 |
| 待审核Tab | 点击 | 刷新列表显示pending_review题目 | — | training_manager可见 |
| 审核通过按钮 | 点击 | 调用PATCH /api/questions/review approve | question_id | 仅training_manager |
| 审核拒绝按钮 | 点击 | 调用PATCH /api/questions/review reject | question_id | 仅training_manager |
| 搜索框 | 输入 | 按标题模糊搜索 | keyword | — |

**弹窗 question-form**：
- 表单字段：题目标题、题型(单选/多选/判断)、分类、选项(动态增减)、正确答案、解析
- 操作：保存（teacher=提交审核，training_manager=直接发布）、取消

##### @page(/assessment) 日常考核

**核心职责**：发布和管理日常考核任务
**访问路径**：侧边栏直达
**布局**：考核任务列表 + 发布考核弹窗
**列表项字段**：考核标题 / 类型 / 考核对象 / 状态 / 发布时间
**状态**：
- 空态：暂无考核任务
- 加载态：骨架屏

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 发布考核按钮 | 点击 | 打开@modal(assessment-form) | — | teacher/training_manager可见 |
| 期数快捷按钮 | 点击 | 自动勾选该期全部新人 | cohort | 新增：按期选择 |

**弹窗 assessment-form**：
- 新增"按期选择"区：获取所有期数，点击某期自动勾选该期新人
- 保留原有单个选择功能：可单独勾选/取消个别新人
- 表单字段：考核标题、类型、考核对象(期数批量选择+单人选择)、截止时间
- 操作：发布、取消

##### @page(/trainee-profiles) 新人档案

**核心职责**：新人档案管理与业务追踪
**访问路径**：侧边栏直达
**布局**：统计卡片 + 筛选区 + 档案列表 + 编辑弹窗
**列表项字段**：姓名 / 期数 / 阶段 / 入职日期 / 状态

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 编辑按钮 | 点击 | 打开@modal(profile-edit) | user_id | 新增：可编辑期数 |

**弹窗 profile-edit**：
- 新增期数字段（可编辑文本输入）
- 保存后刷新列表
