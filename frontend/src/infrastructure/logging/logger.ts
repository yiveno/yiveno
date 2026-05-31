/**
 * 日志系统 - 基础设施层
 *
 * 职责：
 * - 提供统一的日志接口
 * - 支持不同日志级别
 * - 提供样式化输出
 * - 支持日志过滤和配置
 */

// 从统一类型定义导入
import type { LogLevel, LoggerConfig, LogEntry } from '@/types/infrastructure/logging'

// 导出类型供外部使用
export type { LogLevel, LoggerConfig, LogEntry }

/**
 * 日志样式配置
 *
 * ✅ 使用 Material Design 3 颜色（从 design-tokens 包导入）
 * 注意：这些颜色用于浏览器控制台，无法使用 CSS 变量
 * 通过导入 TypeScript 常量，确保与 design-tokens 包自动同步
 */
const getLevelToStyle = (): Record<LogLevel, string> => {
  try {
    // prettier-ignore
    /* eslint-disable @typescript-eslint/no-var-requires */
    const {
      semanticColors,
    } = require("@ottersage/design-tokens/colors");
    /* eslint-enable @typescript-eslint/no-var-requires */
    return {
      // Info: 使用语义 Info 容器色
      info: `background: ${semanticColors.infoContainer.rgb}; color: ${semanticColors.info.rgb}; padding: 2px 6px; border-radius: 3px;`,
      // Warn: 使用语义 Warning 容器色
      warn: `background: ${semanticColors.warningContainer.rgb}; color: ${semanticColors.warning.rgb}; padding: 2px 6px; border-radius: 3px;`,
      // Error: 使用 MD3 Error 容器色（需要从 material-theme.css 获取）
      error: `background: rgb(255, 235, 238); color: rgb(183, 28, 28); padding: 2px 6px; border-radius: 3px;`,
      // Debug: 使用 MD3 Tertiary 容器色（需要从 material-theme.css 获取）
      debug: `background: rgb(243, 229, 245); color: rgb(74, 20, 140); padding: 2px 6px; border-radius: 3px;`
    }
  } catch {
    // 降级方案：如果导入失败，使用硬编码值
    return {
      info: 'background: rgb(216, 226, 255); color: rgb(68, 94, 145); padding: 2px 6px; border-radius: 3px;',
      warn: 'background: rgb(252, 215, 251); color: rgb(113, 85, 115); padding: 2px 6px; border-radius: 3px;',
      error:
        'background: rgb(255, 235, 238); color: rgb(183, 28, 28); padding: 2px 6px; border-radius: 3px;',
      debug:
        'background: rgb(243, 229, 245); color: rgb(74, 20, 140); padding: 2px 6px; border-radius: 3px;'
    }
  }
}

const levelToStyle = getLevelToStyle()

/**
 * 日志级别权重
 */
const levelWeights: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * 日志器类
 */
export class Logger {
  private config: LoggerConfig
  private buffer: LogEntry[] = []

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableRemote: false,
      maxBufferSize: 1000,
      ...config
    }
  }

  /**
   * 记录信息日志
   * 支持可变数量的标题参数，最后一个参数作为数据
   * @example
   * logger.info('Component', 'SidePanel', 'Message', data)
   * logger.info('Component', 'Message')
   */
  info(...args: unknown[]): void {
    const { titles, data } = this.parseArgs(args)
    this.log('info', titles, data)
  }

  /**
   * 记录警告日志
   * 支持可变数量的标题参数，最后一个参数作为数据
   */
  warn(...args: unknown[]): void {
    const { titles, data } = this.parseArgs(args)
    this.log('warn', titles, data)
  }

  /**
   * 记录错误日志
   * 支持可变数量的标题参数，最后一个参数作为数据
   */
  error(...args: unknown[]): void {
    const { titles, data } = this.parseArgs(args)
    this.log('error', titles, data)
  }

  /**
   * 记录调试日志
   * 支持可变数量的标题参数，最后一个参数作为数据
   */
  debug(...args: unknown[]): void {
    const { titles, data } = this.parseArgs(args)
    this.log('debug', titles, data)
  }

  /**
   * 解析参数：将可变参数分为标题和数据
   * 如果最后一个参数是Error或Object（非字符串），则作为data
   * 否则所有参数都作为标题
   */
  private parseArgs(args: unknown[]): { titles: string; data?: unknown } {
    if (args.length === 0) {
      return { titles: 'Unknown' }
    }

    const lastArg = args[args.length - 1]

    // 判断最后一个参数是否为数据（Error、对象、数组等非字符串类型）
    const isLastArgData =
      lastArg instanceof Error ||
      (typeof lastArg === 'object' && lastArg !== null) ||
      typeof lastArg === 'number' ||
      typeof lastArg === 'boolean'

    if (isLastArgData && args.length > 1) {
      // 最后一个参数是数据，前面的都是标题
      const titleArgs = args.slice(0, -1)
      const titles = titleArgs
        .filter(arg => typeof arg === 'string' || typeof arg === 'number')
        .map(arg => String(arg))
        .join(' | ')
      return { titles, data: lastArg }
    } else {
      // 所有参数都是标题
      const titles = args
        .filter(arg => typeof arg === 'string' || typeof arg === 'number')
        .map(arg => String(arg))
        .join(' | ')
      return { titles }
    }
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, titles: string, data?: unknown): void {
    // 检查日志级别
    if (levelWeights[level] < levelWeights[this.config.level]) {
      return
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      scope: titles,
      message: '',
      data
    }

    // 添加到缓冲区
    this.addToBuffer(entry)

    // 控制台输出
    if (this.config.enableConsole) {
      this.logToConsole(entry)
    }

    // 远程日志
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.logToRemote(entry)
    }
  }

  /**
   * 添加到缓冲区
   */
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry)

    // 限制缓冲区大小
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.config.maxBufferSize)
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const [label, style] = this.formatLabel(entry.scope, entry.level)

    // 如果有数据，使用 console.group 来更好地组织输出
    if (entry.data !== undefined && entry.data !== null) {
      switch (entry.level) {
        case 'info':
          console.info(label, style)
          console.info('  ↳', entry.data)
          break
        case 'warn':
          console.warn(label, style)
          console.warn('  ↳', entry.data)
          break
        case 'error':
          console.error(label, style)
          console.error('  ↳', entry.data)
          break
        case 'debug':
          if (import.meta.env.DEV) {
            console.info(label, style)
            console.info('  ↳', entry.data)
          }
          break
      }
    } else {
      // 没有数据时，直接输出标签
      switch (entry.level) {
        case 'info':
          console.info(label, style)
          break
        case 'warn':
          console.warn(label, style)
          break
        case 'error':
          console.error(label, style)
          break
        case 'debug':
          if (import.meta.env.DEV) {
            console.info(label, style)
          }
          break
      }
    }
  }

  /**
   * 发送到远程日志服务
   */
  private async logToRemote(entry: LogEntry): Promise<void> {
    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      })
    } catch (error) {
      // 避免远程日志错误影响主流程
      console.error('Failed to send log to remote:', error)
    }
  }

  /**
   * 格式化标签
   */
  private formatLabel(scope: string, level: LogLevel): [string, string] {
    const style = levelToStyle[level] || levelToStyle.info
    return [`%c${scope}`, style]
  }

  /**
   * 获取日志缓冲区
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer]
  }

  /**
   * 清空日志缓冲区
   */
  clearBuffer(): void {
    this.buffer = []
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config }
  }

  /**
   * 导出日志
   */
  exportLogs(): string {
    return JSON.stringify(this.buffer, null, 2)
  }

  /**
   * 导入日志
   */
  importLogs(logs: string): void {
    try {
      const entries = JSON.parse(logs) as LogEntry[]
      this.buffer = entries
    } catch (error) {
      this.error('Logger', 'Failed to import logs', error)
    }
  }
}

/**
 * 默认日志器实例
 */
const rawLevel = import.meta.env?.VITE_LOG_LEVEL as string | undefined
const desiredLevel = rawLevel && rawLevel in levelWeights ? (rawLevel as LogLevel) : 'info'

const rawConsole = import.meta.env?.VITE_LOG_CONSOLE as string | undefined
const runtimeEnv = import.meta.env?.VITE_RUNTIME_ENV || 'dev'

const enableConsole = (() => {
  if (runtimeEnv !== 'prod') return true
  if (import.meta.env?.PROD) {
    return rawConsole?.toLowerCase() === 'true'
  }
  return false
})()

export const logger = new Logger({
  level: desiredLevel,
  enableConsole,
  enableRemote: false
})

/**
 * 创建新的日志器实例
 */
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(config)
}

/**
 * 设置全局日志级别
 */
export function setLogLevel(level: LogLevel): void {
  logger.setConfig({ level })
}

/**
 * 启用/禁用控制台日志
 */
export function setConsoleLogging(enabled: boolean): void {
  logger.setConfig({ enableConsole: enabled })
}

/**
 * 启用/禁用远程日志
 */
export function setRemoteLogging(enabled: boolean, endpoint?: string): void {
  logger.setConfig({
    enableRemote: enabled,
    ...(endpoint !== undefined ? { remoteEndpoint: endpoint } : {})
  })
}
