# 工单K1：登录系统修复（注册-登录一致性 + 安全加固）

## 概述

修复登录系统两大致命问题：① 注册API存了自定义密码hash（`bt:${password}`），但登录API只接受硬编码`bt2026`，新创建账号永远无法登录；② Token用base64编码JSON，无签名校验，任何人可伪造。涉及安装bcryptjs+jose依赖、改造login/register/me路由、新建change-password API、前端配合（强制改密弹窗+设置页改密入口+密码字段类型修复）。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 密码哈希 | bcryptjs | 工单指定；纯JS实现无需native编译 |
| JWT库 | jose | Edge Runtime兼容，工单指定 |
| 旧密码兼容 | `bt:`前缀检测→原密码比对→forceChangePassword标记 | 现有6个测试账号不能断 |
| JWT密钥 | 环境变量JWT_SECRET | 不硬编码密钥 |

## 功能模块

### 1. 登录API改造（login/route.ts）

- 删除 `password !== 'bt2026'` 硬编码
- 从数据库读取 `password_hash`
- 兼容逻辑：
  - `password_hash.startsWith('bt:')` → 提取后缀比对 → 登录成功返回 `forceChangePassword: true`
  - 否则 → `bcrypt.compare()` 比对
- 生成JWT（含userId/username/role/permissions/exp），替换base64
- JWT_SECRET从 `process.env.JWT_SECRET` 读取，缺省用开发态fallback

### 2. 注册API改造（register/route.ts）

- `simpleHash` 替换为 `bcrypt.hash(password, 10)`
- 新用户password_hash不再是`bt:`前缀

### 3. POST /api/users 密码字段改造

- 当前 `password_hash: password ? 'bt:${password}' : 'bt:bt2026'`
- 改为 `bcrypt.hash(password || 'bt2026', 10)` — 新建账号密码也走bcrypt
- 默认密码保留bt2026但hash格式改为bcrypt

### 4. PUT /api/users 密码字段改造

- 当前 `password_hash: 'bt:${password}'`
- 改为 `bcrypt.hash(password, 10)`

### 5. Token安全加固（login + me + middleware）

- login: base64 → JWT签名
- me: `JSON.parse(Buffer.from(token,'base64'))` → `jose.jwtVerify(token, secret)`
- middleware: 同步改为JWT校验
- JWT payload: `{ userId, username, realName, role, stage, permissions, exp }`
- Cookie名保持 `auth_token` 不变

### 6. 改密码API（新建 change-password/route.ts）

- POST body: `{ userId, oldPassword, newPassword }`
- 校验旧密码（兼容bt:和bcrypt两种格式）
- 新密码用bcrypt.hash存储
- 返回新JWT（密码已更新标记清除）

### 7. 前端配合

- **登录页**：删除"测试账号密码bt2026"提示；登录响应含`forceChangePassword`时弹出改密弹窗
- **设置页**：新增"修改密码"按钮+弹窗（旧密码/新密码/确认密码）
- **用户管理创建新人**：密码input改为type="password"；默认密码不再明文展示

## 是否有原型设计

是（设计引导已开启，需先完成改密弹窗、登录页调整的原型设计，再进入开发）

## 实施步骤

1. **阶段一：原型设计** — 加载design-canvas技能，设计登录页改密弹窗+设置页改密弹窗的原型HTML（仅涉及弹窗交互，不改变整体页面结构）
2. **阶段二-步骤1**：安装依赖 `bcryptjs @types/bcryptjs jose`，创建JWT工具函数 `src/lib/auth/jwt.ts`（签名+验签+密钥管理）
3. **阶段二-步骤2**：改造登录API `src/app/api/auth/login/route.ts`：密码比对逻辑（bt:兼容+bcrypt）+ JWT签发 + forceChangePassword标记
4. **阶段二-步骤3**：改造me API `src/app/api/auth/me/route.ts` + middleware `src/middleware.ts`：base64解码改为JWT验签
5. **阶段二-步骤4**：改造注册API `src/app/api/auth/register/route.ts` + POST/PUT `/api/users`：simpleHash→bcrypt.hash
6. **阶段二-步骤5**：新建改密码API `src/app/api/auth/change-password/route.ts` + 登录页改密弹窗 + 设置页改密入口 + 用户管理密码字段类型修复
7. 端到端验证 + 静态检查

## 页面规格

##### @page(/login) 登录页

**核心职责**：用户身份认证入口
**访问路径**：未登录时自动重定向
**布局**：Logo区 + 登录表单 + 强制改密弹窗

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 登录按钮 | 点击 | 提交登录 → 成功后检查forceChangePassword | — | forceChangePassword=true时弹窗 |
| 改密弹窗 | 提交 | 调用/api/auth/change-password → 成功后关闭弹窗继续跳转 | oldPassword, newPassword | — |
| 测试账号提示 | — | 删除"密码bt2026"文案 | — | — |

##### @page(/settings) 设置页

**核心职责**：系统配置+用户管理
**访问路径**：侧边栏导航
**布局**：现有布局不变，用户管理Tab新增改密按钮

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 修改密码按钮 | 点击 | 弹出改密弹窗 | — | 任何已登录用户可用 |
| 改密弹窗 | 提交 | 调用/api/auth/change-password → 成功Toast | oldPassword, newPassword | — |
| 创建新人密码输入框 | — | type从text改为password | — | — |
