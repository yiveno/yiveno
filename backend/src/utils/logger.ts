/**
 * 结构化日志工具
 *
 * 用于在 Cloudflare Workers 中记录结构化日志，便于在 Dashboard 中查询和分析
 */

/**
 * 日志级别
 */
export enum LogLevel {
  /** 调试 */
  DEBUG = 'DEBUG',
  /** 信息 */
  INFO = 'INFO',
  /** 警告 */
  WARN = 'WARN',
  /** 错误 */
  ERROR = 'ERROR'
}

const TEST_LOG_OVERRIDE_ENV = 'BACKEND_TEST_LOGS'

/**
 * 日志条目接口
 */
interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  [key: string]: LogValue
}

type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | { [key: string]: LogValue }
type LogData = Record<string, LogValue>

function isTestEnv(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
}

function shouldEmitLogs(): boolean {
  if (!isTestEnv()) return true
  return typeof process !== 'undefined' && process.env[TEST_LOG_OVERRIDE_ENV] === '1'
}

export function toLogError(err: unknown): string {
  if (err instanceof Error) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * 记录结构化日志
 *
 * @param level - 日志级别
 * @param message - 日志消息
 * @param data - 附加数据
 */
export function log(level: LogLevel, message: string, data?: LogData): void {
  if (!shouldEmitLogs()) return

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }

  // 根据级别选择输出方式
  switch (level) {
    case LogLevel.ERROR:
      console.error(JSON.stringify(logEntry))
      break
    case LogLevel.WARN:
      console.warn(JSON.stringify(logEntry))
      break
    default:
      console.warn(JSON.stringify(logEntry))
  }
}

/**
 * 记录 INFO 级别日志
 */
export function info(message: string, data?: LogData): void {
  log(LogLevel.INFO, message, data)
}

/**
 * 记录 WARN 级别日志
 */
export function warn(message: string, data?: LogData): void {
  log(LogLevel.WARN, message, data)
}

/**
 * 记录 ERROR 级别日志
 */
export function error(message: string, data?: LogData): void {
  log(LogLevel.ERROR, message, data)
}

/**
 * 记录请求信息
 *
 * @param request - HTTP 请求对象
 * @param additionalData - 附加数据
 */
export function logRequest(request: Request, additionalData?: LogData): void {
  const url = new URL(request.url)

  info('收到请求', {
    method: request.method,
    path: url.pathname,
    query: url.search,
    userAgent: request.headers.get('user-agent'),
    ...additionalData
  })
}

/**
 * 记录响应信息
 *
 * @param request - HTTP 请求对象
 * @param response - HTTP 响应对象
 * @param duration - 请求处理时长（毫秒）
 */
export function logResponse(
  request: Request,
  response: Response,
  duration: number,
  additionalData?: LogData
): void {
  const url = new URL(request.url)

  info('请求完成', {
    method: request.method,
    path: url.pathname,
    status: response.status,
    duration,
    ...additionalData
  })
}

/**
 * 记录错误信息
 *
 * @param err - 错误对象
 * @param context - 错误上下文
 */
export function logError(err: unknown, context?: LogData): void {
  const errorMessage = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  error('发生错误', {
    error: errorMessage,
    stack,
    ...context
  })
}
