# 工单J/K/L — P1/P2实施计划

## 工单总览

| 工单 | 名称 | P0 ✅ | P1 🔲 | P2 🔲 |
|------|------|-------|-------|-------|
| J | 阶段通关验证改造+双线状态机 | 字段+状态机+模块化API+前端 | 实操带教联动 | 滚动窗口+归因逻辑 |
| K | 赋能中心处方化改造 | 4段式处方+渲染修复+可读标签+基础匹配 | 联动模块推送 | 自动推荐+推送闭环 |
| L | 用户管理期数字段 | cohort字段+编辑+API | 排课快捷操作 | 课程管理深度联动 |

---

## 工单J — 阶段通关验证改造+双线状态机

### P0 ✅ 已完成

- 数据库：新建assessment_modules(8模块)+module_progress表，questions加module/stage字段，trainee_profiles加双线状态(stage/process_status/result_status)
- 后端API：/api/learning/modules模块化列表+提交，/api/questions支持module/stage筛选
- 触发器：onModulePassed/onModuleFailed，双线状态基础转换
- 前端：21关地图→模块卡片网格+双线状态卡+答题弹窗
- 题库管理：新增module/stage筛选和编辑字段

### P1 🔲 实操带教联动

| 项目 | 内容 | 涉及文件 |
|------|------|---------|
| 实操模块解锁 | 基础通关4模块全部通过后，实操4模块自动解锁 | learning/modules/route.ts, page.tsx |
| 实操题型补充 | 为4个实操模块补充场景题（首通/回访/预约/面诊的情境判断题） | questions表seed |
| 带教进度安排 | mentor可在MentorProgress中为学员安排阶段二/三的实操进度 | courses/components/MentorProgress.tsx |
| 过程线状态激活 | 实操阶段开始时process_status从not_started→monitoring，开始接收质检数据 | triggers.ts |
| 质检数据写入过程线 | 演练提交→自动质检→质检分数写入过程线（4维度：沟通/专业/服务/合规） | api/qc/route.ts, triggers.ts |
| process_status判定 | monitoring→flagged（任一质检维度连续2周低于合格线）→触发赋能 | triggers.ts |
| flagged→monitoring | 赋能方案执行完毕+复检合格后，flagged回到monitoring | api/empower/route.ts |

### P2 🔲 滚动窗口+归因逻辑

| 项目 | 内容 | 涉及文件 |
|------|------|---------|
| 14天滚动窗口 | 结果线指标（加V率/面诊率/接诊率/签收率/用药率/挂号率）取最近14天数据计算 | api/diagnosis/route.ts, 新建lib/rolling-window.ts |
| 5个样本量门槛 | 可服务患者累计<5个时result_status=insufficient_data，不判定不预警不触发赋能 | lib/rolling-window.ts |
| 样本不足处理 | insufficient_data期间：不判定、不预警、不触发赋能（避免2个患者就50%的误判） | lib/rolling-window.ts |
| result_status判定 | insufficient_data→monitoring(≥5样本)→yellow_alert(1-2项不达标)→red_alert(≥3项不达标)→passed(全达标) | triggers.ts |
| yellow_alert→monitoring | 不达标项改善+连续7天达标后回到monitoring | triggers.ts |
| red_alert触发复训 | 连续2周red_alert→自动触发复训方案（关联工单K的全面复训方案） | triggers.ts |
| 归因逻辑 | 不合格指标→自动归因到过程线哪个环节出问题（质检哪一维度低→对应赋能方案） | 新建lib/attribution.ts |
| 双线汇聚判定 | qualified = process_status=passed AND result_status=passed | triggers.ts |

---

## 工单K — 赋能中心处方化改造

### P0 ✅ 已完成

- 数据库：8条empower_plans的content更新为4段式处方结构（病情分析→调理方向→具体药方→达标标准）
- 前端：content渲染从[object Object]→4段式处方卡片（诊/向/方/标四色块）
- indicator_key：新增INDICATOR_LABELS映射，显示可读标签
- 诊断API：增强匹配逻辑（indicator_key优先→target_indicators→通用兜底）

### P1 🔲 联动模块推送

| 项目 | 内容 | 涉及文件 |
|------|------|---------|
| 诊断页联动 | 双轨诊断页，不合格指标旁直接显示"推荐赋能"按钮，点击弹出处方预览 | diagnosis/page.tsx |
| 新人视图联动 | trainee的成长计划页，双线状态异常时显示对应赋能方案卡片 | learning/page.tsx, api/growth-plan/route.ts |
| 带教视图联动 | mentor的带教看板，所带学员触发赋能时自动显示，可一键推送 | courses/components/MentorProgress.tsx |
| 新人看板联动 | trainee-board预警大屏，D类/flagged/red_alert新人显示对应赋能方案 | trainee-board/page.tsx |
| 总经看板联动 | overview页，赋能执行率统计（已推送/已执行/已达标） | overview/page.tsx |
| 推送完整处方 | 推送弹窗展示4段式处方完整预览（不是只显示方案名） | empowerment/page.tsx |

### P2 🔲 自动推荐+推送闭环

| 项目 | 内容 | 涉及文件 |
|------|------|---------|
| 自动推荐 | 诊断判定不合格时，系统自动匹配indicator_key→赋能方案，无需手动选择 | api/empower/auto-trigger/route.ts(新建) |
| 自动推送 | 匹配到方案后自动推送给新人+通知带教老师（不再需要手动点"推送方案"） | triggers.ts, api/empower/route.ts |
| 执行跟踪 | empower_executions表记录执行状态：待执行→执行中→已完成→已验证 | api/empower/route.ts, DB |
| 达标验证 | 赋能方案执行后，对应指标是否改善（对比执行前后14天数据） | api/empower/route.ts, lib/rolling-window.ts |
| 闭环确认 | 带教确认学员改善→关闭赋能方案；未改善→升级方案或触发复训 | api/empower/route.ts |
| 连锁触发 | red_alert→复训方案→D类持续2周→通知培训负责人 | triggers.ts |

---

## 工单L — 用户管理期数字段

### P0 ✅ 已完成

- 用户管理表格已有期数列（有值蓝色/空值灰色）
- UserDialog新增cohort输入字段（仅trainee角色显示）
- API支持cohort读写（GET返回+PUT更新trainee_profiles.cohort）

### P1 🔲 排课快捷操作

| 项目 | 内容 | 涉及文件 |
|------|------|---------|
| 按期选人 | 课程排课时，支持"选择第X期"一键批量添加该期所有新人 | courses/components/TeacherDelivery.tsx, api/training-batches/route.ts |
| 期数筛选 | 各页面（日常考核/质检/看板）新增按期数筛选的快捷按钮 | assessment/page.tsx, qc-review/page.tsx, trainee-board/page.tsx |
| 批量操作 | 用户管理支持按期数批量编辑（如批量修改mentor分配） | settings/page.tsx, api/users/route.ts |

### P2 🔲 课程管理深度联动

| 项目 | 内容 | 涉及文件 |
|------|------|---------|
| 自动分组 | 新建培训批次时，默认按cohort分组，自动关联该期学员 | api/training-batches/route.ts |
| 进度按期汇总 | 课程管理2.0的进度统计按期数聚合展示 | courses/components/ManagerDashboard.tsx |
| 期数生命周期 | 期数状态管理（招募中→培训中→已下组），影响排课和统计逻辑 | DB新增cohort_status字段, settings/page.tsx |
| 跨期对比 | 不同期数的培训效果对比（通关率/质检分/业务指标） | 新建api/cohort-stats/route.ts, courses/components/ManagerDashboard.tsx |

---

## 执行优先级

按"小步快跑"原则，建议执行顺序：

1. **J-P1**：实操带教联动（解锁+题型+过程线激活）
2. **K-P1**：联动模块推送（诊断页/新人视图/带教视图/看板联动）
3. **L-P1**：排课快捷操作（按期选人+期数筛选）
4. **J-P2**：滚动窗口+归因逻辑
5. **K-P2**：自动推荐+推送闭环
6. **L-P2**：课程管理深度联动
