import { extractSelectionContextOnPage } from '@/infrastructure/browser/selection-context-page'

export interface TabSelectionContext {
  selectedText: string
  contextBefore?: string
  contextAfter?: string
}

/**
 * 从标签页读取选区上下文；失败时返回 null（由调用方回退到 selectionText）。
 * 仅 Background 在 activeTab 上下文调用。
 */
export async function readSelectionContextFromTab(
  tabId: number
): Promise<TabSelectionContext | null> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractSelectionContextOnPage
  })

  const result = results[0]?.result
  if (!result || typeof result !== 'object' || !('selectedText' in result)) {
    return null
  }

  const selectedText = String(result.selectedText).trim()
  if (!selectedText) {
    return null
  }

  return {
    selectedText,
    contextBefore:
      'contextBefore' in result && result.contextBefore ? String(result.contextBefore) : undefined,
    contextAfter:
      'contextAfter' in result && result.contextAfter ? String(result.contextAfter) : undefined
  }
}
