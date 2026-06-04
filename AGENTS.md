# 百芝堂V3双轨驱动赋能系统

## 项目概览

百芝堂（糖尿病慢病管理公司）培训管理系统，替代原有Flask+SQLite系统。核心实现"逐项对标"双轨诊断：每个指标独立判断合格/良好/优秀，不合格项自动触发赋能方案。四象限分类（按不合格项数量分类，非加权总分）。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL) via coze-coding-dev-sdk
- **Auth**: Base64 token (V1, 后续升级JWT)

### 核心业务逻辑

- **双轨驱动**: 过程线（闯关+质检4维度+日常考核）× 结果线（加V率/面诊率/接诊率/签收率/用药率/挂号率）
- **逐项对标**: 每指标独立对标合格/良好/优秀阈值，非加权总分
- **四象限**: A(全合格)/B(结果不合格)/C(过程不合格)/D(全不合格)
- **三阶段**: 阶段一→二(闯关7关全通过)→三(连续4周A类)，连续2周D类触发复训
- **5角色**: trainee/mentor/teacher/training_manager/boss
- **系统盯人**: 角色动作分离 + 联动触发（演练提交→自动质检→低分赋能→通知导师）
- **角色权限**: 闯关解锁仅对trainee生效，其他角色全量可见可操作
- **首页分化**: trainee=成长计划 / training_manager=全局驾驶舱 / mentor=带教看板 / teacher=教务工作台 / boss=经营概览
- **新人看板vs档案**: 看板=预警盯人大屏(实时异常/逾期/低分/待审核) / 档案=业务追踪表(入职/培训周期/下组/月度指标)
- **预警联动**: 闯关逾期→预警+通知导师 / 演练低分→自动赋能 / 诊断D类→复训触发 / 即将下组→确认提醒
- **质检自动触发**: 演练提交→自动创建质检任务(非手动新建)，source_type追踪触发来源
- **四阶段成长模型**: 学习期(1周7天排课) → 练习期(2-4周19动作演练) → 独立期(2-3月) → 熟练期(3月+)
- **19核心动作4节点**: 首通电话(6动作30%) + 第三天回访(4动作25%) + 第五天预约(6动作30%) + 面诊当天(3动作15%)
- **5级评分标准**: 5分(全面完成有亮点) / 4分(按要求完成) / 3分(勉强完成) / 2分(明显遗漏) / 0分(未执行)
- **信任度公式**: 患者信任度 = 认知水平 × 专业感知 × 安全感
- **4类特殊情况**: 未按时用药/延迟用药/用药中断/不规律用药(10个补充动作)

## 目录结构

```
├── public/                 # 静态资源
├── src/
│   ├── app/
│   │   ├── (dashboard)/    # 主布局页面（含侧边栏）
│   │   │   ├── page.tsx              # 首页工作台
│   │   │   ├── learning/             # 闯关学习
│   │   │   ├── growth/               # 成长档案
│   │   │   ├── diagnosis/            # 双轨诊断
│   │   │   ├── empowerment/          # 赋能中心
│   │   │   ├── dashboard/            # 数据看板
│   │   │   ├── overview/             # 全局概览（老板视图）
│   │   │   ├── question-bank/        # 题库管理
│   │   │   ├── resources/            # 资料中心
│   │   │   ├── qc-review/            # 质检审核
│   │   │   ├── assessment/           # 日常考核
│   │   │   ├── scrm-import/          # 业务数据录入
│   │   │   ├── trainee-board/        # 新人看板（预警盯人大屏）
│   │   │   ├── trainee-profiles/     # 新人档案管理（业务追踪表）
│   │   │   ├── practice/             # 演练任务
│   │   │   ├── knowledge-base/       # 知识库
│   │   │   ├── courses/              # 课程管理
│   │   │   └── settings/             # 系统设置
│   │   ├── login/          # 登录页
│   │   └── api/            # API路由
│   │       ├── auth/       # 登录/登出/当前用户
│   │       ├── learning/   # 学习关卡+答题提交
│   │       ├── growth/     # 成长档案
│   │       ├── growth-plan/ # 成长计划（每日任务+阶段进度）
│   │       ├── core-actions/ # 19核心动作+评分
│   │       ├── diagnosis/  # 双轨诊断
│   │       ├── empower/    # 赋能方案
│   │       ├── qc/         # 质检记录
│   │       ├── business/   # 业务数据
│   │       ├── questions/  # 题库CRUD
│   │       ├── thresholds/ # 阈值配置
│   │       ├── trainee-alerts/ # 新人预警（角色分化）
│   │       ├── trainee-profiles/ # 新人档案
│   │       ├── trainee-monthly/ # 月度数据
│   │       ├── users/       # 用户管理CRUD
│   │       ├── stage-rules/ # 阶段规则CRUD
│   │       ├── resources/   # 资料CRUD
│   │       ├── resources/categories/ # 资料分类CRUD
│   │       ├── knowledge/   # 知识库CRUD
│   │       └── migrate/    # 数据迁移
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── lib/
│   │   ├── auth/           # 认证（context/jwt/permissions）
│   │   └── utils.ts        # cn工具函数
│   └── storage/database/   # Supabase客户端+Schema
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 数据库表（24张）

核心表: users, roles, permissions, role_permissions, learning_levels, level_progress, quiz_attempts, questions, qc_records, business_data, thresholds, empower_plans, empower_executions, mentor_trainees, stage_rules, announcements, resources, daily_assessments, configurations, growth_stages, daily_plans, core_actions, action_scores, special_patient_actions

## 测试账号

| 用户名 | 密码 | 角色 | 姓名 |
|--------|------|------|------|
| zhangxh | bt2026 | trainee | 张小红 |
| lidw | bt2026 | trainee | 李大伟 |
| wangml | bt2026 | trainee | 王美玲 |
| chends | bt2026 | mentor | 陈导师 |
| zhengl | bt2026 | training_manager | 郑管理 |
| sunz | bt2026 | boss | 孙总 |

## 包管理规范

**仅允许使用 pnpm** 作为包管理器。

## 开发规范

- TypeScript strict模式，禁止隐式any
- Shadcn/ui组件+语义化Tailwind变量（bg-card, text-foreground, bg-muted等）
- 设计风格：数据风（#F8F6F0暖底 + #102A43深蓝 + #2978B5数据蓝 + #F59E0B橙色）
- Supabase客户端: `import { getSupabaseClient } from '@/storage/database/supabase-client'`
- Next.js配置路径使用动态拼接，禁止硬编码绝对路径

## 根因修复原则（强制）

### 核心规则
每次修复必须从根本原因入手，禁止打补丁。

### 判断标准
| 做法 | 判定 | 示例 |
|------|------|------|
| 把错误架构改成正确的 | ✅ 根因修复 | router.push('/') → window.location.href='/' |
| 在错误架构上加防御代码 | ❌ 补丁 | setTimeout兜底、try-catch吞异常 |
| 消除问题产生的条件 | ✅ 根因修复 | 修复软导航→硬导航，cookie传播时序问题不存在了 |
| 绕过问题让用户看不到 | ❌ 补丁 | fallback默认值、Cache-Control no-cache |

### 强制4步流程（每步必须完成才能进入下一步）

**第1步：复现+定位断裂点**
- 必须先复现问题，确认问题真实存在
- 追踪完整链路，找到具体的断裂点（哪一行代码、哪个时序、哪个逻辑分支）
- 输出：断裂点位置 + 证据（代码行号/日志/请求响应）

**第2步：分析根因**
- 回答：为什么这个断裂点会存在？是设计缺陷、架构问题、还是逻辑错误？
- 如果答案是"某个值可能为空""某个时序可能不对"，继续追问为什么——直到追溯到架构/设计层面的原因
- 禁止停留在"加了检查就不会出错"这个层面

**第3步：设计方案（禁止补丁模式）**
- 方案必须回答：改了什么，让问题**不可能再发生**（不是"加了防护所以不太会发生"）
- 如果方案中出现以下关键词，大概率是补丁，需要重新思考：
  try-catch、setTimeout、fallback、默认值兜底、防御性检查、容错处理
- 例外：用户数据的输入校验属于正常业务逻辑，不算补丁

**第4步：验证**
- 说明修复后问题为什么不可能再出现
- 列出可能受影响的关联模块

### 禁止的补丁模式
- try-catch 吞异常：错误被捕获但没修正原因
- setTimeout 等待：用时间换确定性，本质是猜
- fallback 默认值绕过失败：失败还在，只是不看
- 防御性 check 掩盖症状：检查存在但没解决为什么会出现异常值
- Cache-Control 等响应头绕过：没改流程，只是让浏览器不缓存

### 工单执行要求
- 每个修复项必须先完成4步流程再动手改代码
- 改完代码后在commit message中写明：根因是什么、为什么这样改能消除
- 如果发现工单描述的根因不对，停下来报告，不要在错误根因上执行
