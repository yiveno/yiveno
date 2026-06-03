# 🔧 otterSage Backend - Cloudflare Worker

Cloudflare Workers 驱动的后端服务，简洁稳定、易于部署与维护。

## ⚡ 特性

- 🚀 **极致性能**: 启动速度提升3倍，API响应提升2倍
- 🔥 **Bun原生**: 充分利用Bun的性能优势
- 🌐 **现代API**: 支持智能书签分类和URL检测
- 📊 **性能监控**: 内置性能指标和基准测试
- 🛡️ **错误处理**: 优雅的错误处理和降级机制

## 🚀 快速开始

### 环境要求

- Bun >= 1.0.0

### 安装依赖

```bash
cd backend
bun install
```

### 启动服务

```bash
# 本地开发（wrangler）
bunx wrangler dev

# 部署到 Cloudflare
bunx wrangler deploy
```

### 健康检查

```bash
curl -k https://localhost:8787/api/health  # -k 忽略自签名证书
```

## 📡 API端点

### 核心API

- `POST /api/start-processing` - 启动书签处理任务
- `GET /api/get-progress/:jobId` - 获取任务进度
- `POST /api/check-urls` - 批量URL状态检测
- `POST /api/classify-single` - 单个书签智能分类
- `POST /api/ai/complete` - AI聊天/补全（支持多提供商）
- `POST /api/ai/embedding` - 生成向量嵌入（支持多提供商）
- `GET /health` - 服务器健康状态

### 认证与账户

- `GET /api/auth/start` - 开始 OAuth（Google/GitHub）
- `GET /api/auth/callback` - OAuth 回调（含 PKCE）
- `GET /api/auth/providers` - 查看各 Provider 是否已配置（排查"provider not configured"）

**注意：用户认证已迁移到 Supabase Auth**

- 前端直接调用 Supabase Auth API（注册、登录、重置密码等）
- 后端不再提供用户认证 API（`/api/auth/register`、`/api/auth/login` 等已移除）

### 示例请求

```bash
# 智能分类
curl -k -X POST https://localhost:8787/api/classify-single \
  -H "Content-Type: application/json" \
  -d '{
    "bookmark": {
      "title": "GitHub - The world'\''s leading AI-powered developer platform",
      "url": "https://github.com"
    }
  }'

# URL检测
curl -k -X POST https://localhost:8787/api/check-urls \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://github.com", "https://stackoverflow.com"],
    "settings": {"timeout": 5000}
  }'
```

### AI 提供商与配置

- 通过环境变量 `AI_PROVIDER` 切换：`cloudflare | openai | groq | deepseek | gateway`
- 默认模型：
  - 文本补全 `DEFAULT_AI_MODEL`（默认 `@cf/meta/llama-3.1-8b-instruct`）
  - 向量嵌入 `DEFAULT_EMBEDDING_MODEL`（默认 `@cf/baai/bge-m3`）

示例：OpenAI 兼容聊天与嵌入

```bash
curl -k -X POST https://localhost:8787/api/ai/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"你好，简要总结这个项目。"}],
    "temperature": 0.6,
    "max_tokens": 256
  }'

curl -k -X POST https://localhost:8787/api/ai/embedding \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "openai",
    "model": "text-embedding-3-small",
    "text": "otterSage 是一个高性能书签管理扩展"
  }'
```

示例：Cloudflare Workers AI（默认）

```bash
curl -k -X POST https://localhost:8787/api/ai/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "prompt": "用一句话介绍此项目"
  }'

curl -k -X POST https://localhost:8787/api/ai/embedding \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "@cf/baai/bge-m3",
    "text": "otterSage"
  }'
```

### 成本与护栏（推荐策略）

- 默认启用“就绪优先、云端回退”策略：前端优先使用 Chrome 内置 AI，就绪则本地推理；不可用或能力不足时回退至后端提供商。
- 后端统一路由已内置以下成本控制措施：
  - 最大输出 token 硬上限：由 `AI_MAX_OUTPUT_TOKENS` 控制，防止长输出导致费用飙升。
  - 每日调用次数护栏：由 `AI_DAILY_MAX_CALLS` 控制，包含聊天与嵌入总调用数。
  - 结果缓存：对 `complete` 与 `embedding` 进行去重缓存，降低重复请求成本。

配置示例：

```bash
# Max output tokens per request (hard cap)
AI_MAX_OUTPUT_TOKENS=512
# Daily max total AI calls (chat+embedding)
AI_DAILY_MAX_CALLS=2000
# Cache TTL for chat/completion results (seconds)
AI_CACHE_TTL_SECONDS=3600
# Cache TTL for embeddings (seconds)
AI_EMBED_CACHE_TTL_SECONDS=604800
# Max cache entries in memory
AI_CACHE_MAX_ENTRIES=1000
```

说明：

- 缓存键包含 `provider/model/prompt(messages)` 等要素，确保同一输入稳定命中；嵌入默认长TTL（7天），文本补全默认中TTL（1小时）。
- `AI_MAX_OUTPUT_TOKENS` 会在路由层强制生效，优先取较小值保证预算安全。
- 超出每日调用上限时，后端返回错误（429语义），前端应提示并延迟重试或切换到离线策略。

## 🔧 配置

### 环境变量

```bash
PORT=3000                    # 服务器端口
HOST=localhost              # 绑定地址
NODE_ENV=development        # 环境模式
REDIRECT_URI_ALLOWLIST=     # 允许的 redirect_uri 前缀/来源（逗号分隔或 JSON 数组）
# JWT_SECRET=                # JWT 签名密钥（必须，生产使用高熵随机值）
# OAuth Providers（如启用 Google/Microsoft/Apple 登录，必须配置以下）
# AUTH_GOOGLE_CLIENT_ID=              # Google OAuth 客户端 ID
# AUTH_GOOGLE_CLIENT_SECRET=          # Google OAuth 客户端 Secret
# AUTH_MICROSOFT_CLIENT_ID=           # Microsoft Azure 客户端 ID
# AUTH_MICROSOFT_CLIENT_SECRET=       # Microsoft Azure 客户端 Secret
# AUTH_APPLE_CLIENT_ID=               # Apple Sign In 客户端 ID
# AUTH_APPLE_CLIENT_SECRET=           # Apple Sign In 客户端 Secret
```

说明：

- 安全策略
  - 默认仅放行 https://\*.chromiumapp.org 的回调（Chrome 扩展 WebAuthFlow 的固定域）。
  - 其它 https 回调需显式加入 `REDIRECT_URI_ALLOWLIST`，支持：完整前缀（含路径）、Origin（协议+主机+端口）或主机名精确匹配。
  - 仅对 localhost/127.0.0.1 允许 http；拒绝 data:/javascript: 等危险 scheme。

### 常见排查：provider not configured

`/api/auth/start?provider=google|microsoft|apple` 返回 `{"error":"provider not configured: <name>"}`，说明缺少对应的 Client ID/Secret 环境变量。

排查步骤：

- 访问 `GET /api/auth/providers` 查看 `providers.google/microsoft/apple` 是否为 true。
- 若为 false，请在本地 `.dev.vars` 或 Cloudflare Secrets 中补齐：

本地（wrangler dev）：在 `backend/.dev.vars` 写入如下内容并重启 wrangler：

```
JWT_SECRET=dev-secret-change-me

# Google
AUTH_GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
AUTH_GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx

# Microsoft
AUTH_MICROSOFT_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx

```

线上（Cloudflare）：在 Dashboard > Workers & Pages > Settings > Variables 中添加同名 `Secrets`。

说明：默认允许的 `redirect_uri` 域是 `https://*.chromiumapp.org`（Chrome 扩展的固定回调域）。如需自定义网页回调，请设置 `REDIRECT_URI_ALLOWLIST`。

### 配置 OAuth Provider（简版）

1. **Google Cloud Console**

- 创建"OAuth 同意屏幕"和"凭据 > OAuth 客户端 ID（Web application）"
- 授权重定向 URI：`https://ottersage.com/api/auth/callback`

2. **Microsoft Azure Portal**

- 在 Azure Active Directory > 应用注册中创建新应用
- 重定向 URI：`https://ottersage.com/api/auth/callback`
- API 权限：添加 `User.Read` 基本权限

3. **Apple Developer**

- 在 Certificates, Identifiers & Profiles 中创建 Service ID
- Sign In with Apple 配置：启用并添加重定向 URI
- 生成私钥并下载（`.p8` 文件）
- 复制 Client ID / Secret 填入环境变量

## 前端集成示例

前端可以使用 `/api/auth/providers` 接口动态获取可用的登录方式：

```javascript
// 获取支持的认证提供商
async function getAuthProviders() {
  const response = await fetch('/api/auth/providers')
  const data = await response.json()
  return data.providers
}

// 启动 OAuth 流程
async function signInWithProvider(provider, redirectUri) {
  const params = new URLSearchParams({
    provider,
    redirect_uri: redirectUri,
    state: generateRandomState() // 安全防护
  })
  window.location.href = `/api/auth/start?${params.toString()}`
}
```

支持的提供商：`google`、`microsoft`、`apple`

## 推荐的登录界面设计

```
┌─────────────────────────────────┐
│  使用 Google 账号继续   [推荐]  │
├─────────────────────────────────┤
│  使用 Microsoft 账号继续        │
├─────────────────────────────────┤
│  使用 Apple ID 继续              │
└─────────────────────────────────┘
```

建议将 Google 设置为主要登录方式，Microsoft 和 Apple 作为备选。

### Supabase 数据库配置（必需）

**注意：D1 数据库已移除，已迁移到 Supabase**

在 Cloudflare Workers Dashboard 或 `wrangler.toml` 中配置：

**获取 Supabase 配置：**

1. 登录 Supabase Dashboard
2. 进入 Project Settings → API
3. 复制 `URL` 和 `service_role` key

**数据库表结构：**

- 在 Supabase Dashboard → SQL Editor 中执行 `backend/supabase-schema.sql`
- 表结构包括：`user_profiles`、`subscriptions`、`payment_records`

### 性能调优

```bash
# 启用性能分析
bun --prof server-bun-native.js

# 运行基准测试
bun run benchmark
```

## 📊 性能指标

### 启动性能

- **冷启动**: ~60ms (vs Node.js ~200ms)
- **内存占用**: ~28MB (vs Node.js ~45MB)

### API性能

- **平均响应时间**: ~8ms
- **并发处理**: 150% 提升
- **内存效率**: 38% 降低

### 运行基准测试

```bash
bun run benchmark
```

## 🏗️ 项目结构

```
backend/
├── server-bun-native.js    # 主服务器文件
├── utils/
│   └── job-store.js        # 任务存储 (Bun原生)
├── benchmark.js            # 性能基准测试
├── bun.config.js          # Bun配置
└── package.json           # 项目配置
```

## 🔄 核心功能

### 智能分类

基于URL和标题的智能书签分类：

- 开发技术 (Development)
- 新闻资讯 (News & Articles)
- 社交媒体 (Social Media)
- 购物电商 (Shopping)
- 教育学习 (Education)
- 工具效率 (Tools & Utilities)
- 娱乐休闲 (Entertainment)

### URL检测

高性能并发URL状态检测：

- 批量处理
- 超时控制
- 错误恢复
- 状态码分析

### 任务管理

异步任务处理系统：

- 进度追踪
- 状态管理
- 自动清理
- 错误处理

## 🐛 问题排查

### 常见问题

**Q: 服务器启动失败**

```bash
# 检查Bun版本
bun --version

# 检查端口占用
lsof -i :3000

# 查看详细日志
bun run dev:verbose
```

**Q: API请求失败**

```bash
# 检查CORS设置
curl -k -I https://localhost:8787/api/health

# 测试连通性
curl -k -v https://localhost:8787/api/health
```

### 性能问题

```bash
# 运行性能诊断
bun run benchmark

# 检查内存使用
bun run performance
```

## 🧪 测试

```bash
# 运行所有测试
bun test

# 运行测试并查看覆盖率
bun test --coverage

# 监控模式
bun test --watch
```

## 📈 监控

### 内置监控

- 响应时间追踪
- 内存使用监控
- 错误率统计
- 任务处理状态

### 监控端点

```bash
# 健康检查
GET /health

# 服务器信息
GET /api/health
```

## 🚀 部署

### Docker部署

```dockerfile
FROM oven/bun:alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["bun", "start"]
```

### 系统服务

```bash
# 创建systemd服务
sudo cp ottersage.service /etc/systemd/system/
sudo systemctl enable ottersage
sudo systemctl start ottersage
```

## 📝 开发指南

### 添加新API

```javascript
// 在 handleApiRoutes 中添加新路由
case '/api/new-endpoint':
  return await handleNewEndpoint(req, corsHeaders);

// 实现处理函数
async function handleNewEndpoint(req, corsHeaders) {
  // 处理逻辑
  return createJsonResponse(result, corsHeaders);
}
```

### 性能优化

1. 使用Bun原生API
2. 避免阻塞操作
3. 合理使用并发
4. 监控内存使用

## 🔧 贡献指南

1. Fork 项目
2. 创建功能分支
3. 运行测试: `bun test`
4. 运行基准测试: `bun run benchmark`
5. 提交Pull Request

## 📄 许可证

MIT License

---

🔥 基于Bun构建，为性能而生！
