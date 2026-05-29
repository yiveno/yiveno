/**
 * Logger 接口 - Core 层
 *
 * Core 层不应依赖 Infrastructure 层，因此定义接口抽象
 * Infrastructure 层提供实现，通过依赖注入传入
 */

/**
 * Logger 接口
 *
 * 提供统一的日志记录能力，不依赖具体实现
 */
export interface ILogger {
  /**
   * 记录调试信息
   * @param namespace - 模块命名空间
   * @param message - 日志消息
   * @param args - 额外的上下文参数
   */
  debug(namespace: string, message: string, ...args: unknown[]): void

  /**
   * 记录信息
   * @param namespace - 模块命名空间
   * @param message - 日志消息
   * @param args - 额外的上下文参数
   */
  info(namespace: string, message: string, ...args: unknown[]): void

  /**
   * 记录警告
   * @param namespace - 模块命名空间
   * @param message - 日志消息
   * @param args - 额外的上下文参数
   */
  warn(namespace: string, message: string, ...args: unknown[]): void

  /**
   * 记录错误
   * @param namespace - 模块命名空间
   * @param message - 日志消息
   * @param args - 额外的上下文参数
   */
  error(namespace: string, message: string, ...args: unknown[]): void
}

/**
 * 空 Logger 实现（用于测试或不需要日志的场景）
 */
export const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
}
