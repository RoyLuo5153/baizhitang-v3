# 工单D分析：带教老师数据隔离 + 任务同步通知

## 文件清单

| 文件 | 涉及子项 | 当前状态 |
|------|---------|---------|
| `src/app/api/trainee-profiles/route.ts` | D1/D2/D3/D5 | GET接收前端传userId/roleId参数做过滤，无JWT身份校验 |
| `src/app/(dashboard)/trainee-profiles/page.tsx` | D3/D5 | 未用useAuth，手动传参；统计卡片未区分角色 |
| `src/app/(dashboard)/empowerment/page.tsx` | D3/D4 | fetchTrainees走/api/trainee-profiles，学员下拉已动态渲染(trainees.map)，但后端无角色过滤 |
| `src/app/api/practice/tasks/route.ts` | D6 | POST创建任务后无通知逻辑 |
| `src/app/api/auth/login/route.ts` | D2(间接) | token存role字符串，无role_id |
| `src/lib/auth/context.tsx` | D2(间接) | user对象有role，无role_id |
| DB: mentor_trainees | D1/D2 | 5条数据，id=1/2→mentor=6, id=3→mentor=7, id=4/5→mentor=8 |
| DB: users | D1 | 3个trainee: id=1(张小红,mentor_id=6), id=2(李大伟,mentor_id=6), id=3(王美玲,mentor_id=7) |
| DB: notifications | D6 | 有id/user_id/type/title/content/is_read/created_at |

## 数据一致性校验结果（D1前置）

| trainee_id | users.mentor_id | mentor_trainees.mentor_id | 一致? |
|------------|-----------------|--------------------------|-------|
| 1(张小红) | 6 | 6 | ✅ |
| 2(李大伟) | 6 | 6 | ✅ |
| 3(王美玲) | 7 | 7 | ✅ |

users表有3个trainee，mentor_trainees有5条（多了id=4/5对应trainee_id=4/5但users中无对应trainee）。

**结论：核心数据一致，无需对齐。mentor_trainees多出2条孤儿数据（trainee_id=4/5在users中不存在），可清理或忽略。**

## 文件交叉表

| | route.ts(后端) | trainee-profiles(前端) | empowerment(前端) | practice/tasks(后端) |
|---|---|---|---|---|
| D1 统一数据源 | ✏️改查询逻辑 | - | - | - |
| D2 后端角色过滤 | ✏️从cookie取身份 | - | - | - |
| D3 前端适配 | - | ✏️用useAuth | ✏️走同一接口 | - |
| D4 辅导记录下拉 | - | - | ✅已动态渲染(无需改) | - |
| D5 统计卡片联动 | - | ✏️统计按过滤后数据 | - | - |
| D6 通知培训负责人 | - | - | - | ✏️POST后批量insert |

## 数据依赖链

```
token(含role) → D2后端从cookie解析身份 → D3前端去掉手动传参
                                    ↓
              D1查询走mentor_trainees → D5统计卡片读过滤后数据
                                    ↓
              D3 empowerment走同一接口(自动按角色过滤)
                                    ↓
              D6 practice/tasks创建后通知(独立，无上游依赖)
```

## 逻辑依赖链

```
D1(数据源统一) ──→ D2(后端角色过滤) ──→ D3(前端适配) ──→ D5(统计联动)
                                                  ↓
                                            D4(已实现,跳过)

D6(通知) — 独立，无前置依赖
```

## 执行批次建议

**批次1**：D1 + D2（后端改造，必须先做）
- D1: trainee-profiles/route.ts 查询从 users.mentor_id 改为 JOIN mentor_trainees
- D2: 从 cookie 解析 token 获取 role + userId，按角色过滤返回数据
- 这两步强耦合，合并为一个提交

**批次2**：D3 + D5（前端适配，依赖批次1）
- trainee-profiles/page.tsx: 引入useAuth，去掉手动传参，统计卡片按过滤后数据计算
- empowerment/page.tsx: fetchTrainees走同一接口，自动按角色过滤
- D4确认已实现，跳过

**批次3**：D6（独立功能）
- practice/tasks/route.ts POST后批量insert通知
- 可与批次2并行
