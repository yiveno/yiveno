/**
 * Message 组件安装器（presentation 层）
 *
 * 在应用启动时自动挂载 Message 组件到 body
 */

import { createApp, h } from 'vue'
import Message from '@/components/base/Message/Message.vue'
import { logger } from '@/infrastructure/logging/logger'

let messageApp: ReturnType<typeof createApp> | null = null
let messageContainer: HTMLDivElement | null = null

/**
 * 安装 Message 组件
 */
export function installMessage(): void {
  if (messageApp) {
    logger.warn('MessageInstaller', 'Message 组件已安装，跳过重复安装')
    return
  }

  if (typeof document === 'undefined') {
    logger.debug('MessageInstaller', 'Service Worker 环境，跳过 Message 组件安装')
    return
  }

  try {
    messageContainer = document.createElement('div')
    messageContainer.id = 'message-container'
    document.body.appendChild(messageContainer)

    messageApp = createApp({
      render: () => h(Message)
    })

    messageApp.mount(messageContainer)
    logger.info('MessageInstaller', 'Message 组件已安装')
  } catch (error) {
    logger.error('MessageInstaller', 'Message 组件安装失败', error)
  }
}
