# 成长计划天数切换 + 任务动态管理 + 资料库/知识库权限

## 概述
修复成长计划页面点击D2-D7不显示对应任务内容的问题，增加任务解锁机制；实现成长阶段任务的动态管理（培训负责人编辑/带教老师建议/审核机制）；资料中心和知识库按角色控制权限。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 天数切换 | API新增dayIndex参数，前端切换时重新请求 | 当前API只返回todayPlans，切换无数据源 |
| 任务解锁 | 前端锁定状态+禁用完成按钮，后端验证前置完成 | 可查看但不可操作，解锁才能完成 |
| 任务动态管理 | daily_plans表增is_suggested字段+审核流程 | 区分正式任务和建议任务，培训负责人审核 |
| 权限控制 | 前端按role隐藏按钮+后端按role拒绝写入 | 双重保障 |

## 功能模块

### 1. 成长计划天数切换与解锁
- API: GET /api/growth-plan 新增 dayIndex 参数，返回指定天任务+解锁状态
- 解锁规则: Day N可查看，但Day N-1全部完成后才能标记完成
- 前端: 切换天数时重新fetch，未解锁任务显示锁定图标+禁用完成按钮

### 2. 任务动态管理（角色分化）
- **培训负责人**：可编辑/新增/删除/调整任意天数的任务（直接生效）
- **带教老师/培训老师**：可提交任务建议（进入待审核状态）
- **培训负责人审核**：审核通过→建议变为正式任务；驳回→删除
- **新人**：只读+完成操作

数据结构：
```
daily_plans新增字段:
- is_suggested: boolean (是否为建议任务，默认false)
- suggested_by: varchar (建议人user_id)
- suggested_at: timestamp (建议时间)
- review_status: varchar ('pending'/'approved'/'rejected'/null)
- review_by: varchar (审核人user_id)
- review_at: timestamp (审核时间)
```

### 3. 资料中心权限
- 新人: 隐藏上传/删除/分类管理按钮，只保留查看/预览/下载
- 其他角色: 保持全部权限

### 4. 知识库权限
- 新人: 隐藏新建/编辑/删除按钮，只保留查看/搜索
- 其他角色: 保持全部权限

## 是否有原型设计
否 — 已有页面的bug修复、权限控制和功能增强，不涉及新页面设计。

## 实施步骤

1. 数据库daily_plans表新增is_suggested/suggested_by/review_status等字段（exec_sql）
2. 修改growth-plan API支持dayIndex参数+返回解锁状态+任务CRUD接口+建议审核接口（src/app/api/growth-plan/route.ts）
3. 修改首页成长计划：天数切换重新取数+未解锁禁用+培训负责人编辑模式+带教/培训老师建议模式（src/app/(dashboard)/page.tsx）
4. 修改资料中心和知识库：新人只读权限控制（src/app/(dashboard)/resources/page.tsx, knowledge-base/page.tsx）
5. 执行代码检查与验证（test_run）
