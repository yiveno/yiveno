# 环境变量方案

## 目标

- 共享第三方配置复用，不在三个项目各自维护一份
- 开发环境与生产环境严格分离，禁止把 `localhost` 带进生产配置
- 下游运行时文件统一由脚本生成，不手改生成产物

## 源文件

只维护以下 3 个源文件：

- `/Users/cqw/Documents/github/Yiveno/.env.shared.local`
- `/Users/cqw/Documents/github/Yiveno/.env.development.local`
- `/Users/cqw/Documents/github/Yiveno/.env.production.local`

### 1. `.env.shared.local`

放开发/生产共用的第三方变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_GOOGLE_CLIENT_ID`
- `AUTH_GOOGLE_CLIENT_SECRET`
- `AUTH_MICROSOFT_CLIENT_ID`
- `AUTH_MICROSOFT_CLIENT_SECRET`
- `AUTH_GOOGLE_AUTH_URL`
- `AUTH_GOOGLE_TOKEN_URL`
- `AUTH_GOOGLE_USERINFO_URL`
- `AUTH_MICROSOFT_AUTH_URL`
- `AUTH_MICROSOFT_TOKEN_URL`
- `AUTH_MICROSOFT_USERINFO_URL`
- `GUMROAD_SELLER_ID`
- `VITE_GUMROAD_PRODUCT_URL`
- `VITE_GUMROAD_MANAGE_URL`
- `REDIRECT_URI_ALLOWLIST`

### 2. `.env.development.local`

只放开发环境覆盖值：

- `WEBSITE_URL`
- `VITE_WEBSITE_URL`
- `VITE_API_BASE_URL`
- `VITE_CLOUDFLARE_WORKER_URL`
- `JWT_SECRET`

默认应指向本地：

- `WEBSITE_URL=http://localhost:3001`
- `VITE_API_BASE_URL=http://localhost:8787`

### 3. `.env.production.local`

只放生产环境覆盖值：

- `JWT_SECRET`
- 如需覆盖，也可显式写入：
  - `WEBSITE_URL`
  - `VITE_WEBSITE_URL`
  - `VITE_API_BASE_URL`
  - `VITE_CLOUDFLARE_WORKER_URL`

默认应指向正式域名：

- `WEBSITE_URL=https://yiveno.com`
- `VITE_API_BASE_URL=https://api.yiveno.com`

## 生成文件

以下文件为运行时产物，不手改：

- `/Users/cqw/Documents/github/Yiveno/.env.runtime/.env.development`
- `/Users/cqw/Documents/github/Yiveno/.env.runtime/.env.production`
- `/Users/cqw/Documents/github/Yiveno/backend/.dev.vars`
- `/Users/cqw/Documents/github/Yiveno/website/.env`

生成脚本：

- `/Users/cqw/Documents/github/Yiveno/scripts/dev-env.mjs`

## 命令

```bash
bun run env:sync:dev
bun run env:sync:prod
bun run env:check:dev
bun run env:check:prod
```

含义：

- `env:sync:*`：把 3 个源文件生成到各子项目运行时文件
- `env:check:*`：校验当前 profile 是否缺字段、是否把 `localhost` 混进错误环境

## 子项目读取方式

- `frontend`
  - 从 `.env.runtime/.env.development` 或 `.env.runtime/.env.production` 读取
  - `vite.config.ts` 已指向根目录 `.env.runtime`
- `backend`
  - 本地开发读取 `backend/.dev.vars`
  - Cloudflare 线上环境变量在 Worker Dashboard / Wrangler 环境中维护
  - **AI Gateway（非 Secret，写在 `backend/wrangler.toml` `[vars]`）**
    - `AI_PROVIDER`（可选）：聊天补全实现，默认 `deepseek`；换厂商时加 Worker adapter + 改此变量
    - `AI_GATEWAY_ACCOUNT_ID`：Cloudflare Account ID
    - `AI_GATEWAY_ID`：Gateway 名称（当前 `yiveno`）；Dashboard 需先创建同名 Gateway
    - 二者都非空时，DeepSeek 经 `gateway.ai.cloudflare.com` 转发；否则直连 `DEEPSEEK_API_BASE`
    - Secret 仍是 `DEEPSEEK_API_KEY`（经 `env:sync` 写入 `.dev.vars`）
    - 若 Gateway 开启 Authenticated Gateway：另需 Secret `AI_GATEWAY_TOKEN`（`cf-aig-authorization`）；未配时 Worker 遇 401 会回退直连 DeepSeek
    - Handler 经 `resolveAiChatProvider(env)` 调用上游，业务不直连 DeepSeek 客户端
    - Capture enrichment：`POST /api/ai/enrichment/complete`；可选 `AI_ENRICHMENT_PROXY_ENABLED=false` 关闭；`AI_ENRICHMENT_DAILY_LIMIT`（默认 80，按 IP）
- `website`
  - 读取 `website/.env`

## 维护规则

- 共享三方变量优先放 `.env.shared.local`
- 内部地址、环境切换项只放环境文件，不放 shared
- Cloudflare Worker 线上变量必须与本地源文件保持同名、同语义
- 修改环境变量后先执行：

```bash
bun run env:sync:dev
bun run env:check:dev
```

- 生产发布前必须执行：

```bash
bun run env:sync:prod
bun run env:check:prod
```

## 当前 Gumroad 规则

- **结账价权威在 Gumroad**；Yiveno 不拉价 API、不在代码里当计费源。官网展示锚点可写 $5.99/月 · $59/年，改价优先改 Gumroad，再视需要改展示文案。
- 前端购买入口只依赖 `VITE_GUMROAD_PRODUCT_URL`
- 官网购买入口映射为 `PUBLIC_GUMROAD_PRODUCT_URL`（同源自 `VITE_GUMROAD_PRODUCT_URL`）
- 管理页：`VITE_GUMROAD_MANAGE_URL` / `PUBLIC_GUMROAD_MANAGE_URL`（默认 Gumroad subscriptions）
- 月付/年付在 Gumroad 产品侧配置；扩展只拼 `custom_fields[user_id]` + `tier=pro`
- 后端 webhook 校验依赖 `GUMROAD_SELLER_ID`
- 不再依赖 `GUMROAD_WEBHOOK_SECRET`
- 对外档位：Free + **仅 Pro**（Power User / Team / `premium` 预留不售）
- 云同步 / 托管 LLM / Hybrid 均需有效 Pro

### Gumroad 上线检查清单

1. [ ] Pro 产品已建（月/年）；Ping → `https://api.yiveno.com/api/gumroad/webhook`
2. [ ] `.env.*.local` 已设 `GUMROAD_SELLER_ID`、`VITE_GUMROAD_PRODUCT_URL`（及可选 `VITE_GUMROAD_MANAGE_URL`）
3. [ ] `bun run env:sync:prod && bun run env:check:prod`（website 出现 `PUBLIC_GUMROAD_*`）
4. [ ] 测试购买：webhook 写库 → 扩展 Settings 刷新 → `isPro` → Hybrid/同步可用
5. [ ] 取消或过期后权益收回

## 禁止事项

- 禁止手改 `backend/.dev.vars`
- 禁止手改 `website/.env`
- 禁止把生产域名写进 `.env.development.local`
- 禁止把 `localhost` 写进 `.env.production.local`
- 禁止把真实密钥提交进仓库
