import type { LogScope } from '@/infrastructure/logging/log-scopes'

/** Service Worker 与页面均可使用的轻量日志接口。 */
type LogData = unknown

/**
 * 生产构建默认不打 info/debug（热路径会刷屏且动态 `console[level]` 躲过 terser drop）。
 * warn/error 始终保留。开发构建（`import.meta.env.DEV`）全开。
 */
const ENABLE_VERBOSE_LOG = import.meta.env.DEV

/**
 * 本地墙钟（`YYYY-MM-DD HH:mm:ss`），写入 console 首行。
 * chrome://extensions 错误页只展示首行字符串，带时间戳便于对照发生时刻。
 */
export function formatLogTimestamp(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

/**
 * 外部服务原文进日志时加来源标识，避免误判为 Yiveno 自身报错。
 * 例：`[supabase_auth] Request rate limit reached`
 */
export function tagExternalServiceMessage(service: string, detail: string): string {
  const src = service.trim()
  const msg = detail.trim() || 'unknown'
  if (!src) {
    return msg
  }
  const prefix = `[${src}]`
  if (msg.startsWith(prefix)) {
    return msg
  }
  return `${prefix} ${msg}`
}

/**
 * 从第二参数提取可读错误摘要。
 * chrome://extensions 错误页只展示 console 首行字符串；对象第二参会变成 [object Object]。
 */
export function summarizeLogError(data: unknown): string | undefined {
  if (data instanceof Error) {
    const message = data.message.trim()
    return message || data.name || undefined
  }
  if (typeof data === 'string') {
    const trimmed = data.trim()
    return trimmed || undefined
  }
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const record = data as Record<string, unknown>
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim()
  }
  // Auth / API 路径常用 reason 承载外部服务原文（可已带 [supabase_auth] 等前缀）
  if (typeof record.reason === 'string' && record.reason.trim()) {
    return record.reason.trim()
  }
  const nested = record.error
  if (nested instanceof Error) {
    const message = nested.message.trim()
    return message || nested.name || undefined
  }
  if (typeof nested === 'string' && nested.trim()) {
    return nested.trim()
  }
  if (nested && typeof nested === 'object') {
    const nestedRecord = nested as Record<string, unknown>
    if (typeof nestedRecord.message === 'string' && nestedRecord.message.trim()) {
      return nestedRecord.message.trim()
    }
    if (typeof nestedRecord.name === 'string' && nestedRecord.name.trim()) {
      return nestedRecord.name.trim()
    }
  }
  if (typeof record.code === 'string' && record.code.trim()) {
    return record.code.trim()
  }
  return undefined
}

function write(
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: LogScope,
  message: string,
  data?: LogData
): void {
  if (!ENABLE_VERBOSE_LOG && (level === 'debug' || level === 'info')) {
    return
  }
  let line = message
  if ((level === 'error' || level === 'warn') && data !== undefined) {
    const detail = summarizeLogError(data)
    if (detail) {
      line = `${message} — ${detail}`
    }
  }
  const prefix = `[${formatLogTimestamp()}] [Yiveno:${scope}] ${line}`
  // warn/error：只打一行字符串。第二参对象在 chrome://extensions 错误页会变成「… [object Object]」
  if (level === 'error' || level === 'warn') {
    console[level](prefix)
    return
  }
  if (data === undefined) {
    console[level](prefix)
    return
  }
  console[level](prefix, data)
}

export const logger = {
  debug: (scope: LogScope, message: string, data?: LogData) => write('debug', scope, message, data),
  info: (scope: LogScope, message: string, data?: LogData) => write('info', scope, message, data),
  warn: (scope: LogScope, message: string, data?: LogData) => write('warn', scope, message, data),
  error: (scope: LogScope, message: string, data?: LogData) => write('error', scope, message, data)
}
