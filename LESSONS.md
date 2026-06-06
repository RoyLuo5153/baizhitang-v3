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
