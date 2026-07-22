import type { CaptureEntry } from '@/core/memory/capture-entry'
import type { MemoryItem } from '@/core/memory/memory-item'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { readActivePageInfo } from '@/infrastructure/browser/active-tab-reader'

/**
 * 捕获当前活动页为 Bookmark MemoryItem。
 * 由 Background 调用，Popup 通过 sendMessage 触发。
 */
export async function captureCurrentPage(
  captureEntry: CaptureEntry = 'popup'
): Promise<MemoryItem> {
  const page = await readActivePageInfo()
  if (!page) {
    throw new Error('无法保存此页面，请打开普通网页后再试')
  }

  return memoryItemService.captureBookmark({
    payload: {
      title: page.title,
      url: page.url,
      faviconUrl: page.faviconUrl
    },
    captureEntry
  })
}
