/** Service Worker 与页面均可使用的轻量日志接口。 */
type LogData = unknown

/**
 * 生产构建默认不打 info/debug（热路径会刷屏且动态 `console[level]` 躲过 terser drop）。
 * warn/error 始终保留。开发构建（`import.meta.env.DEV`）全开。
 */
const ENABLE_VERBOSE_LOG = import.meta.env.DEV

function write(
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: string,
  message: string,
  data?: LogData
): void {
  if (!ENABLE_VERBOSE_LOG && (level === 'debug' || level === 'info')) {
    return
  }
  const prefix = `[Yiveno:${scope}] ${message}`
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
