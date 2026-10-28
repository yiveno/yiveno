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
  /** Capture enrichment 代理开关；"false" 关闭 */
  AI_ENRICHMENT_PROXY_ENABLED?: string
  /** enrichment 提议按 IP 日调用上限（默认 80） */
  AI_ENRICHMENT_DAILY_LIMIT?: string
  /** Getting Started 示意 clue 代理开关；"false" 关闭 */
  AI_GS_CLUE_SAMPLES_PROXY_ENABLED?: string
  /** GS 示意 clue 按 IP 日调用上限（默认 40） */
  AI_GS_CLUE_SAMPLES_DAILY_LIMIT?: string
  /** embedding 按用户日调用上限（Pro，默认 500） */
  AI_EMBED_DAILY_LIMIT?: string
  /** embedding Free 日上限（默认 100） */
  AI_EMBED_FREE_DAILY_LIMIT?: string
  /** 托管 LLM Free 月配额覆盖 */
  AI_HOSTED_FREE_MONTHLY_QUOTA?: string
  /** 托管 LLM Free 日盖 */
  AI_HOSTED_FREE_DAILY_CAP?: string
  /** 托管 LLM Pro 日盖 */
  AI_HOSTED_DAILY_CAP?: string
  /**
   * 任务级模型覆盖（可选 · Phase 1+ 插座；未设则用 AI_HOSTED_MODEL）。
   * 见 docs/architecture/2026-10-任务级模型路由方案.md
   */
  AI_HOSTED_MODEL_NLU?: string
  AI_HOSTED_MODEL_NLG?: string
  AI_HOSTED_MODEL_ENRICHMENT?: string
  AI_HOSTED_MODEL_GS_SAMPLES?: string
  /**
   * 聊天补全 Provider：deepseek（默认）。未知值 → 503 ai_provider_unsupported。
   * 换厂商时加 adapter + 改此变量，业务 handler 不改。
   */
  AI_PROVIDER?: string
  /**
   * AI Gateway Authenticated Gateway 的 Run token。
   * 写入请求头 `cf-aig-authorization`；未配置且 Gateway 开鉴权时会 401（客户端将回退直连）。
   */
  AI_GATEWAY_TOKEN?: string
  /** 定时清理总开关；"false" 关闭。 */
  CLEANUP_SCHEDULED_ENABLED?: string
  /** 每个 owner 保留的 memory_sync_backups 条数。 */
  CLEANUP_MEMORY_SYNC_BACKUPS_KEEP?: string
  /** subscriptions / payment_records 软删保留天数。 */
  CLEANUP_SOFT_DELETE_RETENTION_DAYS?: string
  /** Dodo Payments API key；checkout / 对账；生产必配 */
  DODO_PAYMENTS_API_KEY?: string
  /** Dodo Standard Webhooks signing secret（whsec_…） */
  DODO_PAYMENTS_WEBHOOK_KEY?: string
  /** test_mode | live_mode；缺省按 test_mode */
  DODO_PAYMENTS_ENVIRONMENT?: string
  DODO_PRODUCT_ID_PRO_MONTHLY?: string
  DODO_PRODUCT_ID_PRO_ANNUAL?: string
  DODO_PRODUCT_ID_FOUNDING_MONTHLY?: string
  DODO_PRODUCT_ID_FOUNDING_ANNUAL?: string
  /** "true" 时开放 Founding 套餐 */
  BILLING_FOUNDING_ENABLED?: string
  /** 结构化反馈邮件收件人；须为 Routing 已验证 destination（默认 hi.yiveno@gmail.com） */
  FEEDBACK_TO_EMAIL?: string
  /** 订阅定时对账开关；"false" 关闭 */
  SUBSCRIPTION_RECONCILE_SCHEDULED_ENABLED?: string
  /**
   * 阿里云 DirectMail AccessKey（Pro 欢迎信 SingleSendMail）。
   * 未配则跳过欢迎信，不 5xx webhook。
   */
  ALIYUN_DM_ACCESS_KEY_ID?: string
  ALIYUN_DM_ACCESS_KEY_SECRET?: string
  /** 发信地址；默认 hello@yiveno.com（须在 DirectMail 控制台已创建） */
  ALIYUN_DM_ACCOUNT_NAME?: string
  /** 发件显示名；默认 Yiveno（≤15 字符） */
  ALIYUN_DM_FROM_ALIAS?: string
  /** 回信地址；默认 support@yiveno.com */
  ALIYUN_DM_REPLY_ADDRESS?: string
  /** RegionId；默认 cn-hangzhou */
  ALIYUN_DM_REGION_ID?: string
  /** API 端点；默认 https://dm.aliyuncs.com/ */
  ALIYUN_DM_ENDPOINT?: string
  /**
   * Workers AI binding（wrangler `[ai]`）。
   * 跑 `bun run types:gen` 后也会出现在 Cloudflare.Env；此处作兜底。
   */
  AI?: Ai
  /**
   * Cloudflare Email Sending（wrangler `[[send_email]]`）。
   * 卸载/结构化反馈邮件仍用此绑定；欢迎信已改 DirectMail。
   */
  EMAIL?: SendEmail
}
