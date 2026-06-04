# 登录页面浏览器端无反应修复

## 概述

修复登录页面在浏览器端无响应的问题。根因为浏览器缓存旧版 JS 代码。从四个层面加固：启动脚本清缓存、登录页错误处理与状态反馈、认证上下文跳转验证、Next.js 构建缓存策略。平台：Web。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 缓存清理 | dev.sh 启动时 `rm -rf .next` | 根因修复，杜绝旧编译产物 |
| 错误分类 | 网络错误 vs 服务端错误分开提示 | 用户体验，快速定位问题 |
| 跳转验证 | router.push 后 1s 检测 pathname | 兜底保护，发现跳转失败 |
| 构建ID | `generateBuildId` 用 timestamp | 确保每次部署产生新 buildId，浏览器不命中旧缓存 |

## 功能模块

### 1. 启动脚本清缓存 (scripts/dev.sh)
在 `kill_port_if_listening` 之前增加 `.next` 目录清理逻辑：
```bash
if [ -d ".next" ]; then
  echo "Removing .next cache directory..."
  rm -rf .next
fi
```

### 2. 登录页增强 (src/app/login/page.tsx)
handleSubmit 中区分错误类型：
- `fetch` 抛出 TypeError（网络断开/DNS失败）→ "网络连接失败，请检查网络后重试"
- 服务端返回非 200（login 函数 throw）→ 显示服务端返回的 error 信息
- 未知错误 → "登录失败，请稍后重试"

loading 状态增强：
- 按钮 `disabled` + 显示"登录中..."
- 输入框在 loading 时也 `disabled`

### 3. 认证上下文跳转验证 (src/lib/auth/context.tsx)
login 函数中 `router.push('/')` 后加延迟检测：
```typescript
router.push('/');
setTimeout(() => {
  if (window.location.pathname === '/login') {
    // 跳转失败，强制刷新
    window.location.href = '/';
  }
}, 1500);
```

### 4. Next.js 缓存策略 (next.config.ts)
添加 `generateBuildId`：
```typescript
generateBuildId: async () => {
  return Date.now().toString();
},
```
添加 headers 对 JS/CSS 资源设置 `Cache-Control: no-cache`（开发环境）。

## 是否有原型设计

否 — 这是已有页面的 bug 修复和体验加固，不涉及新页面或 UI 结构变更。且项目首次开发已完成，后续 bug 修复不需要原型设计。

## 实施步骤

1. 修改 scripts/dev.sh，启动前自动删除 .next 目录（scripts/dev.sh）
2. 增强 login/page.tsx 错误处理——网络错误/服务端错误/未知错误分类提示，loading 时禁用按钮和输入框（src/app/login/page.tsx）
3. 增强 auth/context.tsx login 函数——router.push('/') 后加延迟检测，跳转失败时强制 window.location.href 刷新（src/lib/auth/context.tsx）
4. 修改 next.config.ts——添加 generateBuildId + 开发环境 Cache-Control headers（next.config.ts）
5. 执行代码检查与验证，清除 .next 缓存重启服务，测试登录流程（test_run）
