# 环境变量方案

## 目标

- 共享第三方配置复用，不在三个项目各自维护一份
- 开发环境与生产环境严格分离，禁止把 `localhost` 带进生产配置
- 下游运行时文件统一由脚本生成，不手改生成产物

## 源文件

只维护以下 3 个源文件：

- `.env.shared.local`（仓库根）
- `.env.development.local`
- `.env.production.local`

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
- `DODO_PAYMENTS_API_KEY`（checkout / 对账；生产必配；test=`dodo_test_…`，live=`dodo_live_…`）
- `DODO_PAYMENTS_WEBHOOK_KEY`（Standard Webhooks signing secret，`whsec_…`）
- `DODO_PAYMENTS_ENVIRONMENT`（`test_mode` | `live_mode`；缺省按 test，生产必须 `live_mode`）
- `DODO_PRODUCT_ID_PRO_MONTHLY` / `DODO_PRODUCT_ID_PRO_ANNUAL`
- `DODO_PRODUCT_ID_FOUNDING_MONTHLY` / `DODO_PRODUCT_ID_FOUNDING_ANNUAL`（仅 Founding 打开时）
- `BILLING_FOUNDING_ENABLED`（默认 `false`）
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

- `.env.runtime/.env.development`
- `.env.runtime/.env.production`
- `backend/.dev.vars`
- `website/.env`

生成脚本：

- `scripts/dev-env.mjs`

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
    - Getting Started 示意 clue：`POST /api/ai/gs-clue-samples/complete`；可选 `AI_GS_CLUE_SAMPLES_PROXY_ENABLED=false` 关闭；`AI_GS_CLUE_SAMPLES_DAILY_LIMIT`（默认 40，按 IP）
- `website`
  - 本地读取 `website/.env`（由 `env:sync` 生成）
  - **Cloudflare Pages（`yiveno-website` · Git 连 `main`）**
    - 根目录留空（monorepo 根，才能读到 `bun.lock`）；勿再设 `website` 为 root（会触发 `npm install` → `workspace:*` 失败）
    - Build command：`bun install --frozen-lockfile && bun run --cwd website build:prod:compile`
    - Build output：`website/dist`
    - Env：`SKIP_DEPENDENCY_INSTALL=true`、`BUN_VERSION=1.4.0`，以及 `PUBLIC_API_BASE_URL` / `PUBLIC_SUPABASE_*` / `PUBLIC_WEBSITE_URL`
    - Path includes：`website/*`、`packages/*`（design-tokens）
    - 本机直推仍可用：`bun run deploy:web`

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

## 当前 Dodo 规则

- **结账价权威在 Dodo Product**；Yiveno 只维护 plan id → Product ID 与展示锚点（`backend/src/services/billing/plans.ts`）。标准展示价 **$7.99/月 · $59.99/年**。详见 `docs/pricing.md`。
- **权益投影**在 Supabase `subscriptions`（非第二账本）；对账与门禁见产品文档 **§A.3.2**（TTL 24h / grace 48h；Dodo 非 `active` 立刻降级；`on_hold` 非 Pro）。
- 扩展升级入口：官网 `/pricing`；管理入口：官网 `/account`（Dodo Customer Portal）。扩展**不**嵌 checkout SDK。
- 官网：`POST /api/billing/checkout-session` `{ plan }` → Dodo hosted `checkout_url`（Worker 写入 `metadata.yiveno_user_id`）。
- 官网→扩展登录：`POST /api/auth/extension-session`（Bearer；body `{ extensionId?, confirmDisplace? }`）→ 铸造扩展独立 session + `uninstallRevokeToken`；KV `ext_auth_session:{userId}` 含 `sessionId`+可选 `extensionId`+可选 revoke token；**已有租约则 409 挤掉确认**（互斥按会话，不按 extensionId）；官网 Connect/`connect_extension` 遇 409 → **自动** `confirmDisplace`（不再二次弹窗）；须 Admin/PostgREST 撤销前序 session，失败返回 `displace_revoke_failed`（502）并回滚新 session；扩展存活探测 `GET /api/auth/extension-session-lease`（Bearer）对照 KV 租约；`confirmDisplace` 时撤销该用户其它 Auth session（保留新扩展 + 本次官网 Bearer）；扩展 1min 闹钟跑 `GET_AUTH_STATE`；官网 `getUser` 存活探测自动退登；退登后**不**自动开 `/login`，靠 displaced 软条 Connect。卸载：`POST /api/auth/extension-uninstall-revoke` `{ token }`（公开一次性）+ 官网 `/auth/extension-uninstalled`；revoke token 的 KV `expirationTtl` ≤365 天（CF 上限）。落地页可选反馈 `POST /api/website/uninstall-feedback` → `recordFeedback`（闭集 `reasons[]` 与/或 `note` + `context`：Worker 取 IP/UA，客户端可报 displayName/email/language/timezone/screen；IP 限流；**KV 底账成功即 200**；邮件 `waitUntil` 尽力外发，不挡响应：**From=`feedback@yiveno.com`** → To=运营已验证 destination，默认 `FEEDBACK_TO_EMAIL=hi.yiveno@gmail.com`；邮件正文仅运营字段）。别名不可作 TO；欢迎信仍用 From=`hello@`。本地 host 跳过日限流；`[[send_email]] remote = true`。见产品文档 §账户与同步「用户触点三轨」。
- Webhook：`POST /api/webhooks/dodo`，校验 Standard Webhooks（`DODO_PAYMENTS_WEBHOOK_KEY`）。产品欢迎信已接线但 **未上线**（须 Workers Paid + Email Sending onboard `yiveno.com`；发件 `hello@yiveno.com`）。未开通时发信失败只打日志，不 5xx。
- 对账：`DODO_PAYMENTS_API_KEY` → `GET /subscriptions/{id}`；未配时门禁退化为投影+硬门槛（生产必须配齐）。
- 对外档位：Free + **仅 Pro**（Power User / Team / `premium` 预留不售）
- 云同步须有效 Pro（服务端门禁，不只看扩展本地 snapshot）
- **禁止**生产手工授 Pro；开发假数据须 `test-` 前缀（门禁会拒绝）或短 `period_end`

### Dodo 上线检查清单

1. [ ] Dodo 已建 Pro Monthly / Annual 订阅商品（test 与 live 各一套 `pdt_…`，不可混用）
2. [ ] Webhook → `https://api.yiveno.com/api/webhooks/dodo`；`.env.*.local` 已设 `DODO_PAYMENTS_API_KEY`、`DODO_PAYMENTS_WEBHOOK_KEY`、`DODO_PAYMENTS_ENVIRONMENT`、Product ID
3. [ ] `bun run env:sync:prod && bun run env:check:prod`；Worker Secrets 含 API key / webhook secret / Product ID
4. [ ] 测试购买：webhook 写库（`verified`）→ 回扩展 Settings / 官网账户页自动对账 → `isPro` → 同步可用
5. [ ] Dodo `cancelled`（立即）/ `on_hold` / 全额退当前周期 → Refresh 或 Cron 后立刻收回；库内 `test-` 行不得为 Pro
6. [ ] （上线前）Workers Paid + Email Sending enable `yiveno.com`（Dashboard 或 `wrangler email sending enable yiveno.com`；API Token 须含 Email Sending 写权限）；手测欢迎信 + 卸载反馈进 `feedback@`→Gmail（失败不得 5xx）；生产须 `bun run deploy:be` 后 `POST /api/website/uninstall-feedback` 非 404

## 禁止事项

- 禁止手改 `backend/.dev.vars`
- 禁止手改 `website/.env`
- 禁止把生产域名写进 `.env.development.local`
- 禁止把 `localhost` 写进 `.env.production.local`
- 禁止把真实密钥提交进仓库
