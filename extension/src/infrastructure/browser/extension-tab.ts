/**
 * 打开扩展 HTML 页：优先激活已有标签，避免每次堆新 Tab。
 * 契约实现见 {@link focusOrOpenTab}（session tabId → URL 扫描 → 新建）。
 */

import { EXTENSION_OPTIONS_PAGE } from '@/core/extension/extension-options-contract'
import { focusOrOpenTab } from '@/infrastructure/browser/focus-or-open-tab'

const LIBRARY_TAB_SESSION_KEY = 'yiveno.libraryTabId'
const SETTINGS_TAB_SESSION_KEY = 'yiveno.settingsTabId'
const GETTING_STARTED_TAB_SESSION_KEY = 'yiveno.gettingStartedTabId'

/** chrome.tabs.query url 过滤：匹配扩展页及其 query/hash 变体，避免全量 tabs.query({})。 */
export function buildExtensionPageTabQueryPattern(path: string): string {
  return `${chrome.runtime.getURL(path)}*`
}

async function focusOrCreateExtensionPage(path: string, sessionKey: string): Promise<boolean> {
  const result = await focusOrOpenTab({
    targetUrl: chrome.runtime.getURL(path),
    match: { kind: 'urlPatterns', patterns: buildExtensionPageTabQueryPattern(path) },
    sessionKey,
    logScope: 'ExtensionTab'
  })
  return result.status === 'focused' || result.status === 'created'
}

/**
 * 打开或聚焦扩展包内任意 HTML 页（记忆库 / 设置 / DEV probe-console 等）。
 * sessionKey 用于记住 tabId，避免重复堆 Tab。
 */
export async function focusOrOpenExtensionHtmlPage(
  path: string,
  sessionKey: string
): Promise<boolean> {
  return focusOrCreateExtensionPage(path, sessionKey)
}

/** 快捷键 / 顶栏：打开或切到记忆库页。 */
export async function focusOrOpenLibraryTab(): Promise<boolean> {
  return focusOrCreateExtensionPage('library.html', LIBRARY_TAB_SESSION_KEY)
}

/**
 * 快捷键 / 顶栏 / 空库「导入」：打开或切到设置页。
 * 与记忆库同路径：session → URL 扫描 → 新建；避免 openOptionsPage 重复开 Tab。
 * @param options.hash 不含 `#`；有则改址并对齐深链（滚到书签开关等）
 */
export async function focusOrOpenSettingsTab(options?: { hash?: string }): Promise<boolean> {
  const hashRaw = options?.hash?.trim() ?? ''
  const hash = hashRaw.replace(/^#/, '')
  if (!hash) {
    return focusOrCreateExtensionPage(EXTENSION_OPTIONS_PAGE, SETTINGS_TAB_SESSION_KEY)
  }

  const baseUrl = chrome.runtime.getURL(EXTENSION_OPTIONS_PAGE)
  const targetUrl = `${baseUrl}#${hash}`
  const expectedHash = `#${hash}`
  const result = await focusOrOpenTab({
    targetUrl,
    match: {
      kind: 'urlPatterns',
      patterns: buildExtensionPageTabQueryPattern(EXTENSION_OPTIONS_PAGE)
    },
    sessionKey: SETTINGS_TAB_SESSION_KEY,
    // 已有 Settings tab 时也要对齐 hash（否则空库深链无效）
    canKeepExistingUrl: current => current.hash === expectedHash,
    logScope: 'ExtensionTab'
  })
  return result.status === 'focused' || result.status === 'created'
}

/** Side Panel / 安装引导：打开或切到 Getting Started 页。 */
export async function focusOrOpenGettingStartedTab(): Promise<boolean> {
  return focusOrCreateExtensionPage('getting-started.html', GETTING_STARTED_TAB_SESSION_KEY)
}
