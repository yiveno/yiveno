/**
 * AI 上游调用结构化错误（Batch 1）。
 *
 * 供路由层机器判读：kind / status / vendorCode / retryAfterMs / 限额头子集。
 * details 与 headers 经脱敏；message = causeMessage（保留既有归因文案可断言）。
 */

/** 错误分类（路由 / 账本后续批次消费）。 */
export type AiProviderErrorKind =
  | 'rate_limit_minute' // 分钟级限流（429 默认）
  | 'quota_exhausted_daily' // 日额度耗尽（429 + 日配额语义）
  | 'payment_required' // 402 或余额不足
  | 'auth_failed' // 401 / 403
  | 'upstream_5xx' // 上游 5xx
  | 'timeout' // 408 / AbortError / 超时文案
  | 'network' // fetch 网络失败（非 Abort）
  | 'invalid_response' // 2xx 但 JSON/结构不符
  | 'empty_response' // 2xx 但无文本
  | 'misconfigured' // 缺 key / Gateway / 前缀非法 / 未知 provider
  | 'unknown' // 其余

/** 脱敏后保留的限额响应头子集（小写键）。 */
export type AiProviderRateLimitHeaders = {
  'retry-after'?: string
  'x-ratelimit-remaining-requests'?: string
  'x-ratelimit-remaining-tokens'?: string
  'x-ratelimit-reset-requests'?: string
  'x-ratelimit-reset-tokens'?: string
}

const RATE_LIMIT_HEADER_KEYS = [
  'retry-after',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-requests',
  'x-ratelimit-reset-tokens'
] as const

/** details 序列化后最大字符数（截断防日志爆）。 */
const DETAILS_MAX_CHARS = 1200

/** 疑似密钥 / 正文的键名或值模式（脱敏）。 */
const SENSITIVE_KEY_RE =
  /^(authorization|api[_-]?key|x-api-key|token|secret|password|prompt|content|messages|input)$/i
const SENSITIVE_VALUE_RE =
  /\b(sk-[a-zA-Z0-9_-]{8,}|Bearer\s+[^\s]+|AIza[0-9A-Za-z_-]{10,}|gsk_[a-zA-Z0-9]{8,})\b/i

export type AiProviderErrorInit = {
  kind: AiProviderErrorKind
  providerId: string
  /** compat 时为厂商前缀（deepseek / openai / google-ai-studio / groq） */
  vendor?: string
  model?: string
  status?: number
  /** 厂商错误码，统一 string */
  vendorCode?: string
  retryAfterMs?: number
  rateLimitHeaders?: AiProviderRateLimitHeaders
  /** 脱敏后的厂商错误 details */
  details?: unknown
  /** 原始归因文案；同时作为 Error.message */
  causeMessage: string
}

export class AiProviderError extends Error {
  readonly kind: AiProviderErrorKind
  readonly providerId: string
  readonly vendor?: string
  readonly model?: string
  readonly status?: number
  readonly vendorCode?: string
  readonly retryAfterMs?: number
  readonly rateLimitHeaders?: AiProviderRateLimitHeaders
  readonly details?: unknown
  readonly causeMessage: string

  constructor(init: AiProviderErrorInit) {
    super(init.causeMessage)
    this.name = 'AiProviderError'
    this.kind = init.kind
    this.providerId = init.providerId
    this.causeMessage = init.causeMessage
    if (init.vendor !== undefined) this.vendor = init.vendor
    if (init.model !== undefined) this.model = init.model
    if (init.status !== undefined) this.status = init.status
    if (init.vendorCode !== undefined) this.vendorCode = init.vendorCode
    if (init.retryAfterMs !== undefined) this.retryAfterMs = init.retryAfterMs
    if (init.rateLimitHeaders !== undefined) this.rateLimitHeaders = init.rateLimitHeaders
    if (init.details !== undefined) this.details = init.details
  }
}

export type ClassifyAiProviderErrorInput = {
  status?: number
  vendorCode?: string | number | null
  message?: string
  details?: unknown
  headers?: Headers | Record<string, string | undefined> | null
  /** 显式覆盖：empty / invalid / misconfigured / network / timeout */
  forcedKind?: AiProviderErrorKind
}

/**
 * 纯函数：由 HTTP status + 厂商码/文案/details 判定 kind。
 */
export function classifyAiProviderError(input: ClassifyAiProviderErrorInput): AiProviderErrorKind {
  if (input.forcedKind) return input.forcedKind

  const status = input.status
  const code = normalizeVendorCode(input.vendorCode)
  const message = (input.message ?? '').toLowerCase()
  const detailsBlob = stringifyForClassify(input.details).toLowerCase()
  const blob = `${code} ${message} ${detailsBlob}`

  if (status === 402 || isPaymentRequiredBlob(blob)) {
    return 'payment_required'
  }
  if (status === 401 || status === 403) {
    return 'auth_failed'
  }
  if (status === 408 || isTimeoutBlob(blob)) {
    return 'timeout'
  }
  if (status === 429) {
    if (isDailyQuotaBlob(blob)) return 'quota_exhausted_daily'
    return 'rate_limit_minute'
  }
  if (status !== undefined && status >= 500 && status <= 599) {
    return 'upstream_5xx'
  }
  return 'unknown'
}

/**
 * 解析 Retry-After：优先响应头（秒或 HTTP 日期），其次 details 内 retryDelay（如 `21s`）。
 */
export function parseRetryAfterMs(
  headers?: Headers | Record<string, string | undefined> | null,
  details?: unknown
): number | undefined {
  const headerValue = getHeaderIgnoreCase(headers, 'retry-after')
  if (headerValue) {
    const fromHeader = parseRetryAfterHeaderValue(headerValue)
    if (fromHeader !== undefined) return fromHeader
  }
  return parseRetryDelayFromDetails(details)
}

/** 从 Headers 抽取脱敏限额头子集；全空则 undefined。 */
export function pickRateLimitHeaders(
  headers?: Headers | Record<string, string | undefined> | null
): AiProviderRateLimitHeaders | undefined {
  if (!headers) return undefined
  const out: AiProviderRateLimitHeaders = {}
  let any = false
  for (const key of RATE_LIMIT_HEADER_KEYS) {
    const value = getHeaderIgnoreCase(headers, key)?.trim()
    if (!value) continue
    if (SENSITIVE_VALUE_RE.test(value)) continue
    out[key] = value.slice(0, 128)
    any = true
  }
  return any ? out : undefined
}

/**
 * 脱敏 details：去掉疑似 key / Authorization / prompt 正文；超长截断。
 */
export function sanitizeAiProviderDetails(details: unknown): unknown {
  if (details === undefined || details === null) return undefined
  const cleaned = sanitizeNode(details, 0)
  if (cleaned === undefined) return undefined
  const serialized = safeJsonStringify(cleaned)
  if (serialized.length <= DETAILS_MAX_CHARS) return cleaned
  return { truncated: true, preview: serialized.slice(0, DETAILS_MAX_CHARS) }
}

/** 厂商码统一为 string；空则 undefined。 */
export function normalizeVendorCode(code: string | number | null | undefined): string | undefined {
  if (code === null || code === undefined) return undefined
  const s = String(code).trim()
  return s.length > 0 ? s : undefined
}

/** fetch 失败 → timeout（Abort）或 network。 */
export function classifyFetchFailure(err: unknown): 'timeout' | 'network' {
  if (isAbortLike(err)) return 'timeout'
  const msg = err instanceof Error ? err.message : String(err)
  if (isTimeoutBlob(msg.toLowerCase())) return 'timeout'
  return 'network'
}

function isAbortLike(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String((err as { name?: unknown }).name) : ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError' || err.name === 'TimeoutError'
  }
  return false
}

function isPaymentRequiredBlob(blob: string): boolean {
  return (
    /\bpayment[_\s-]?required\b/.test(blob) ||
    /\binsufficient[_\s-]?(quota|balance|funds|credits)\b/.test(blob) ||
    /\bbalance[_\s-]?not[_\s-]?enough\b/.test(blob) ||
    /\barrear/.test(blob) ||
    /\b欠费\b/.test(blob) ||
    /\b余额不足\b/.test(blob)
  )
}

function isDailyQuotaBlob(blob: string): boolean {
  return (
    /\bquota[_\s-]?exceeded\b/.test(blob) ||
    /\bdaily\b/.test(blob) ||
    /\bper[_\s-]?day\b/.test(blob) ||
    /\brpd\b/.test(blob) ||
    /\btpd\b/.test(blob) ||
    /\bgenerate_requests_per_day\b/.test(blob) ||
    /\brequests_per_day\b/.test(blob) ||
    /\btokens_per_day\b/.test(blob)
  )
}

function isTimeoutBlob(blob: string): boolean {
  return (
    /\btimeout\b/.test(blob) ||
    /\btimed?\s*out\b/.test(blob) ||
    /\baborted?\b/.test(blob) ||
    /\bdeadline[_\s-]?exceeded\b/.test(blob)
  )
}

function parseRetryAfterHeaderValue(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed)
    if (!Number.isFinite(seconds) || seconds < 0) return undefined
    return Math.round(seconds * 1000)
  }
  const dateMs = Date.parse(trimmed)
  if (!Number.isFinite(dateMs)) return undefined
  const delta = dateMs - Date.now()
  return delta > 0 ? delta : 0
}

function parseRetryDelayFromDetails(details: unknown): number | undefined {
  if (details === undefined || details === null) return undefined
  const found = findRetryDelayString(details, 0)
  if (!found) return undefined
  return parseDurationToMs(found)
}

function findRetryDelayString(node: unknown, depth: number): string | undefined {
  if (depth > 8 || node === undefined || node === null) return undefined
  if (typeof node === 'string') {
    if (/retryDelay/i.test(node) && /\d/.test(node)) return node
    return undefined
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findRetryDelayString(item, depth + 1)
      if (hit) return hit
    }
    return undefined
  }
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    for (const [key, value] of Object.entries(record)) {
      if (/retryDelay/i.test(key) && (typeof value === 'string' || typeof value === 'number')) {
        return String(value)
      }
      const hit = findRetryDelayString(value, depth + 1)
      if (hit) return hit
    }
  }
  return undefined
}

/** 解析 `21s` / `1.5s` / `500ms` / 纯数字秒。 */
function parseDurationToMs(raw: string): number | undefined {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/i)
  if (!match) return undefined
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 0) return undefined
  const unit = (match[2] ?? 's').toLowerCase()
  if (unit === 'ms') return Math.round(amount)
  if (unit === 'm') return Math.round(amount * 60_000)
  return Math.round(amount * 1000)
}

function getHeaderIgnoreCase(
  headers: Headers | Record<string, string | undefined> | null | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined
  }
  const record = headers as Record<string, string | undefined>
  const direct = record[name] ?? record[name.toLowerCase()]
  if (direct !== undefined) return direct
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

function sanitizeNode(node: unknown, depth: number): unknown {
  if (depth > 8) return undefined
  if (node === null || node === undefined) return node
  if (typeof node === 'string') {
    if (SENSITIVE_VALUE_RE.test(node)) return '[redacted]'
    if (node.length > 400) return `${node.slice(0, 400)}…`
    return node
  }
  if (typeof node === 'number' || typeof node === 'boolean') return node
  if (Array.isArray(node)) {
    return node
      .slice(0, 20)
      .map(item => sanitizeNode(item, depth + 1))
      .filter(item => item !== undefined)
  }
  if (typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(key)) continue
      const cleaned = sanitizeNode(value, depth + 1)
      if (cleaned !== undefined) out[key] = cleaned
    }
    return out
  }
  return undefined
}

function stringifyForClassify(details: unknown): string {
  if (details === undefined || details === null) return ''
  if (typeof details === 'string') return details
  return safeJsonStringify(details)
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}
