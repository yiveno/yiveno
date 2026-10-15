/**
 * 官网登录 UI 态（UI 桥写入 chrome.storage.session；Connect 软条读）。
 */

import {
  WEBSITE_AUTH_UI_SESSION_KEY,
  WebsiteAuthUiStateSchema,
  type WebsiteAuthUiState
} from '@/core/identity/ui-bridge-messages'
import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

/** Side Panel：读官网是否已登录（无桥消息时为 null → 可 probe 兜底）。 */
export async function readWebsiteAuthUiState(): Promise<WebsiteAuthUiState | null> {
  return readChromeStorageSession(WEBSITE_AUTH_UI_SESSION_KEY, WebsiteAuthUiStateSchema)
}

/** 测试 / SW 旁路写入。 */
export async function writeWebsiteAuthUiState(state: WebsiteAuthUiState): Promise<void> {
  await writeChromeStorageSession(WEBSITE_AUTH_UI_SESSION_KEY, state)
}

/** 官网登出或清除 UI 态。 */
export async function clearWebsiteAuthUiState(): Promise<void> {
  await removeChromeStorageSession(WEBSITE_AUTH_UI_SESSION_KEY)
}
