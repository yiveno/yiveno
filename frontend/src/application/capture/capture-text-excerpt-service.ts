import { CodedError } from '@/core/common/coded-error'
import { optionalProp } from '@/core/common/optional-props'
import { normalizeTextExcerptSelection } from '@/core/capture/text-excerpt-selection'
import type { CaptureEntry } from '@/core/memory/capture-entry'
import type { MemoryItem } from '@/core/memory/memory-item'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { readSelectionContextFromTab } from '@/infrastructure/browser/selection-context-reader'
import { flowFail, flowOk, flowStart, previewText } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export interface CaptureTextExcerptFromPageInput {
  selectionText: string
  sourceUrl: string
  pageTitle: string
  contextBefore?: string
  contextAfter?: string
  captureEntry: CaptureEntry
  tabId?: number
}

/** 从页面选区捕获 Text Excerpt（右键 / 划词浮层等共用）。 */
export async function captureTextExcerptFromPage(
  input: CaptureTextExcerptFromPageInput
): Promise<MemoryItem> {
  const startedAt = flowStart('Capture', '页面选区捕获', {
    entry: input.captureEntry,
    tabId: input.tabId ?? null,
    textPreview: previewText(input.selectionText)
  })

  try {
    if (!isSavablePageUrl(input.sourceUrl)) {
      throw new CodedError('CAPTURE_UNSAVABLE_PAGE')
    }

    let selection = normalizeTextExcerptSelection({
      selectedText: input.selectionText,
      ...optionalProp('contextBefore', input.contextBefore),
      ...optionalProp('contextAfter', input.contextAfter)
    })

    if (
      input.tabId != null &&
      input.contextBefore === undefined &&
      input.contextAfter === undefined
    ) {
      try {
        const fromPage = await readSelectionContextFromTab(input.tabId)
        if (fromPage) {
          selection = normalizeTextExcerptSelection({
            selectedText: fromPage.selectedText || input.selectionText,
            ...optionalProp('contextBefore', fromPage.contextBefore),
            ...optionalProp('contextAfter', fromPage.contextAfter)
          })
        }
      } catch (error) {
        // scripting 不可用时回退到调用方提供的选区文本
        logger.warn('Capture', '选区上下文读取失败，回退调用方文本', {
          tabId: input.tabId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (!selection) {
      throw new CodedError('CAPTURE_EMPTY_SELECTION')
    }

    const item = await memoryItemService.captureTextExcerpt({
      payload: {
        selectedText: selection.selectedText,
        sourceUrl: input.sourceUrl,
        pageTitle: input.pageTitle.trim() || input.sourceUrl,
        ...optionalProp('contextBefore', selection.contextBefore),
        ...optionalProp('contextAfter', selection.contextAfter)
      },
      captureEntry: input.captureEntry
    })
    flowOk('Capture', '页面选区捕获', startedAt, {
      id: item.id,
      entry: input.captureEntry,
      textPreview: previewText(selection.selectedText)
    })
    return item
  } catch (error) {
    flowFail('Capture', '页面选区捕获', startedAt, error, {
      entry: input.captureEntry
    })
    throw error
  }
}

export interface CaptureTextExcerptFromContextMenuInput {
  selectionText: string
  sourceUrl: string
  pageTitle: string
  tabId?: number
}

/** 从右键选区捕获 Text Excerpt MemoryItem。 */
export async function captureTextExcerptFromContextMenu(
  input: CaptureTextExcerptFromContextMenuInput
): Promise<MemoryItem> {
  return captureTextExcerptFromPage({
    ...input,
    captureEntry: 'context_menu'
  })
}
