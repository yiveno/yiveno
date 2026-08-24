/** Service Worker 与页面均可使用的轻量日志接口。 */
type LogData = unknown

/**
 * 生产构建默认不打 info/debug（热路径会刷屏且动态 `console[level]` 躲过 terser drop）。
 * warn/error 始终保留。开发构建（`import.meta.env.DEV`）全开。
 */
const ENABLE_VERBOSE_LOG = import.meta.env.DEV

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
  scope: string,
  message: string,
  data?: LogData
): void {
  if (!ENABLE_VERBOSE_LOG && (level === 'debug' || level === 'info')) {
    return
  }
  let line = message
  if (level === 'error' && data !== undefined) {
    const detail = summarizeLogError(data)
    if (detail) {
      line = `${message} — ${detail}`
    }
  }
  const prefix = `[Yiveno:${scope}] ${line}`
  if (data === undefined) {
    console[level](prefix)
    return
  }
  console[level](prefix, data)
}

export const logger = {
  debug: (scope: string, message: string, data?: LogData) => write('debug', scope, message, data),
  info: (scope: string, message: string, data?: LogData) => write('info', scope, message, data),
  warn: (scope: string, message: string, data?: LogData) => write('warn', scope, message, data),
  error: (scope: string, message: string, data?: LogData) => write('error', scope, message, data)
}
