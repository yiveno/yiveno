/**
 * 日志系统类型定义。
 */
import type { Timestamp } from '../core/common'
import type { ErrorType, ErrorSeverity } from '../core/error'

/** 日志级别。 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/** Logger 配置项。 */
export interface LoggerConfig {
  /** 输出等级阈值 */
  level: LogLevel
  /** 是否打印到控制台 */
  enableConsole: boolean
  /** 是否发送到远程端点 */
  enableRemote: boolean
  /** 远程日志端点 */
  remoteEndpoint?: string
  /** 内存缓冲区大小 */
  maxBufferSize: number
}

/** 单条日志记录。 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: Timestamp
  /** 日志级别 */
  level: LogLevel
  /** 模块/范围 */
  scope: string
  /** 文本内容 */
  message: string
  /** 附加数据 */
  data?: unknown
}

/** 错误上下文信息。 */
export interface ErrorContext {
  /** 所属组件 */
  component?: string
  /** 操作名称 */
  operation?: string
  /** 用户 ID */
  userId?: string
  /** 会话 ID */
  sessionId?: string
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}

/** 远程日志上报载荷。 */
export interface RemoteLogPayload {
  /** 日志数组 */
  entries: LogEntry[]
  /** 应用版本 */
  appVersion: string
  /** User-Agent 字符串 */
  userAgent: string
  /** 本地化信息 */
  locale: string
}

/** 捕获的错误详情。 */
export interface CapturedError {
  /** 错误类型 */
  type: ErrorType
  /** 错误严重度 */
  severity: ErrorSeverity
  /** 错误文案 */
  message: string
  /** 调试用堆栈 */
  stack?: string
  /** 上下文信息 */
  context?: ErrorContext
}
