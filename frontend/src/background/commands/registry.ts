import type { ExtensionCommandId } from '@/core/commands/command-ids'
import { isExtensionCommandId } from '@/core/commands/command-ids'
import { logger } from '@/infrastructure/logging/logger'

/** 自定义命令处理器。 */
export type ExtensionCommandHandler = (commandId: ExtensionCommandId) => Promise<void>

const handlers = new Map<string, ExtensionCommandHandler>()

/** 注册命令处理器；重复注册覆盖并打日志。 */
export function registerExtensionCommandHandler(
  commandId: ExtensionCommandId,
  handler: ExtensionCommandHandler
): void {
  if (handlers.has(commandId)) {
    logger.warn('Commands', '命令处理器被覆盖', { commandId })
  }
  handlers.set(commandId, handler)
}

/** 清空注册表（仅测试）。 */
export function resetExtensionCommandRegistryForTests(): void {
  handlers.clear()
}

/**
 * 分发 chrome.commands.onCommand 事件。
 * 未知命令忽略；保留命令 `_execute_action` 不会进入此路径。
 */
export async function dispatchExtensionCommand(command: string): Promise<void> {
  if (!isExtensionCommandId(command)) {
    logger.warn('Commands', '忽略未知命令', { command })
    return
  }

  const handler = handlers.get(command)
  if (!handler) {
    logger.error('Commands', '命令未注册处理器', { command })
    return
  }

  await handler(command)
}
