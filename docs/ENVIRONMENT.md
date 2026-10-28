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

- `SUPABASE_URL`（生产项目主库区域：**East US / Ohio · `us-east-2`**；Dashboard Primary Database 为准）
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_GOOGLE_CLIENT_ID`（遗留 Worker OAuth；**用户主路径**已改官网 Supabase Auth）
- `AUTH_GOOGLE_CLIENT_SECRET`
- `AUTH_MICROSOFT_CLIENT_ID`
- `AUTH_MICROSOFT_CLIENT_SECRET`
- `AUTH_GOOGLE_AUTH_URL`
- `AUTH_GOOGLE_TOKEN_URL`
- `AUTH_GOOGLE_USERINFO_URL`
- `AUTH_MICROSOFT_AUTH_URL`
- `AUTH_MICROSOFT_TOKEN_URL`
- `AUTH_MICROSOFT_USERINFO_URL`
- （官网 Email OTP）Supabase 启用 Email、模板含 `{{ .Token }}`、Redirect 含 `/auth/callback`；生产 SMTP = **阿里云 DirectMail**（见 `docs/AUTH_GUIDE.md`）
- `PUBLIC_TURNSTILE_SITE_KEY`（共享源文件；同步到 `website/.env` / Pages）— Cloudflare Turnstile **sitekey**；对应 **Secret** 只填 Supabase Attack Protection，**不要**写入本仓 env 源文件
- `DODO_PAYMENTS_API_KEY`（checkout / 对账；生产必配；test=`dodo_test_…`，live=`dodo_live_…`）
- `DODO_PAYMENTS_WEBHOOK_KEY`（Standard Webhooks signing secret，`whsec_…`）
- `DODO_PAYMENTS_ENVIRONMENT`（`test_mode` | `live_mode`；缺省按 test，生产必须 `live_mode`）
- `DODO_PRODUCT_ID_PRO_MONTHLY` / `DODO_PRODUCT_ID_PRO_ANNUAL`
- `DODO_PRODUCT_ID_FOUNDING_MONTHLY` / `DODO_PRODUCT_ID_FOUNDING_ANNUAL`（仅 Founding 打开时）
- `BILLING_FOUNDING_ENABLED`（默认 `false`）
- `REDIRECT_URI_ALLOWLIST`
- `ALIYUN_DM_ACCESS_KEY_ID` / `ALIYUN_DM_ACCESS_KEY_SECRET`（Pro 欢迎信 DirectMail API；与 Supabase OTP SMTP 分立）
- （可选）`ALIYUN_DM_ACCOUNT_NAME`（默认 `hello@yiveno.com`）、`ALIYUN_DM_FROM_ALIAS`、`ALIYUN_DM_REPLY_ADDRESS`（默认 `support@yiveno.com`）、`ALIYUN_DM_REGION_ID`、`ALIYUN_DM_ENDPOINT`

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
- `worker/.dev.vars`
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

- `extension`
  - 从 `.env.runtime/.env.development` 或 `.env.runtime/.env.production` 读取
  - `vite.config.ts` 已指向根目录 `.env.runtime`
- `worker`
  - 本地开发读取 `worker/.dev.vars`
  - Cloudflare 线上环境变量在 Worker Dashboard / Wrangler 环境中维护
  - **AI Gateway（非 Secret，写在 `worker/wrangler.toml` `[vars]`）**
    - `AI_PROVIDER`（可选）：聊天补全实现，默认 `deepseek`；换厂商时加 Worker adapter + 改此变量
    - `AI_HOSTED_MODEL`：全局默认 chat 模型（现网 `deepseek-v4-flash`）
    - **任务级模型覆盖（可选 · Phase 1 插座；未设 = 全任务同 `AI_HOSTED_MODEL`，勿当已分模上线）**
      - `AI_HOSTED_MODEL_NLU`：仅 `taskKind=nlu`
      - `AI_HOSTED_MODEL_NLG`：`framing_nlg` / `follow_up_nlg` / `narrow_polish`
      - `AI_HOSTED_MODEL_ENRICHMENT` / `AI_HOSTED_MODEL_GS_SAMPLES`：对应任务（若走可配置层）
      - 请求体可带 `taskKind`（闭集；缺省 `nlu`）；**禁止**客户端传任意 `model` 名
      - **maxTokens 服务端按 task 钳制**（nlu/enrichment/gs 400；framing/follow_up 256；narrow_polish 128）；客户端可传更小。方案见 `docs/architecture/2026-10-任务级模型路由方案.md`
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
    - Env：`SKIP_DEPENDENCY_INSTALL=true`、`BUN_VERSION=1.4.0`，以及 `PUBLIC_API_BASE_URL` / `PUBLIC_SUPABASE_*` / `PUBLIC_WEBSITE_URL` / `PUBLIC_TURNSTILE_SITE_KEY`（Turnstile **sitekey**；Secret 只在 Supabase）
    - Path includes：`website/*`、`packages/*`（design-tokens）
    - 本机直推仍可用：`bun run deploy:web`
    - **软性 geo 域名跳转（与 UI 语言无关）**
      - 代码：`website/functions/_middleware.ts` + `website/src/geo/resolve-geo-domain-redirect.ts`
      - 规则：CF `request.cf.country === CN` → `https://yiveno.cn`（同 path/query）；其它有国家码 → `https://yiveno.com`；港台澳走 `.com`
      - 软性：Cookie / `?geo_domain=com|cn|stay`（Cookie 名 `yiveno_geo_domain`）；爬虫 UA 与 `*.pages.dev` / localhost 不跳
      - **开关 `GEO_CN_MARKET_LIVE`**（Pages 环境变量 / `website/wrangler.toml` `[vars]`）：**已启用 `true`（2026-10-26）**。`CN` → `yiveno.cn`；其它有 CF 国家码 → `yiveno.com`；港台澳走 `.com`；Cookie / `?geo_domain=com|cn|stay` 可软性覆盖。临时关闭：改 `false` 后 `bun run deploy:web`
      - **运维现状（2026-10-26）：** `yiveno.cn` Zone 已在 CF；Pages `yiveno-website` Custom domains 含 **`yiveno.com` / `www.yiveno.com` / `yiveno.cn` / `www.yiveno.cn`**（均 active）。DNS 可用 CNAME→`yiveno-website.pages.dev`（推荐）或 CNAME→`yiveno.com`（当前亦可；均须橙云 Proxied）

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

- **结账价权威在 Dodo Product**；Yiveno 只维护 plan id → Product ID 与展示锚点（`worker/src/services/billing/plans.ts`）。标准展示价 **$7.99/月 · $59.99/年**。详见 `docs/pricing.md`。
- **权益投影**在 Supabase `subscriptions`（非第二账本）；对账与门禁见产品文档 **§A.3.2**（TTL 24h / grace 48h；Dodo 非 `active` 立刻降级；`on_hold` 非 Pro）。
- 扩展升级入口：官网 `/pricing`；管理入口：官网 `/account`（Dodo Customer Portal）。扩展**不**嵌 checkout SDK。
- 官网：`POST /api/billing/checkout-session` `{ plan }` → Dodo hosted `checkout_url`（Worker 写入 `metadata.yiveno_user_id`）。
- 扩展→官网登录：`POST /api/auth/website-session`（Bearer=扩展 access）→ 铸造官网独立 session（**不**写扩展租约）；官网页 `/auth/from-extension` 经 `YIVENO_WEBSITE_SESSION_REQUEST` 向扩展索取后 `setSession`。
- 官网→扩展登录：`POST /api/auth/extension-session`（Bearer；body `{ extensionId?, confirmDisplace? }`）→ 铸造扩展独立 session + `uninstallRevokeToken`；KV `ext_auth_session:{userId}` 含 `sessionId`+可选 `extensionId`+可选 revoke token；**已有租约**时先用 PostgREST 高置信探测该 `sessionId` 是否仍在 `auth.sessions`——仅 **gone**（200+空数组）清僵死租约后直接 mint；**alive / unknown**（含探测失败）→ 409 `needs_displace_confirm`（`data.existingSessionId` + `existingMintedAt`；互斥优先；禁止 Admin GET 404 误判 gone）；**仅**本次 `connect_extension` pending 才 mint（禁止仅凭 `last_extension_id` 静默 remint；`/account?extension_id` 只记退出目标、不 mint）；Connect 前 `YIVENO_EXTENSION_AUTH_STATUS_PROBE` 若扩展已是同一 userId → 跳过 mint；遇 409 → `YIVENO_EXTENSION_LEASE_RECLAIM_PROBE`（本机 `last_extension_lease_session_id` 匹配且未登录 → **静默** `confirmDisplace`；否则**自定义弹窗**——立意仅真·他端 Profile/设备）；`confirmDisplace` **先**硬撤前序扩展租约 Auth session（可重试）成功后才铸造并写新 KV（失败 → `displace_revoke_failed`，不发新会话）；**不**撤官网会话；扩展存活探测 `GET /api/auth/extension-session-lease`（Bearer）对照 KV 租约；官网可多端同登；扩展 1min 闹钟跑 `GET_AUTH_STATE`；官网 `getUser` 存活探测仅对本浏览器官网会话作废（不因扩展挤掉而踢官网）；扩展被挤退登后**不**自动开 `/login`，靠 displaced 软条 Connect。**同浏览器 UI 桥（ADR-019）：** 官网 `chrome.runtime.connect(extensionId, { name: 'yiveno-ui-bridge' })` ↔ SW `onConnectExternal`；登录 UI / 资料展示（无 token）；已登录 Connect：`request_extension_connect` → 官网原地 mint，`website_connect_ack` / `website_connect_result`；无 ack → `/account?connect_extension=1`；Connect 条优先 `chrome.storage.session` `yiveno:website_auth_ui`，`PROBE_WEBSITE_SIGNED_IN` 兜底。卸载：扩展安装即 `setUninstallURL` → 官网 `/auth/extension-uninstalled`（与登录解耦；退登只清 revoke token、保留反馈 URL）；登录态 URL 另带 `?token=`；`POST /api/auth/extension-uninstall-revoke` `{ token }`（公开一次性；官网 mint 成功但 handoff 失败亦用此回滚活租约）；主动退出无本地 token 时 `POST /api/auth/extension-session-release`（Bearer=扩展 access，仅清匹配本 session 的租约）；revoke token 的 KV `expirationTtl` ≤365 天（CF 上限）。落地页可选反馈 `POST /api/website/uninstall-feedback` → `recordFeedback`（闭集 `reasons[]` 与/或 `note` + `context`：Worker 取 IP/UA，客户端可报 displayName/email/language/timezone/screen；IP 限流；**KV 底账成功即 200**；邮件 `waitUntil` 尽力外发，不挡响应：**From=`feedback@yiveno.com`** → To=运营已验证 destination，默认 `FEEDBACK_TO_EMAIL=hi.yiveno@gmail.com`；邮件正文仅运营字段）。别名不可作 TO；欢迎信仍用 From=`hello@`。本地 host 跳过日限流；`[[send_email]] remote = true`。见产品文档 §账户与同步「用户触点三轨」。
- Webhook：`POST /api/webhooks/dodo`，校验 Standard Webhooks（`DODO_PAYMENTS_WEBHOOK_KEY`）。产品欢迎信走 **阿里云 DirectMail**（`ALIYUN_DM_ACCESS_KEY_*`；发件 `hello@yiveno.com`）。未配 AK / 发信失败只打日志，不 5xx。
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
6. [ ] （上线前）欢迎信：`.env.shared.local` + 生产 Worker Secrets 配齐 `ALIYUN_DM_ACCESS_KEY_ID` / `ALIYUN_DM_ACCESS_KEY_SECRET`；DirectMail 控制台 `hello@yiveno.com` 可 API 发信；手测开通 Pro 收信
7. [ ] （可选 · 卸载反馈）Workers Paid + Email Sending enable `yiveno.com`；手测卸载反馈进 `feedback@`→Gmail（失败不得 5xx）；生产须 `bun run deploy:worker` 后 `POST /api/website/uninstall-feedback` 非 404

## 禁止事项

- 禁止手改 `worker/.dev.vars`
- 禁止手改 `website/.env`
- 禁止把生产域名写进 `.env.development.local`
- 禁止把 `localhost` 写进 `.env.production.local`
- 禁止把真实密钥提交进仓库
