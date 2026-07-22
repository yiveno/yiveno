/** Service Worker 与页面均可使用的轻量日志接口。 */
type LogData = unknown

function write(
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: string,
  message: string,
  data?: LogData
): void {
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
