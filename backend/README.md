# Yiveno Backend（Cloudflare Worker）

v4 后端：扩展线索理解代理 + 官网只读 API。本地事实源在扩展 IndexedDB；本 Worker **不是**书签分类/URL 检测服务。

## 真实调用面

| 方法 | 路径                            | 调用方      | 说明                                       |
| ---- | ------------------------------- | ----------- | ------------------------------------------ |
| GET  | `/health`、`/api/health`        | 运维        | 健康检查                                   |
| POST | `/api/ai/clue/complete`         | Chrome 扩展 | M1 线索理解（DeepSeek Secret + IP 日配额） |
| GET  | `/api/website/share/:shortCode` | 官网        | 分享详情                                   |
| GET  | `/api/website/subscription`     | 官网        | 订阅只读查询                               |

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

## 配置要点

- [`wrangler.toml`](./wrangler.toml)：`[env.production]` 含 `api.yiveno.com` custom domain、KV `AI_USAGE_KV`、vars
- Secrets：`DEEPSEEK_API_KEY`（及后续 JWT / OAuth / Gumroad 等）
- 环境变量规范见仓库 [`docs/ENVIRONMENT.md`](../docs/ENVIRONMENT.md)

## 已移除（勿再文档化）

- 书签任务 / URL 检测 / 智能分类（v3）
- 无鉴权 Workers AI `/api/ai/complete`
- tRPC `/trpc`（官网分享已用 REST）
