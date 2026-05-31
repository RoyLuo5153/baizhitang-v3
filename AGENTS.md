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
│   │   │   ├── trainee-board/        # 新人看板
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
