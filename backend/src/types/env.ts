/**
 * Worker 环境变量类型。
 *
 * 绑定与已知 Secret/vars 由 `wrangler types` 生成（见 `worker-configuration.d.ts` 的 Cloudflare.Env）。
 * 此处只补充未写入 wrangler.toml / .dev.vars、但代码可选读取的键。
 *
 * 变更 wrangler.toml 或 .dev.vars 后请运行：`bun run types:gen`
 */

/** wrangler 生成的绑定 + 本地可选覆盖键 */
export type Env = Cloudflare.Env & {
  /** 本地兜底 JWT secret（优先 JWT_SECRET） */
  SECRET?: string
  NODE_ENV?: string
  /** 旧名 allowlist，兼容读取 */
  REDIRECT_ALLOWLIST?: string
  AUTH_GOOGLE_AUTH_URL?: string
  AUTH_GOOGLE_TOKEN_URL?: string
  AUTH_GOOGLE_USERINFO_URL?: string
  AUTH_MICROSOFT_AUTH_URL?: string
  AUTH_MICROSOFT_TOKEN_URL?: string
  AUTH_MICROSOFT_USERINFO_URL?: string
  /** M1 线索代理开关；"false" 关闭 */
  AI_CLUE_PROXY_ENABLED?: string
  /** 线索理解按 IP 日调用上限 */
  AI_CLUE_DAILY_LIMIT?: string
  /**
   * AI Gateway Authenticated Gateway 的 Run token。
   * 写入请求头 `cf-aig-authorization`；未配置且 Gateway 开鉴权时会 401（客户端将回退直连）。
   */
  AI_GATEWAY_TOKEN?: string
}
