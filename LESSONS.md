# LESSONS.md — 百芝堂V3 经验库

> 每次bug修复后，按模板追加记录。修复前先搜索本文件，命中已有经验则直接复用。

## 记录模板

```markdown
## #NNN 标题（简述症状）

- **症状**：
- **根因**：
- **修复**：
- **防错规则**：
- **类别**：导航/路由 | 异步/时序 | 类型安全 | 状态管理 | 样式/UI | 数据库 | 认证/权限 | 性能
- **日期**：YYYY-MM-DD

---
```

---

## #001 诊断页显示非学员角色（导师/管理/总经理出现在诊断列表）

- **症状**：双轨诊断页面四象限分类中出现了导师、培训师、管理、总经理等非学员角色，这些角色不应被当作赋能对象
- **根因**：`/api/diagnosis`的GET overview分支查询`users`表时没有`role_id`过滤，`/api/empower/alerts`同理
- **修复**：在两个API的查询中增加`.eq('role_id', 1)`，仅查询trainee角色用户
- **防错规则**：任何"面向新人/学员"的列表查询，必须加role_id=1过滤。新增API时在查询users表后立即加角色过滤，禁止遗漏
- **类别**：认证/权限
- **日期**：2026-06-06

---

## #003 模块化答题API路由缺失导致GET返回空响应

- **症状**：`GET /api/learning/modules/diabetes_basics` 返回空响应（非JSON），前端解析失败
- **根因**：只创建了 `modules/[moduleCode]/submit/route.ts`，遗漏了 `modules/[moduleCode]/route.ts`（GET详情路由）。Next.js App Router 中动态路由段必须有对应的 `route.ts` 才能处理请求
- **修复**：新建 `src/app/api/learning/modules/[moduleCode]/route.ts`，实现 GET 返回模块配置+题目列表+用户进度
- **防错规则**：创建动态路由API时，必须同时检查是否需要父级路由文件和子级路由文件；`[param]/submit/route.ts` 和 `[param]/route.ts` 是两个独立文件
- **类别**：路由/API
- **日期**：2026-06-12

---

## #012 pg库参数序列化导致pg_strtoint32_safe错误

- **症状**：使用`pg`库的`pgQuery`/`pgInsert`执行INSERT时，PostgreSQL报`pg_strtoint32_safe`错误，所有参数被序列化为字符串，无法隐式转换为整数列
- **根因**：`pg`库（`node-postgres`）默认将所有参数序列化为字符串类型，PostgreSQL的严格类型检查无法将字符串隐式转换为`integer`/`smallint`等数值类型。即使传入`Number(x)`，`pg`库内部仍按字符串发送
- **修复**：对需要INSERT数值列的场景，改用Supabase客户端（`getSupabaseClient().from('table').insert({...})`），Supabase客户端通过PostgREST发送JSON，类型由PostgREST自动处理。`pgQuery`仅用于SELECT查询（返回值类型映射无此问题）
- **防错规则**：
  1. 涉及INSERT/UPDATE数值列时，优先使用Supabase客户端而非`pg`库直连
  2. 如必须用`pg`库，需在SQL中显式CAST：`$1::integer`
  3. 新表优先通过Supabase客户端操作
- **类别**：数据库
- **日期**：2026-06-12

---

## #013 动态路由[planId]与查询参数路由冲突

- **症状**：`POST /api/learning-plans/generate` 被 `[planId]` 动态路由捕获，`planId="generate"` → `parseInt("generate")` = `NaN` → 传入pg查询触发`pg_strtoint32_safe`
- **根因**：Next.js App Router中，`/api/learning-plans/[planId]/route.ts` 和 `/api/learning-plans/route.ts` 共存时，`/api/learning-plans/generate` 被前者匹配（动态段优先级高于查询参数）
- **修复**：将generate/add/reschedule等操作统一放在`/api/learning-plans/route.ts`的POST中，通过`?action=xxx`查询参数区分，而非创建独立路径段
- **防错规则**：API设计中，操作型端点使用查询参数`?action=xxx`而非路径段，避免与动态路由`[id]`冲突
- **类别**：导航/路由
- **日期**：2026-06-12

---

## #003 API响应无类型导致null.map()页面崩溃白屏

- **症状**：learning页面、diagnosis页面等多处因API返回{error}或字段为undefined，前端直接对undefined调用.map()导致TypeError: Cannot read properties of undefined (reading 'map')，页面白屏崩溃
- **根因**：结构性缺陷——`fetch().json()`返回any类型，TypeScript编译器无法在编译时拦截null/undefined访问。所有页面用原生fetch获取数据后直接解构，没有运行时校验也没有类型定义。一旦API返回非预期结构（如{error}而非{modules:[]}），前端必然崩溃
- **修复**：
  1. 创建`src/lib/api-client.ts`——safeFetch泛型函数+sanitizeArrays自动用默认值替换缺失数组+apiGet/apiPost封装
  2. 创建`src/components/error-boundary.tsx`——React ErrorBoundary页面级崩溃兜底，不再白屏
  3. 将10个高风险页面的fetch调用迁移到apiGet（diagnosis/empowerment/trainee-board/notifications/trainee-profiles/qc-review/scrm-import/assessment/dashboard/overview）
  4. 修复learning/modules API无userId时返回模块概览而非{error}
- **防错规则**：
  1. 所有新增页面必须使用`apiGet<T>('/api/xxx', { defaultValue })`，禁止直接使用fetch
  2. apiGet的sanitizeArrays会自动将undefined数组字段替换为[]，从结构上消除null.map()的可能
  3. ErrorBoundary包裹在layout层，任何未捕获的渲染错误都有兜底UI
- **类别**：类型安全/状态管理
- **日期**：2026-06-08

---

## #004 规则型防错无效——"为什么制定那么多规则还是出问题"

- **症状**：AGENTS.md写了大量编码规则（"检查null"、"用|| []"），但页面依然因null.map()崩溃
- **根因**：规则型防错靠人记住，人一定会忘。真正有效的是结构性防错——让系统自动拦截，犯错不可能发生
- **修复**：
  1. api-client.ts的sanitizeArrays = 结构性防错（API响应自动补全缺失数组，开发者不需要记得检查）
  2. ErrorBoundary = 结构性防错（渲染崩溃自动兜底，开发者不需要记得try-catch）
  3. TypeScript泛型 = 结构性防错（编译时类型校验，apiGet<T>返回的data有类型，字段缺失编译报错）
- **防错规则**：任何防错措施优先选择结构性（系统自动拦截），而非规则性（靠人记住）。判断标准：忘了会怎样？规则型照犯，结构型犯不了
- **类别**：类型安全
- **日期**：2026-06-08

---

## #002 前后端字段名snake_case/camelCase不一致导致创建/编辑用户失败

- **症状**：前端添加用户弹窗点击"创建"返回"缺少必要参数"；编辑期数/阶段不生效；trainee_profile创建失败
- **根因**：
  1. 前端发`realName`(camelCase)，后端register期望`real_name`(snake_case) → 参数丢失触发必填校验
  2. 后端POST/PUT `/api/users`用`current_stage`，实际列名是`stage` → INSERT/UPDATE失败
  3. 后端POST `/api/users`用`tasks`/`completed`列，`daily_plans`表实际无这些列 → INSERT失败
- **修复**：
  1. 前端改用POST `/api/users`（字段与后端一致），传`realName`（后端POST已支持）
  2. `current_stage`→`stage`列名修正
  3. 删除不存在的daily_plans插入逻辑，stage数字→字符串映射(1→foundation, 2→practice, 3→independent, 4→proficient)
- **防错规则**：数据库操作前必须核对实际表结构（`SELECT column_name FROM information_schema.columns`），禁止凭记忆写列名
- **类别**：数据库/类型安全
- **日期**：2026-06-06

---
