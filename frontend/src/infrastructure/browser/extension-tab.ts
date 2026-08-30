/**
 * 打开扩展 HTML 页：优先激活已有标签，避免每次堆新 Tab。
 * 1) session 记住的 tabId  2) 按 chrome-extension URL 扫描  3) 新建
 */

import { EXTENSION_OPTIONS_PAGE } from '@/core/extension/extension-options-contract'

const LIBRARY_TAB_SESSION_KEY = 'yiveno.libraryTabId'
const SETTINGS_TAB_SESSION_KEY = 'yiveno.settingsTabId'
const GETTING_STARTED_TAB_SESSION_KEY = 'yiveno.gettingStartedTabId'

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

/** 扫描是否已有该扩展页（含历史 window.open 打开、未写入 session 的情况）。 */
async function findTabIdByExtensionPageUrl(path: string): Promise<number | null> {
  const target = chrome.runtime.getURL(path)
  try {
    const tabs = await chrome.tabs.query({})
    const hit = tabs.find(tab => {
      const url = tab.url ?? tab.pendingUrl ?? ''
      return url === target || url.startsWith(`${target}?`) || url.startsWith(`${target}#`)
    })
    return typeof hit?.id === 'number' ? hit.id : null
  } catch {
    return null
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

  const byUrlId = await findTabIdByExtensionPageUrl(path)
  if (byUrlId !== null && (await focusExistingTab(byUrlId))) {
    await writeStoredTabId(sessionKey, byUrlId)
    return
  }

  const created = await chrome.tabs.create({ url: chrome.runtime.getURL(path) })
  if (typeof created.id === 'number') {
    await writeStoredTabId(sessionKey, created.id)
  }
}

/** 快捷键 / 顶栏：打开或切到记忆库页。 */
export async function focusOrOpenLibraryTab(): Promise<void> {
  await focusOrCreateExtensionPage('library.html', LIBRARY_TAB_SESSION_KEY)
}

/**
 * 快捷键 / 顶栏：打开或切到设置页。
 * 与记忆库同路径：session → URL 扫描 → 新建；避免 openOptionsPage 重复开 Tab。
 */
export async function focusOrOpenSettingsTab(): Promise<void> {
  await focusOrCreateExtensionPage(EXTENSION_OPTIONS_PAGE, SETTINGS_TAB_SESSION_KEY)
}

/** Side Panel / 安装引导：打开或切到 Getting Started 页。 */
export async function focusOrOpenGettingStartedTab(): Promise<void> {
  await focusOrCreateExtensionPage('getting-started.html', GETTING_STARTED_TAB_SESSION_KEY)
}
