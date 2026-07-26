/**
 * Service Worker 打开扩展 HTML 页：优先激活已有标签，避免每次快捷键堆新 Tab。
 * 用 session 记住本扩展打开的 tabId（无需 `tabs` 权限扫全表 URL）。
 */

const LIBRARY_TAB_SESSION_KEY = 'yiveno.libraryTabId'
const SETTINGS_TAB_SESSION_KEY = 'yiveno.settingsTabId'

async function readStoredTabId(key: string): Promise<number | null> {
  const result = await chrome.storage.session.get(key)
  const value = result[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

async function writeStoredTabId(key: string, tabId: number): Promise<void> {
  await chrome.storage.session.set({ [key]: tabId })
}

async function clearStoredTabId(key: string): Promise<void> {
  await chrome.storage.session.remove(key)
}

/** 若 tab 仍在则激活并聚焦窗口；否则返回 false。 */
async function focusExistingTab(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.id === undefined) {
      return false
    }
    await chrome.tabs.update(tab.id, { active: true })
    if (typeof tab.windowId === 'number') {
      await chrome.windows.update(tab.windowId, { focused: true })
    }
    return true
  } catch {
    return false
  }
}

async function focusOrCreateExtensionPage(path: string, sessionKey: string): Promise<void> {
  const existingId = await readStoredTabId(sessionKey)
  if (existingId !== null && (await focusExistingTab(existingId))) {
    return
  }
  if (existingId !== null) {
    await clearStoredTabId(sessionKey)
  }

  const created = await chrome.tabs.create({ url: chrome.runtime.getURL(path) })
  if (typeof created.id === 'number') {
    await writeStoredTabId(sessionKey, created.id)
  }
}

/** 快捷键等：打开或切到记忆库页。 */
export async function focusOrOpenLibraryTab(): Promise<void> {
  await focusOrCreateExtensionPage('library.html', LIBRARY_TAB_SESSION_KEY)
}

/**
 * 快捷键等：打开或切到设置页。
 * 优先 `openOptionsPage`（Chrome 会对 options 去重）；失败时回退到 tabs。
 */
export async function focusOrOpenSettingsTab(): Promise<void> {
  try {
    await chrome.runtime.openOptionsPage()
    return
  } catch {
    // 个别环境 openOptionsPage 失败时回退
  }
  await focusOrCreateExtensionPage('settings.html', SETTINGS_TAB_SESSION_KEY)
}
