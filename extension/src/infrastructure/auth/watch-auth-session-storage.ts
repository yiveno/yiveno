/**
 * UI 侧统一订阅登录态变更。
 * 官网 handoff / 扩展内登出改的是 chrome.storage.local，无全局 AUTH 广播；
 * 凡缓存 signedIn / 展示名 / 问候语的页面都应挂此监听，避免与顶栏脱节。
 */

import { AUTH_SESSION_STORAGE_KEY } from '@/core/identity/auth-session'
import { ACCOUNT_BINDING_STORAGE_KEY } from '@/core/identity/local-profile'

/**
 * 监听 session 或 AccountBinding 写入/清除。
 * @returns 取消订阅函数（onUnmounted 调用）
 */
export function watchAuthSessionStorage(onChange: () => void): () => void {
  function handle(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'local') {
      return
    }
    if (!(AUTH_SESSION_STORAGE_KEY in changes) && !(ACCOUNT_BINDING_STORAGE_KEY in changes)) {
      return
    }
    onChange()
  }

  chrome.storage.onChanged.addListener(handle)
  return () => {
    chrome.storage.onChanged.removeListener(handle)
  }
}
