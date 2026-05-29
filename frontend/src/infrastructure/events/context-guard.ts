/**
 * Extension Context Validity Guard
 *
 * Chrome 扩展在 Service Worker 重启时，已打开的页面（如 sidepanel）
 * 的 extension context 会部分失效。继续调用 chrome.* API
 * 会导致 Chrome 内部状态损坏 → SIGTRAP 崩溃。
 *
 * 解决方案：在每次 chrome API 调用前检查 context 是否仍然有效。
 */

let contextExtensionId: string | null = null

try {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    contextExtensionId = chrome.runtime.id
  }
} catch {
  contextExtensionId = null
}

/**
 * 检查 extension context 是否仍然有效
 *
 * - Service Worker 重启后，旧页面的 chrome.runtime.id 可能返回不同的值或抛异常
 * - 返回 true 表示可以安全调用 chrome.* API
 */
export function isExtensionContextValid(): boolean {
  if (contextExtensionId === null) return false
  try {
    const currentId = chrome?.runtime?.id
    return currentId === contextExtensionId
  } catch {
    return false
  }
}

/**
 * 安全地注册 chrome.runtime.onMessage 监听器
 *
 * 封装 addListener + context guard
 * 返回清理函数
 */
export function safeAddMessageListener(
  callback: Parameters<typeof chrome.runtime.onMessage.addListener>[0]
): () => void {
  if (!isExtensionContextValid() || !chrome?.runtime?.onMessage) {
    return () => {}
  }

  chrome.runtime.onMessage.addListener(callback)

  return () => {
    try {
      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(callback)
      }
    } catch {}
  }
}
