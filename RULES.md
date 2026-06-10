# RULES.md — 百芝堂V3 项目规则卡片

> 每次会话开始时首读本文件，按触发场景激活对应规则。

---

## 一、根因修复（强制5步）

每次bug修复**必须**走完5步，禁止跳步、禁止补丁。

1. **复现+定位断裂点**：确认问题存在，找到具体断裂行
2. **分析根因**：追问到架构/设计层面，不停留在"加了检查就不会出错"
3. **设计方案**：让问题不可能再发生，不是"加了防护不太会发"
4. **验证**：说明为什么不可能再出现 + 受影响的关联模块
5. **记录经验**：追加到 LESSONS.md，同类 ≥3 条提炼规则回写本文件

### 禁止的补丁模式
- try-catch 吞异常
- setTimeout 等待
- fallback 默认值绕过失败
- 防御性 check 掩盖症状
- Cache-Control 响应头绕过

### 紧急hotfix例外通道

线上核心链路阻断时允许先补丁止血：

| 规则 | 说明 |
|------|------|
| 标注 | `// HOTFIX: 临时止血，根因待修` |
| 时限 | 24小时内完成根因修复替换补丁 |
| 追踪 | 创建"根因修复"任务，状态"紧急待修" |
| 禁止堆叠 | 不允许第二个HOTFIX出现时第一个还没根修 |

**仅限核心链路阻断走hotfix**，样式偏移/间歇报错/数据一致性一律走5步流程。

---

## 二、交付前强制清单

每次调用 `done` 之前逐项过，全部通过才能交付：

```
□ 代码变更是否已 git commit + push？
□ 是否有bug修复？如有，是否走了5步根因流程？
□ 是否有 HOTFIX 代码？如有，是否创建了根因追踪任务？
□ AGENTS.md 是否需要更新（新功能/架构变化）？
□ DESIGN.md 是否需要更新（UI/样式/交互变化）？
□ 是否通过 test_run 验证？
□ 是否有遗留的 TODO/FIXME/HOTFIX？
```

---

## 三、事件-规则映射

| 触发事件 | 必查规则 |
|----------|----------|
| 修复bug | 5步根因流程 / hotfix判断 / LESSONS.md记录 |
| 代码变更完成 | git commit + push / test_run验证 |
| UI/样式/交互改动 | DESIGN.md更新 |
| 新功能/架构变化 | AGENTS.md更新 |
| 安装依赖 | pnpm only（严禁npm/yarn） |
| 验证/测试 | test_run工具（严禁shell替代） |
| 会话开始 | 首读 RULES.md + LESSONS.md |

---

## 四、提炼规则（从经验累积生成）

> 当 LESSONS.md 中同类别经验累计 ≥3 条时，提炼预防规则写入此处。

### R1: API调用必须使用apiClient，禁止原生fetch

**来源**：#002 + #003 + #004 → 类型安全类经验 ≥3 条

| 规则 | 说明 |
|------|------|
| 禁止原生fetch | 新增页面的数据获取必须用`apiGet<T>('/api/xxx', { defaultValue })`，不用`fetch().json()` |
| 默认值必填 | apiGet的defaultValue必须包含所有数组字段，sanitizeArrays依赖此值兜底 |
| 类型必填 | apiGet的泛型T必须定义完整响应结构，禁止用any或省略泛型 |
| API不返回{error} | 后端API在无数据时应返回空数组/空对象的结构化响应，而非`{error: 'xxx'}` |

**为什么是结构防错而非规则**：原生fetch返回any，TypeScript无法拦截null.map()崩溃。apiGet的sanitizeArrays自动补全缺失数组，开发者不需要记得检查null——结构让人不可能犯这个错。

### R2: 页面必须被ErrorBoundary包裹

**来源**：#003 + #004

- 所有dashboard子页面已通过layout.tsx的ErrorBoundary自动包裹
- 新增独立页面（如login）如果不在dashboard布局下，需手动包裹
- ErrorBoundary确保渲染错误有友好兜底UI，不会白屏
