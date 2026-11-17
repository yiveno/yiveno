/**
 * 线索 LLM 理解失败原因（闭集；UI 文案按 kind 分流）。
 * 分类只看结构化信息（HTTP 状态、Worker `error` 字段、异常 `name`），禁止字符串嗅探。
 */

/** 线索 LLM 理解失败原因闭集。 */
export type ClueLlmFailureKind =
  | 'quota_monthly' // 本月配额用完（429 + quota_exceeded）
  | 'quota_daily' // 当日软盖用完（429 + daily_cap_exceeded）
  | 'timeout' // 12 秒超时（AbortSignal TimeoutError / AbortError）
  | 'network' // fetch 抛错（连不上 Worker / 断网）
  | 'auth' // 无 token 或 401（登录过期/缺失）
  | 'provider_error' // Worker 500 hosted_complete_failed
  | 'not_configured' // Worker 503 ai_provider_not_configured / kv_not_configured
  | 'empty_response' // 200 但无 text
  | 'unknown' // 以上都不是（最后手段；必须记日志）

/** 配额快照（仅 quota_* kind 有值；数字来自 Worker 响应）。 */
export type ClueLlmFailureQuotaSnapshot = {
  used: number
  limit: number
  dailyUsed: number
  dailyLimit: number
}

/** 分类函数的结构化输入（不许用 message 文案嗅探）。 */
export type ClassifyClueLlmFailureInput = {
  /** HTTP 状态码；fetch 抛错时可为 undefined。 */
  status?: number
  /** Worker JSON 的 `error` 字段（精确相等比较）。 */
  workerError?: string
  /** 异常 `name`（TimeoutError / AbortError 等）。 */
  errorName?: string
  /** 已知语义捷径：无 token / 空 text。 */
  known?: 'missing_auth' | 'empty_response'
}

/** Worker 未配置类 error 字段。 */
const NOT_CONFIGURED_ERRORS = new Set(['ai_provider_not_configured', 'kv_not_configured'])

/**
 * 将结构化失败信息分类为 ClueLlmFailureKind。
 * 仅做 status / workerError / errorName / known 的精确分支，禁止 message.includes。
 */
export function classifyClueLlmFailure(input: ClassifyClueLlmFailureInput): ClueLlmFailureKind {
  if (input.known === 'missing_auth') {
    return 'auth'
  }
  if (input.known === 'empty_response') {
    return 'empty_response'
  }

  const errorName = input.errorName
  if (errorName === 'TimeoutError' || errorName === 'AbortError') {
    return 'timeout'
  }

  const status = input.status
  if (status === undefined) {
    // 无 HTTP 状态：非超时已在上方返回；其余 unknown。
    // fetch 网络失败由 hosted client 显式抛 HostedCompleteError('network')，不经本分支猜。
    return 'unknown'
  }

  const workerError = input.workerError
  if (status === 429) {
    if (workerError === 'quota_exceeded') {
      return 'quota_monthly'
    }
    if (workerError === 'daily_cap_exceeded') {
      return 'quota_daily'
    }
    return 'unknown'
  }
  if (status === 401) {
    return 'auth'
  }
  if (status === 503 && workerError && NOT_CONFIGURED_ERRORS.has(workerError)) {
    return 'not_configured'
  }
  if (status === 500) {
    return 'provider_error'
  }
  return 'unknown'
}

/**
 * 托管补全失败（带 kind；供 understand 层透传到 UI）。
 * message 仅供日志；UI 只读 kind / quota。
 */
export class HostedCompleteError extends Error {
  readonly kind: ClueLlmFailureKind
  readonly status?: number
  readonly quota?: ClueLlmFailureQuotaSnapshot

  constructor(
    kind: ClueLlmFailureKind,
    message: string,
    options?: { status?: number; quota?: ClueLlmFailureQuotaSnapshot }
  ) {
    super(message)
    this.name = 'HostedCompleteError'
    this.kind = kind
    if (options?.status !== undefined) {
      this.status = options.status
    }
    if (options?.quota !== undefined) {
      this.quota = options.quota
    }
  }
}

/**
 * 从任意抛错取出失败 kind（hosted typed → 其 kind；超时名 → timeout；其余 unknown）。
 */
export function resolveClueLlmFailureKindFromError(error: unknown): ClueLlmFailureKind {
  if (error instanceof HostedCompleteError) {
    return error.kind
  }
  if (error instanceof Error) {
    return classifyClueLlmFailure({ errorName: error.name })
  }
  return 'unknown'
}

/** 仅 HostedCompleteError 且为配额类时返回快照。 */
export function resolveClueLlmFailureQuotaFromError(
  error: unknown
): ClueLlmFailureQuotaSnapshot | undefined {
  if (!(error instanceof HostedCompleteError)) {
    return undefined
  }
  if (error.kind !== 'quota_monthly' && error.kind !== 'quota_daily') {
    return undefined
  }
  return error.quota
}
