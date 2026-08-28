import { z } from 'zod'

/**
 * MemoryItem 捕获入口。
 * - popup：遗留 capture 入口枚举（原 Action Popup 时代默认来源；≠ 现行 Side Panel 主壳）
 * - context_menu：右键菜单
 * - selection_toolbar：划词浮层
 * - omnibox：地址栏
 * - shortcut：快捷键
 * - sync：Chrome 书签同步
 * - import：书签导入
 * - getting_started：安装引导演示页
 */
export const CaptureEntrySchema = z.enum([
  'popup', // 遗留 capture 入口（原 Action Popup 时代）
  'context_menu', // 右键菜单
  'selection_toolbar', // 划词浮层
  'omnibox', // 地址栏 Omnibox
  'shortcut', // 快捷键
  'sync', // Chrome 书签同步
  'import', // 书签导入
  'getting_started' // 安装引导演示页
])

export type CaptureEntry = z.infer<typeof CaptureEntrySchema>
