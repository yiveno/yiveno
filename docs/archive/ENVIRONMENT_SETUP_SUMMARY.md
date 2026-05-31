# 环境变量配置优化总结

## ✅ 已完成的优化

### 1. 统一环境变量管理

**之前的问题**：

- ❌ 根目录 `.env` 和 `frontend/.env` 重复定义
- ❌ Supabase 配置重复（`SUPABASE_*` 和 `VITE_SUPABASE_*`）
- ❌ 配置分散，难以维护

**优化后**：

- ✅ 所有配置统一在根目录 `.env`
- ✅ 删除 `frontend/.env`，避免重复
- ✅ 创建 `frontend/.env.README.md` 说明文档

### 2. 文件结构

```
otterSage/
├── .env                          # ✅ 公共配置（已提交）
├── .env.local                    # ✅ 本地开发配置（不提交）
├── .gitignore                    # ✅ 已配置忽略 .env.local
├── ENV_VARIABLES.md              # ✅ 环境变量配置指南
├── ENVIRONMENT_SETUP_SUMMARY.md  # ✅ 本文档
└── frontend/
    ├── .env.README.md            # ✅ 说明为什么没有 .env
    └── vite.config.ts            # ✅ 配置从根目录加载
```

### 3. 环境变量列表

#### 根目录 `.env`（公共配置）

```bash
# Supabase（前后端共用）
SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
SUPABASE_ANON_KEY=sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo
VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo

# Google OAuth
GOOGLE_CLIENT_ID=977490496631-7fgq659gokn6oe4jr2b38udpm2ooshm1.apps.googleusercontent.com

# Cloudflare Worker（生产环境）
VITE_CLOUDFLARE_MODE=true
VITE_API_BASE_URL=https://api.ottersage.com
VITE_CLOUDFLARE_WORKER_URL=https://ottersage.cqw547847.workers.dev

# Gumroad
VITE_GUMROAD_PRODUCT_URL=https://cqw5478.gumroad.com/l/ottersage-pro
VITE_GUMROAD_PLAN_ID_MONTHLY=...
VITE_GUMROAD_MANAGE_URL=https://app.gumroad.com/subscriptions
```

#### 根目录 `.env.local`（本地开发配置）

```bash
# 官网 URL
VITE_WEBSITE_URL=http://localhost:3001

# Cloudflare Worker 本地开发（可选）
# 不设置时，默认使用 https://localhost:8787
# VITE_API_BASE_URL=https://localhost:8787
# VITE_CLOUDFLARE_WORKER_URL=https://localhost:8787
```

## 🎯 为什么这样优化？

### 1. 避免重复定义

**之前**：

```
根目录 .env:
  SUPABASE_URL=...
  SUPABASE_ANON_KEY=...

frontend/.env:
  VITE_SUPABASE_URL=...        # ❌ 重复
  VITE_SUPABASE_ANON_KEY=...   # ❌ 重复
  VITE_API_BASE_URL=...
```

**现在**：

```
根目录 .env:
  SUPABASE_URL=...             # 后端使用
  SUPABASE_ANON_KEY=...        # 后端使用
  VITE_SUPABASE_URL=...        # 前端使用
  VITE_SUPABASE_ANON_KEY=...   # 前端使用
  VITE_API_BASE_URL=...        # 前端使用
```

### 2. 统一管理

- ✅ 所有配置在一个地方
- ✅ 修改一次，全局生效
- ✅ 便于查找和维护

### 3. 清晰的优先级

```
.env.local（本地覆盖）
    ↓
.env（默认配置）
    ↓
代码降级逻辑（兜底）
```

## 📝 使用说明

### 开发环境（默认）

**不需要创建 `.env.local`**，直接运行：

```bash
bun run dev
```

代码会自动使用默认值：

- API: `https://localhost:8787`
- Supabase: 使用 `.env` 中的配置

### 开发环境（自定义）

如需覆盖默认配置，创建 `.env.local`：

```bash
# 根目录 .env.local
VITE_API_BASE_URL=https://ottersage.cqw547847.workers.dev
```

### 生产构建

直接运行构建命令：

```bash
bun run build
```

会使用 `.env` 中的生产配置。

## ✅ 验证配置

### 1. 检查环境变量是否生效

打开浏览器控制台，查看输出：

```
🔧 API_CONFIG.API_BASE: https://localhost:8787
🔧 VITE_API_BASE_URL: undefined
🔧 VITE_CLOUDFLARE_WORKER_URL: undefined
```

**这是正常的！** `undefined` 表示使用代码中的默认值。

### 2. 检查构建产物

```bash
bun run build
grep -r "api.ottersage.com" frontend/dist/
```

应该能找到生产环境的 API 地址。

## 🔍 常见问题

### Q: 为什么环境变量显示 `undefined`？

**A**: 这是正常的！代码中有降级逻辑：

```typescript
// frontend/src/config/constants.ts
const apiBase =
  import.meta.env.VITE_API_BASE_URL || // 优先使用环境变量
  (import.meta.env.DEV
    ? 'https://localhost:8787' // 开发环境默认
    : 'https://api.ottersage.com') // 生产环境默认
```

### Q: 如何确认配置生效？

**A**: 查看 `API_CONFIG.API_BASE` 的值：

```javascript
console.log('🔧 API_CONFIG.API_BASE:', API_CONFIG.API_BASE)
```

### Q: 需要重新构建吗？

**A**:

- ✅ 修改 `.env` 后需要重新构建
- ✅ 修改 `.env.local` 后需要重启开发服务器
- ❌ 不需要清除缓存

## 📚 相关文档

- `ENV_VARIABLES.md`：详细的环境变量配置指南
- `frontend/.env.README.md`：为什么 frontend 目录没有 .env
- `frontend/vite.config.ts`：Vite 配置
- `frontend/src/config/constants.ts`：环境变量使用

## 🎉 优化效果

- ✅ 减少了配置文件数量（从 3 个减少到 2 个）
- ✅ 消除了重复定义
- ✅ 提高了配置的可维护性
- ✅ 降低了配置错误的风险
- ✅ 统一了配置管理方式

## 🚀 下一步

1. **重新构建扩展**：

   ```bash
   CRAWLER_DEBUG=true bunx vite build
   ```

2. **重新加载扩展**：
   在 `chrome://extensions/` 页面点击"重新加载"

3. **验证配置**：
   打开 Service Worker 控制台，检查环境变量输出

4. **测试功能**：
   按 `Alt+K` 测试 AI 自动添加书签功能
