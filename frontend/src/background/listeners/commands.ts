import { dispatchExtensionCommand } from '@/background/commands/registry'
import { logger } from '@/infrastructure/logging/logger'

let listenersRegistered = false

/**
 * 注册 chrome.commands.onCommand 监听。
 * 当前无自定义命令处理器；`_execute_action` 由 Chrome 直接打开 Popup（找回）。
 * 书签写入靠 Chrome 原生书签 + sync 监听，不提供「保存当前页」快捷键。
 */
export function registerCommandListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  chrome.commands.onCommand.addListener(command => {
    void dispatchExtensionCommand(command).catch(error => {
      logger.error('Commands', '命令分发失败', error)
    })
  })

  logger.info('Commands', '快捷键命令监听器已注册')
}

/** 测试用：重置监听器注册状态。 */
export function resetCommandListenersForTests(): void {
  listenersRegistered = false
}
