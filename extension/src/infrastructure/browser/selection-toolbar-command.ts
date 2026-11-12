import {
  SELECTION_TOOLBAR_PAGE_API_KEY,
  type SelectionToolbarCommandType
} from '@/core/messaging/content-messages'
import {
  isGettingStartedPageUrl,
  isSavablePageUrl
} from '@/infrastructure/browser/active-tab-reader'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import {
  invokeSelectionToolbarPageApi,
  type SelectionToolbarPageApiInvokeResult
} from '@/infrastructure/browser/selection-toolbar-page-api'
import { logger } from '@/infrastructure/logging/logger'

export type { SelectionToolbarCommandType }

/** 与 manifest `content_scripts` / 构建产物文件名一致。 */
export const SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE = 'content-selection-toolbar.js' as const

const INJECT_RETRY_ATTEMPTS = 10
const INJECT_RETRY_DELAY_MS = 50

export type DispatchSelectionToolbarIgnoredReason =
  | 'no_selection' // 无选区
  | 'unsavable_page' // 不可存页面
  | 'no_active_tab' // 无活动标签或 URL

export type DispatchSelectionToolbarResult =
  | { status: 'ok' }
  | { status: 'ignored'; reason: DispatchSelectionToolbarIgnoredReason }
  | { status: 'command_failed' }
  | { status: 'no_receiver' }

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function runCommandViaPageApi(
  tabId: number,
  type: SelectionToolbarCommandType
): Promise<SelectionToolbarPageApiInvokeResult | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: invokeSelectionToolbarPageApi,
      args: [type, SELECTION_TOOLBAR_PAGE_API_KEY]
    })
    const result = results[0]?.result
    if (!result || typeof result !== 'object' || !('ok' in result)) {
      return null
    }
    return result
  } catch (error) {
    logger.warn('Commands', '划词页 API 调用失败', error)
    return null
  }
}

/** 向可保存页注入划词脚本（扩展自有页已打入页面 bundle，不可 executeScript 注入）。 */
export async function ensureSelectionToolbarContentScript(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId)
    const url = tab.url
    if (url && isGettingStartedPageUrl(url)) {
      return false
    }
    if (url?.startsWith('chrome-extension:')) {
      return false
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE]
    })
    return true
  } catch (error) {
    logger.warn('Commands', '无法注入划词 content script', error)
    return false
  }
}

/**
 * 向当前活动可保存页的划词浮层下发快捷键命令（走与点击按钮相同的页内逻辑与 UI 反馈）。
 * 无选区由页内 API 返回 skipped（静默忽略）；无 API 时注入脚本并短重试。
 */
export async function dispatchSelectionToolbarCommand(
  type: SelectionToolbarCommandType
): Promise<DispatchSelectionToolbarResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tab?.id
  const url = tab?.url

  if (tabId === undefined || !url) {
    return { status: 'ignored', reason: 'no_active_tab' }
  }
  if (!isSavablePageUrl(url)) {
    return { status: 'ignored', reason: 'unsavable_page' }
  }

  let response = await runCommandViaPageApi(tabId, type)
  if (response === null || response.missingApi) {
    const injected = await ensureSelectionToolbarContentScript(tabId)
    if (injected) {
      for (let attempt = 0; attempt < INJECT_RETRY_ATTEMPTS; attempt += 1) {
        await delay(INJECT_RETRY_DELAY_MS)
        response = await runCommandViaPageApi(tabId, type)
        if (response !== null && !response.missingApi) {
          break
        }
      }
    }
  }

  if (response === null || response.missingApi) {
    logger.warn('Commands', '划词快捷键未能送达当前页（注入后仍无页内 API）')
    return { status: 'no_receiver' }
  }

  if ('skipped' in response && response.skipped) {
    return { status: 'ignored', reason: 'no_selection' }
  }

  if (!response.ok) {
    await flashActionBadge('error')
    return { status: 'command_failed' }
  }

  return { status: 'ok' }
}

/**
 * 通知页内划词浮层展示保存失败原因。
 * 返回 true 表示页内已展示；无接收端 / 抛错 / 无响应 → false（调用方再闪 badge）。
 */
export async function notifySelectionToolbarError(
  tabId: number,
  errorCode: string
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      scope: 'content',
      type: 'SHOW_SELECTION_ERROR',
      errorCode
    })
    return (
      typeof response === 'object' &&
      response !== null &&
      'shown' in response &&
      (response as { shown: unknown }).shown === true
    )
  } catch (error) {
    logger.warn('Commands', '划词失败页内通知未送达', {
      tabId,
      errorCode,
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}
