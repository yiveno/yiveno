# Yiveno Backend（Cloudflare Worker）

v4 后端：扩展线索理解代理 + 官网只读 API。本地事实源在扩展 IndexedDB；本 Worker **不是**书签分类/URL 检测服务。

## 真实调用面

| 方法 | 路径                          | 调用方      | 说明                                                       |
| ---- | ----------------------------- | ----------- | ---------------------------------------------------------- |
| GET  | `/health`、`/api/health`      | 运维        | 健康检查                                                   |
| POST | `/api/ai/clue/complete`       | Chrome 扩展 | M1 线索理解（AI Gateway → DeepSeek + IP 日配额）           |
| POST | `/api/ai/enrichment/complete` | Chrome 扩展 | Capture enrichment 结构化提议（扩展 merge 后写 IndexedDB） |
| GET  | `/api/website/subscription`   | 官网        | 订阅只读查询                                               |

生产域名：`https://api.yiveno.com`（Worker Custom Domain → `yiveno-production`）。

### Phase C / Pro 预留（当前无客户端）

| 前缀               | 说明                                            |
| ------------------ | ----------------------------------------------- |
| `/api/ai/hosted/*` | Pro 托管 LLM（Supabase Bearer + Pro）           |
| `/api/auth/*`      | 旧 OAuth 辅助；官网登录走 Supabase 直连         |
| `/api/gumroad/*`   | 订阅查询（JWT）+ webhook（seller 校验，无 JWT） |
| `/api/admin/*`     | 环境变量自检（JWT）                             |

## 本地开发

```bash
# 根目录同步 env → backend/.dev.vars
bun run env:sync:dev

cd backend
bun run dev          # wrangler dev --local --port 8787
bun test             # 单测
bun run deploy       # wrangler deploy --env production
```

健康检查：

```bash
curl http://localhost:8787/api/health
curl https://api.yiveno.com/api/health
```

线索代理示例：

```bash
curl -X POST http://localhost:8787/api/ai/clue/complete \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"ping"}],"maxTokens":16}'
```

需要 Worker Secret：`DEEPSEEK_API_KEY`（本地在 `.dev.vars`，由 `env:sync` 从 `.env.shared.local` 写入）。

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

- [`wrangler.toml`](./wrangler.toml)：`[env.production]` 含 `api.yiveno.com` custom domain、KV `AI_USAGE_KV`、vars
- Secrets：`DEEPSEEK_API_KEY`（及后续 JWT / OAuth / Gumroad 等）
- Vars：`AI_GATEWAY_ACCOUNT_ID` / `AI_GATEWAY_ID`（见上节）；`AI_HOSTED_MODEL` / `DEEPSEEK_API_BASE` 等
- 环境变量规范见仓库 [`docs/ENVIRONMENT.md`](../docs/ENVIRONMENT.md)

## 已移除（勿再文档化）

- 书签任务 / URL 检测 / 智能分类（v3）
- 无鉴权 Workers AI `/api/ai/complete`
- tRPC `/trpc`（官网分享已用 REST）
