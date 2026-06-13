/**
 * 将 Infrastructure 层 logger 适配为 Core 层 ILogger 接口
 */

import type { ILogger } from '@/core/common/logger'
import { logger } from '@/infrastructure/logging/logger'

function forward(
  level: 'debug' | 'info' | 'warn' | 'error',
  namespace: string,
  message: string,
  ...args: unknown[]
): void {
  if (args.length === 0) {
    logger[level](namespace, message)
    return
  }
  if (args.length === 1) {
    logger[level](namespace, message, args[0])
    return
  }
  logger[level](namespace, message, { args })
}

/** 创建 Core 层可用的 ILogger 实例 */
export function adaptInfrastructureLogger(): ILogger {
  return {
    debug: (namespace, message, ...args) => forward('debug', namespace, message, ...args),
    info: (namespace, message, ...args) => forward('info', namespace, message, ...args),
    warn: (namespace, message, ...args) => forward('warn', namespace, message, ...args),
    error: (namespace, message, ...args) => forward('error', namespace, message, ...args)
  }
}
