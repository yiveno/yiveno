# 环境变量配置指南

## 📁 文件结构

```
otterSage/
├── .env                    # ✅ 公共配置（可提交到 Git）
├── .env.local              # ✅ 本地开发配置（不提交，需手动创建）
├── .gitignore              # 已配置忽略 .env.local
└── frontend/
    ├── .env.README.md      # 说明文档
    └── vite.config.ts      # 配置从根目录加载环境变量
```

## 🎯 配置原则

### 1. 统一管理

- **所有环境变量集中在根目录**
- 避免在子项目中重复定义
- 便于维护和查找

### 2. 分层配置

- **`.env`**：公共配置，提交到 Git
- **`.env.local`**：本地覆盖，不提交到 Git

### 3. 优先级

```
.env.local（最高优先级）
    ↓
.env（默认配置）
    ↓
代码中的降级逻辑（兜底）
```

## 📝 环境变量列表

### Supabase 配置

```bash
# 根目录 .env
SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
SUPABASE_ANON_KEY=sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo
VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo
```

**说明**：

- `SUPABASE_*`：后端使用
- `VITE_SUPABASE_*`：前端使用（Vite 只注入 `VITE_` 前缀的变量）

### Cloudflare Worker 配置

```bash
# 根目录 .env（生产环境）
VITE_CLOUDFLARE_MODE=true
VITE_API_BASE_URL=https://api.ottersage.com
VITE_CLOUDFLARE_WORKER_URL=https://ottersage.cqw547847.workers.dev
```

**本地开发覆盖**（可选）：

```bash
# 根目录 .env.local
VITE_API_BASE_URL=https://localhost:8787
VITE_CLOUDFLARE_WORKER_URL=https://localhost:8787
```

**说明**：

- 如果不设置 `.env.local`，开发环境会自动使用 `https://localhost:8787`
- 生产构建会使用 `.env` 中的配置

### Gumroad 配置

```bash
# 根目录 .env
VITE_GUMROAD_PRODUCT_URL=https://cqw5478.gumroad.com/l/ottersage-pro
VITE_GUMROAD_PLAN_ID_MONTHLY=...
VITE_GUMROAD_PLAN_ID_YEARLY=
VITE_GUMROAD_MANAGE_URL=https://app.gumroad.com/subscriptions
```

### 官网 URL

```bash
# 根目录 .env.local（开发环境）
VITE_WEBSITE_URL=http://localhost:3001
```

## 🔧 使用场景

### 场景 1：本地开发（默认）

**不需要创建 `.env.local`**，代码会自动使用默认值：

- API: `https://localhost:8787`（本地 Cloudflare Worker）
- Supabase: 使用 `.env` 中的配置

### 场景 2：本地开发 + 远程 API

创建 `.env.local`：

```bash
# 根目录 .env.local
VITE_API_BASE_URL=https://ottersage.cqw547847.workers.dev
VITE_CLOUDFLARE_WORKER_URL=https://ottersage.cqw547847.workers.dev
```

### 场景 3：生产构建

直接运行构建命令，会使用 `.env` 中的生产配置：

```bash
bun run build
```

## 🚀 快速开始

### 1. 克隆项目后

```bash
# 1. 复制示例文件（如果有）
cp .env.local.example .env.local

# 2. 根据需要编辑 .env.local
vim .env.local

# 3. 启动开发服务器
bun run dev
```

### 2. 检查环境变量

打开浏览器控制台，查看输出：

```
🔧 API_CONFIG.API_BASE: https://localhost:8787
🔧 VITE_API_BASE_URL: undefined
🔧 VITE_CLOUDFLARE_WORKER_URL: undefined
```

**这是正常的！** `undefined` 表示使用默认值。

### 3. 验证配置

```bash
# 查看构建时注入的环境变量
bun run build

# 检查 dist 目录中的文件
grep -r "api.ottersage.com" frontend/dist/
```

## ⚠️ 常见问题

### Q1: 为什么环境变量显示 `undefined`？

**A**: 这是正常的！代码中有降级逻辑：

```typescript
// src/config/constants.ts
const apiBase =
  import.meta.env.VITE_API_BASE_URL || // 优先使用环境变量
  (import.meta.env.DEV
    ? 'https://localhost:8787' // 开发环境默认
    : 'https://api.ottersage.com') // 生产环境默认
```

### Q2: 如何确认环境变量生效？

**A**: 查看控制台输出：

```javascript
console.log('🔧 API_CONFIG.API_BASE:', API_CONFIG.API_BASE)
```

### Q3: 为什么删除了 `frontend/.env`？

**A**: 避免重复定义和配置不一致。所有配置统一在根目录管理。

### Q4: `.env.local` 需要提交到 Git 吗？

**A**: **不需要！** `.gitignore` 已配置忽略此文件。每个开发者根据自己的环境创建。

## 📚 相关文档

- [Vite 环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- `frontend/vite.config.ts`：Vite 配置
- `frontend/src/config/constants.ts`：环境变量使用

## 🔍 调试技巧

### 查看所有环境变量

在 `vite.config.ts` 中添加：

```typescript
console.log('🔧 All env vars:', env)
```

### 查看运行时环境变量

在代码中添加：

```typescript
console.log('🔧 import.meta.env:', import.meta.env)
```

### 验证构建产物

```bash
# 构建后检查
bun run build
grep -r "VITE_API_BASE_URL" frontend/dist/
```
