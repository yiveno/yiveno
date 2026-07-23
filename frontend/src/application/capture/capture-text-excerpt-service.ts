import { normalizeTextExcerptSelection } from '@/core/capture/text-excerpt-selection'
import type { MemoryItem } from '@/core/memory/memory-item'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { readSelectionContextFromTab } from '@/infrastructure/browser/selection-context-reader'

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
  if (!isSavablePageUrl(input.sourceUrl)) {
    throw new Error('无法保存此页面的选区，请在普通网页上重试')
  }

  let selection = normalizeTextExcerptSelection({
    selectedText: input.selectionText
  })

  if (input.tabId != null) {
    try {
      const fromPage = await readSelectionContextFromTab(input.tabId)
      if (fromPage) {
        selection = normalizeTextExcerptSelection({
          selectedText: fromPage.selectedText || input.selectionText,
          contextBefore: fromPage.contextBefore,
          contextAfter: fromPage.contextAfter
        })
      }
    } catch {
      // activeTab/scripting 不可用时回退到 context menu 提供的 selectionText
    }
  }

  if (!selection) {
    throw new Error('选区为空，请重新选中文字后再保存')
  }

  return memoryItemService.captureTextExcerpt({
    payload: {
      selectedText: selection.selectedText,
      sourceUrl: input.sourceUrl,
      pageTitle: input.pageTitle.trim() || input.sourceUrl,
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter
    },
    captureEntry: 'context_menu'
  })
}
