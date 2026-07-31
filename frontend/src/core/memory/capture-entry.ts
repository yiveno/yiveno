import { z } from 'zod'

/**
 * MemoryItem 捕获入口。
 * - popup：Popup
 * - context_menu：右键菜单
 * - selection_toolbar：划词浮层
 * - omnibox：地址栏
 * - shortcut：快捷键
 * - sync：Chrome 书签同步
 * - import：书签导入
 */
export const CaptureEntrySchema = z.enum([
  'popup', // Popup
  'context_menu', // 右键菜单
  'selection_toolbar', // 划词浮层
  'omnibox', // 地址栏 Omnibox
  'shortcut', // 快捷键
  'sync', // Chrome 书签同步
  'import' // 书签导入
])

export type CaptureEntry = z.infer<typeof CaptureEntrySchema>
