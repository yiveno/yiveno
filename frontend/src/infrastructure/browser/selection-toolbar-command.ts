import {
  SELECTION_TOOLBAR_PAGE_API_KEY,
  type SelectionToolbarCommandType
} from '@/core/messaging/content-messages'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
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

export type DispatchSelectionToolbarResult =
  | { status: 'ok' }
  | { status: 'ignored' }
  | { status: 'command_failed' }
  | { status: 'unsavable_page' }
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

/** 向可保存页注入划词脚本（扩展重载后旧标签常见未注入）。 */
export async function ensureSelectionToolbarContentScript(tabId: number): Promise<boolean> {
  try {
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

  if (tabId === undefined || !url || !isSavablePageUrl(url)) {
    return { status: 'ignored' }
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
    return { status: 'ignored' }
  }

  if (!response.ok) {
    await flashActionBadge('error')
    return { status: 'command_failed' }
  }

  return { status: 'ok' }
}
