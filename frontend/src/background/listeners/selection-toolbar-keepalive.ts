import { SELECTION_TOOLBAR_KEEPALIVE_PORT } from '@/core/messaging/content-messages'

let listenersRegistered = false

/**
 * 承接划词 content script 的 keepalive port。
 * 若不监听 onConnect，port 会立刻 disconnect，导致页内无限重连。
 * 扩展 Reload 时 SW 销毁 → content 侧 onDisconnect → 拆旧实例。
 */
export function registerSelectionToolbarKeepaliveListener(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== SELECTION_TOOLBAR_KEEPALIVE_PORT) {
      return
    }
    // 仅保持连接；业务消息仍走 tabs/runtime messaging 与页内 API
    port.onDisconnect.addListener(() => {
      // no-op：由 content script 决定重连或 teardown
    })
  })
}

/** 测试用：重置注册状态。 */
export function resetSelectionToolbarKeepaliveListenerForTests(): void {
  listenersRegistered = false
}
