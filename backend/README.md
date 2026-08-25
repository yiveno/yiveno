# Yiveno Backend（Cloudflare Worker）

v4 后端：扩展线索理解代理 + 官网只读 API。本地事实源在扩展 IndexedDB；本 Worker **不是**书签分类/URL 检测服务。

## 真实调用面

| 方法 | 路径                            | 调用方       | 说明                                                                          |
| ---- | ------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| GET  | `/health`、`/api/health`        | 运维         | 健康检查                                                                      |
| GET  | `/api/account/subscription`     | Chrome 扩展  | Supabase Bearer；**强制对账**后返回 Pro 快照                                  |
| POST | `/api/ai/clue/complete`         | 扩展（开发） | 线索理解 IP 日配额；正式 Pro 走 hosted                                        |
| POST | `/api/ai/enrichment/complete`   | Chrome 扩展  | Capture enrichment 结构化提议（扩展 merge 后写 IndexedDB）                    |
| POST | `/api/ai/embed`                 | Chrome 扩展  | Pro embedding（bge-m3）；门禁含 24h 对账新鲜度                                |
| POST | `/api/ai/hosted/*`              | Chrome 扩展  | Pro 托管口语 LLM（Bearer + 月配额 + 对账门禁）                                |
| GET  | `/api/website/subscription`     | 官网         | Bearer；强制对账；仅查当前用户                                                |
| \*   | `/api/memory/sync/*`            | Chrome 扩展  | 登录 + **Pro**（status/delete-all 除外）                                      |
| POST | `/api/webhooks/dodo`            | Dodo         | Standard Webhooks 验签 → 硬门槛 upsert + `billing_events`；欢迎信已接线未上线 |
| GET  | `/api/billing/plans`            | 官网         | 公开套餐目录（无 Product ID）                                                 |
| POST | `/api/billing/checkout-session` | 官网         | Bearer；有效 Pro → 409 `already_subscribed`；否则 hosted URL                  |
| POST | `/api/billing/portal-session`   | 官网         | Bearer；Dodo Customer Portal URL                                              |

生产域名：`https://api.yiveno.com`（Worker Custom Domain → `yiveno-production`）。

### 其它路由

| 前缀           | 说明                                    |
| -------------- | --------------------------------------- |
| `/api/auth/*`  | 旧 OAuth 辅助；官网登录走 Supabase 直连 |
| `/api/admin/*` | 环境变量自检（JWT）                     |

## 本地开发

```bash
# 根目录同步 env → backend/.dev.vars
bun run env:sync:dev

cd backend
bun run dev          # wrangler dev --port 8787（代码本地 + AI/KV remote binding）
bun test             # 单测
bun run deploy       # wrangler deploy --env production
```

健康检查：

```bash
curl http://localhost:8787/api/health
curl https://api.yiveno.com/api/health
```

### 可观测与故障排查

#### 探活

| 环境 | URL                                     | 期望                        |
| ---- | --------------------------------------- | --------------------------- |
| 本地 | `GET http://localhost:8787/api/health`  | `200`，JSON `status: "ok"`  |
| 生产 | `GET https://api.yiveno.com/api/health` | 同上（别名 `/health` 亦可） |

CI 定时探活见根目录 [`.github/workflows/api-health.yml`](../.github/workflows/api-health.yml)。

#### 看日志

```bash
# 实时跟踪生产 Worker（需已登录 wrangler）
cd backend && bunx wrangler tail --env production

# 过滤错误（示例）
bunx wrangler tail --env production --status error
```

- **Dashboard：** Cloudflare → Workers & Pages → `yiveno-production` → **Observability / Logs**
- 应用日志为结构化 JSON（`level` / `message` / `timestamp`）；HTTP 中间件会打请求开始/完成，并带 `x-request-id`（响应头同名，可串联单次请求）
- 业务前缀便于过滤：`[Billing]`、`[BillingReconcile]`、`[Cleanup]`、`[Supabase]`、`[website/…]`
- **采样：** 默认/开发部署 100%；`bun run deploy`（`--env production`）为 **25%** head sampling。未抽中的调用整段不进 Workers Logs；**Analytics 指标仍全量**。流量上来后可把 `wrangler.toml` 里 `env.production.observability` 再降到 `0.1`

#### Cron

| Cron（UTC）   | 用途         | 日志前缀             |
| ------------- | ------------ | -------------------- |
| `7 * * * *`   | 订阅对账     | `[BillingReconcile]` |
| `17 19 * * *` | 业务数据清理 | `[Cleanup]`          |

对账失败会打 ERROR 并 rethrow；在 Observability 里按前缀搜。

#### 常见故障对照

| 现象                            | 先看                                                 | 常见动作                                                    |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| API 全挂 / `/api/health` 非 200 | CF Status、最近 `deploy`、`wrangler tail`            | 回滚到上一版 Worker；查 Secrets 是否丢                      |
| 仅 AI / 线索失败                | AI Gateway Logs、`[…]` AI 相关 ERROR                 | 查 `DEEPSEEK_API_KEY`；Gateway 401 会回退直连               |
| Pro / 同步门禁异常              | `[Billing]`、`[BillingReconcile]`、Dodo webhook 投递 | 查 `DODO_PAYMENTS_*`、webhook URL、Supabase `subscriptions` |
| 官网 waitlist / billing 失败    | Worker 对应路由日志、CORS                            | 确认 `PUBLIC_API_BASE_URL` → `api.yiveno.com`               |
| OAuth / 登录手递失败            | `/api/auth/*` 或官网 Supabase Auth                   | redirect allowlist、Client Secret                           |

#### 回滚

```bash
cd backend
# 查看近期部署版本后，在 Dashboard 选 Previous deployment → Rollback
# 或重新 deploy 已知良好的 git commit：
git checkout <good-sha> -- .
bun run deploy
```

#### 需你在 Dashboard 手动开通的（仓库外）

下面 checklist 按顺序做一遍即可；约 10–15 分钟。

##### A. Cloudflare Health Check（API 探活）

**目标：** `https://api.yiveno.com/api/health` 不可用时邮件通知你。

**前置：** 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 选对 **Yiveno 账号**。

**计划限制（实测）：** `yiveno.com` 当前为 **Free**，Dashboard 显示「您的计划包含 **0** 个运行状况检查」，需 **升级到 Pro** 才能创建。Free 档请直接走下方 **C（GitHub Actions 探活）**。

**入口（zone 级，不是 account 级）：**

1. 选域名 **`yiveno.com`** → 左侧 **流量（Traffic）** → **运行状况检查（Health Checks）**  
   直达：`https://dash.cloudflare.com/<account_id>/yiveno.com/traffic/health-checks`  
   （account 级 `/traffic/health-checks` 会 **Page not found**，勿用。）
2. 若见 **升级到 Pro**，先升级；否则 **Create** / **Add health check**。
3. 填写建议值：

   | 字段                  | 建议值                                                         |
   | --------------------- | -------------------------------------------------------------- |
   | **Name**              | `yiveno-api-health`                                            |
   | **Monitor type**      | HTTPS                                                          |
   | **URL / Path**        | `https://api.yiveno.com/api/health`                            |
   | **Method**            | GET                                                            |
   | **Expected codes**    | `200`                                                          |
   | **Interval**          | 60 秒（或 1 分钟）                                             |
   | **Retries / Timeout** | 默认即可（如 2 次失败再判 unhealthy）                          |
   | **Regions**           | 先选 **1–3 个区域**（Worker 全球边缘；不必 13 区全开，省配额） |

4. **Save** 后等 1–2 分钟，在 Health Check 详情里确认状态为 **Healthy**。
5. 本地自测（应与 Dashboard 一致）：

   ```bash
   curl -fsS https://api.yiveno.com/api/health | jq .
   # 期望：{"status":"ok","runtime":"cloudflare-worker","timestamp":"..."}
   ```

**说明：** Health Check 测的是 **公网可达 + HTTP 200**；不校验 JSON 字段。仓库内 [`.github/workflows/api-health.yml`](../.github/workflows/api-health.yml) 会额外断言 `status: "ok"`。

##### B. Health Check 告警（Notifications）

Health Check 本身只「探测」；**告警要在 Notifications 里绑**。须 **先完成 A**（有可用的 Health Check），否则第二步「选择运行状况检查」列表为空。

1. Dashboard → **管理帐户** → **通知（Notifications）** → **添加**  
   直达：`https://dash.cloudflare.com/<account_id>/notifications/create`
2. 产品筛选选 **运行状况检查（Health Checks）** → 警报类型 **运行状况检查状态通知** → **选择**。
3. 填写：

   | 字段              | 建议值                                                            |
   | ----------------- | ----------------------------------------------------------------- |
   | **Name**          | `yiveno-api-health-alert`                                         |
   | **Health checks** | 勾选上一步的 `yiveno-api-health`                                  |
   | **Trigger**       | **转为运行不正常（Unhealthy）**（可选再加 Healthy，恢复时也通知） |
   | **Destination**   | 你的邮箱（如账户主邮箱）                                          |

4. **下一步** → 勾选 A 步创建的 `yiveno-api-health`（或勾选「包括未来运行状况检查」）→ **创建** → **Test** 确认能收到测试邮件。
5. （可选）**Notifications → Destinations → Webhooks**：接 Slack / 飞书等；Health Check 告警里选该 Webhook。

**权限：** 需账户 **Administrator**（或能管理 Notifications 的角色）。

**Free 档：** 无法创建 Health Check → B 无法完成；**C 为当前可用探活方案**。

##### C. GitHub Actions 探活（仓库已配，你只需开通知）

1. 将含 [`.github/workflows/api-health.yml`](../.github/workflows/api-health.yml) 的改动 **merge 到 `main`**。
2. GitHub 仓库 → **Actions** → **API Health** → **Run workflow** 手动跑一次，确认绿。
3. GitHub → **Settings → Notifications**（个人账号）→ 勾选 **Actions** 失败邮件；或仓库 **Watch → Custom → Failed workflows**。
4. 之后每 **15 分钟**自动探活；失败 workflow 变红。

##### D. （可选）Worker 错误 / 用量告警

与 Health Check 互补：API 仍 200 但 **5xx 比例高** 时 Health Check 可能不报。

1. Dashboard → **Notifications** → **Add**。
2. 在列表里找与 **Workers** 相关的项（名称因账户/plan 略有不同，如 error rate、usage）。
3. 选 Worker **`yiveno-production`**（`wrangler deploy --env production` 部署名）。
4. 阈值先保守（例如错误率突增），目的地同邮箱或 Webhook。
5. **Create** + **Test**。

##### E. 其它（CF 管不到，故障时对照）

| 系统            | Dashboard 入口                                | 何时看         |
| --------------- | --------------------------------------------- | -------------- |
| **Worker 日志** | Workers → `yiveno-production` → Observability | 收到告警后     |
| **AI Gateway**  | AI → AI Gateway → `yiveno` → Logs             | 仅 AI/线索失败 |
| **Supabase**    | 项目 → Logs / Database                        | 同步/Auth 失败 |
| **Dodo**        | Webhooks 投递记录                             | Pro/计费异常   |

##### F. 做完后的自检清单

- [ ] `curl https://api.yiveno.com/api/health` → 200 + `status: ok`
- [ ] CF Health Check 显示 **Healthy**
- [ ] Notifications **Test** 邮件收到
- [ ] GitHub **API Health** workflow 手动跑通
- [ ] 已执行 `cd backend && bun run deploy`（让 **25% 生产 log 采样** 生效）
- [ ] 知道排障入口：`bunx wrangler tail --env production`（见上文「看日志」）

**官方文档：**

- [Health Checks notifications](https://developers.cloudflare.com/health-checks/how-to/health-checks-notifications/)
- [Configure Cloudflare Notifications](https://developers.cloudflare.com/notifications/get-started/)

线索代理示例：

```bash
curl -X POST http://localhost:8787/api/ai/clue/complete \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"ping"}],"maxTokens":16}'
```

需要 Worker Secret：`DEEPSEEK_API_KEY`（本地在 `.dev.vars`，由 `env:sync` 从 `.env.shared.local` 写入）。

### Dodo 订阅投影（§A.3.2）

- **计费真相**：Dodo Payments；**权益投影**：`subscriptions`（含 `source` / `last_verified_at` / `verification_status`）
- **Webhook**：`POST /api/webhooks/dodo`，校验 Standard Webhooks；假 ID / 缺 `metadata.yiveno_user_id` 不授 Pro；入站写入 `billing_events`；欢迎信已接线，须 Workers Paid 才实际发出（失败不 5xx）
- **Refresh**：`GET /api/account/subscription` 与官网 subscription **强制对账**（`DODO_PAYMENTS_API_KEY` → Subscriptions API）；Dodo 非 `active` **立刻降级**（含 `on_hold`）
- **门禁**：云同步要求 24h 内 `verified`；API 故障 grace 48h；Cron `7 * * * *` 扫过期 active
- 环境与清单：`docs/ENVIRONMENT.md`；规范：产品文档 §A.3.2；运维笔记：`docs/billing.md`

### 可插拔 Provider（AiChatProvider）

`/api/ai/clue/complete`、`/api/ai/enrichment/complete` 与 `/api/ai/hosted/complete` 经 `resolveAiChatProvider(env)` 调用上游：

- 默认 `AI_PROVIDER=deepseek`（或未设置）→ `deepseekAiChatProvider`
- 换厂商：新增 adapter 实现 `AiChatProvider`，在 `resolveAiChatProvider` 注册，再改 env
- 未配置对应 Secret → `503 ai_provider_not_configured`；未知 provider → `503 ai_provider_unsupported`

### AI Gateway（DeepSeek 观测中间层）

线索 / 托管补全默认经 Cloudflare AI Gateway 转发 DeepSeek：

```text
Worker → gateway.ai.cloudflare.com/v1/{account}/{gateway}/deepseek → DeepSeek
```

1. 打开 [AI Gateway](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway)，创建名为 **`yiveno`** 的 Gateway（与 `wrangler.toml` 里 `AI_GATEWAY_ID` 一致）。
2. Account ID 已写入 `AI_GATEWAY_ACCOUNT_ID`（当前账户）。
3. **鉴权（二选一）**
   - **推荐本地/早期：** Gateway Settings 里关闭 **Authenticated Gateway**（否则未带 CF token 会 401）。
   - **或：** 开启鉴权后，在 Settings 创建 Run token，写入 Secret / `.dev.vars` 的 `AI_GATEWAY_TOKEN`（请求头 `cf-aig-authorization`）。`DEEPSEEK_API_KEY` 仍走 `Authorization`。
4. 部署或 `wrangler dev` 后，在 Gateway **Logs / Analytics** 查看请求。
5. 若暂时要直连 DeepSeek：清空 `AI_GATEWAY_ID`（或两个 Gateway 变量），回退 `DEEPSEEK_API_BASE`。
6. 未配 `AI_GATEWAY_TOKEN` 且 Gateway 返回 401 时，Worker **会回退直连 DeepSeek**（线索理解不整段挂死；观测层暂失效）。

Gateway 核心功能免费；DeepSeek token 费用仍按 DeepSeek 账单。

## 配置要点

- [`wrangler.toml`](./wrangler.toml)：`[env.production]` 含 `api.yiveno.com` custom domain、KV `AI_USAGE_KV`、vars；**生产日志采样 25%**（见 `[env.production.observability]`）
- Secrets：`DEEPSEEK_API_KEY`、`DODO_PAYMENTS_API_KEY`、`DODO_PAYMENTS_WEBHOOK_KEY`、Dodo Product ID（及 JWT / OAuth）
- Vars：`AI_GATEWAY_ACCOUNT_ID` / `AI_GATEWAY_ID`（见上节）；`AI_HOSTED_MODEL` / `DEEPSEEK_API_BASE` 等
- 环境变量规范见仓库 [`docs/ENVIRONMENT.md`](../docs/ENVIRONMENT.md)
- 探活 / 排障见上文「可观测与故障排查」；采样变更需 **`bun run deploy`**（`--env production`）后生效

## 已移除（勿再文档化）

- 书签任务 / URL 检测 / 智能分类（v3）
- 无鉴权 Workers AI `/api/ai/complete`
- tRPC `/trpc`（官网分享已用 REST）
