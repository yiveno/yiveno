/**
 * Side Panel 订阅官网登录 UI 态（UI 桥写入 session；Connect 软条用）。
 */

import { WEBSITE_AUTH_UI_SESSION_KEY } from '@/core/identity/ui-bridge-messages'

/** @returns 取消订阅 */
export function watchWebsiteAuthUiStorage(onChange: () => void): () => void {
  function handle(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'session') {
      return
    }
    if (!(WEBSITE_AUTH_UI_SESSION_KEY in changes)) {
      return
    }
    onChange()
  }
  chrome.storage.onChanged.addListener(handle)
  return () => {
    chrome.storage.onChanged.removeListener(handle)
  }
}
