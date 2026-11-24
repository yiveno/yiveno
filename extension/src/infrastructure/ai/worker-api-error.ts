/**
 * Worker API 结构化错误：message 保持裸错误码（熔断 / auth 匹配不断），
 * 细化原因放独立字段供日志首行展示。
 */

export type WorkerApiErrorQuotaFields = {
  tier?: string
  used?: number
  limit?: number
  remaining?: number
  dailyUsed?: number
  dailyLimit?: number
  dailyRemaining?: number
}

export type WorkerApiErrorOptions = {
  status?: number
  detail?: string
  /** Worker 响应 body.cause（如 embed_failed 子因） */
  cause?: string
  reason?: string
  requestId?: string
} & WorkerApiErrorQuotaFields

export class WorkerApiError extends Error {
  readonly code: string
  readonly status?: number
  /** 紧凑中文摘要，供 chrome://extensions 错误页首行 */
  readonly detail?: string
  /** Worker 响应 body.cause；覆盖 Error.cause 语义为本仓字符串子因 */
  override readonly cause?: string
  readonly reason?: string
  readonly requestId?: string
  readonly tier?: string
  readonly used?: number
  readonly limit?: number
  readonly remaining?: number
  readonly dailyUsed?: number
  readonly dailyLimit?: number
  readonly dailyRemaining?: number

  constructor(code: string, options: WorkerApiErrorOptions = {}) {
    super(code)
    this.name = 'WorkerApiError'
    this.code = code
    if (options.status !== undefined) this.status = options.status
    if (options.detail !== undefined) this.detail = options.detail
    if (options.cause !== undefined) this.cause = options.cause
    if (options.reason !== undefined) this.reason = options.reason
    if (options.requestId !== undefined) this.requestId = options.requestId
    if (options.tier !== undefined) this.tier = options.tier
    if (options.used !== undefined) this.used = options.used
    if (options.limit !== undefined) this.limit = options.limit
    if (options.remaining !== undefined) this.remaining = options.remaining
    if (options.dailyUsed !== undefined) this.dailyUsed = options.dailyUsed
    if (options.dailyLimit !== undefined) this.dailyLimit = options.dailyLimit
    if (options.dailyRemaining !== undefined) this.dailyRemaining = options.dailyRemaining
  }
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readQuotaFields(record: Record<string, unknown>): WorkerApiErrorQuotaFields {
  const out: WorkerApiErrorQuotaFields = {}
  const tier = readOptionalString(record, 'tier')
  if (tier !== undefined) out.tier = tier
  const used = readOptionalNumber(record, 'used')
  if (used !== undefined) out.used = used
  const limit = readOptionalNumber(record, 'limit')
  if (limit !== undefined) out.limit = limit
  const remaining = readOptionalNumber(record, 'remaining')
  if (remaining !== undefined) out.remaining = remaining
  const dailyUsed = readOptionalNumber(record, 'dailyUsed')
  if (dailyUsed !== undefined) out.dailyUsed = dailyUsed
  const dailyLimit = readOptionalNumber(record, 'dailyLimit')
  if (dailyLimit !== undefined) out.dailyLimit = dailyLimit
  const dailyRemaining = readOptionalNumber(record, 'dailyRemaining')
  if (dailyRemaining !== undefined) out.dailyRemaining = dailyRemaining
  return out
}

/**
 * 生成紧凑中文 detail（开发者日志用；不走 i18n）。
 * 不含「搜索」/ Search。
 */
export function buildWorkerApiErrorDetail(input: {
  code: string
  cause?: string
  reason?: string
  requestId?: string
  tier?: string
  used?: number
  limit?: number
}): string | undefined {
  const { code, cause, reason, requestId, tier, used, limit } = input

  if (code === 'quota_exceeded') {
    const usedText = used !== undefined && limit !== undefined ? `${used}/${limit}` : undefined
    if (tier === 'anonymous') {
      return usedText ? `匿名，终身 ${usedText}，登录后恢复` : '匿名，终身配额已用尽，登录后恢复'
    }
    if (tier === 'free' || tier === 'pro') {
      return usedText
        ? `${tier}，今日 ${usedText}，UTC 午夜重置`
        : `${tier}，今日配额已用尽，UTC 午夜重置`
    }
    return usedText ? `今日 ${usedText}，UTC 午夜重置` : '配额已用尽'
  }

  if (code === 'kv_not_configured') {
    return '服务端配额存储未配置'
  }

  if (code === 'embed_failed') {
    if (cause === 'ai_run_failed') return '上游模型调用失败'
    if (cause === 'invalid_ai_response') return '上游返回异常'
    if (cause === 'empty_embedding') return '返回向量为空'
    return undefined
  }

  if (code === 'invalid_token') {
    if (reason === 'revoked') return '设备会话已撤销，请重新登录'
    if (reason === 'unknown') return '设备会话不存在，请重新登录'
    if (reason === 'malformed') return 'token 格式异常'
    if (reason === 'expired') return '登录已过期，请重新登录'
    if (reason === 'invalid') return '登录无效，请重新登录'
    if (reason === 'malformed_response') return '登录无效，请重新登录'
    return undefined
  }

  if (code === 'Internal Server Error') {
    return requestId ? `服务端内部错误，requestId: ${requestId}` : '服务端内部错误'
  }

  return undefined
}

/**
 * 将 Worker !ok 响应解析为 WorkerApiError。
 * requestId：body.requestId 优先，其次响应头 x-request-id。
 */
export function parseWorkerErrorResponse(response: Response, body: unknown): WorkerApiError {
  const record =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  const code =
    record && typeof record.error === 'string' && record.error.trim()
      ? record.error.trim()
      : `http_${response.status}`

  const cause = record ? readOptionalString(record, 'cause') : undefined
  const reason = record ? readOptionalString(record, 'reason') : undefined
  const bodyRequestId = record ? readOptionalString(record, 'requestId') : undefined
  const headerRequestId = response.headers.get('x-request-id')?.trim() || undefined
  const requestId = bodyRequestId || headerRequestId

  const quota =
    code === 'quota_exceeded' || code === 'kv_not_configured' ? readQuotaFields(record ?? {}) : {}

  const detailInput: Parameters<typeof buildWorkerApiErrorDetail>[0] = { code }
  if (cause !== undefined) detailInput.cause = cause
  if (reason !== undefined) detailInput.reason = reason
  if (requestId !== undefined) detailInput.requestId = requestId
  if (quota.tier !== undefined) detailInput.tier = quota.tier
  if (quota.used !== undefined) detailInput.used = quota.used
  if (quota.limit !== undefined) detailInput.limit = quota.limit

  const detail = buildWorkerApiErrorDetail(detailInput)

  const options: WorkerApiErrorOptions = {
    status: response.status,
    ...quota
  }
  if (detail !== undefined) options.detail = detail
  if (cause !== undefined) options.cause = cause
  if (reason !== undefined) options.reason = reason
  if (requestId !== undefined) options.requestId = requestId

  return new WorkerApiError(code, options)
}
