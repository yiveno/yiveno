/**
 * UI 图标选型：Material Symbols Outlined（与 MD3 / Material Web 对齐）。
 * 按需内联 path，避免整包字体/CDN（Chrome 扩展体积与离线可用）。
 * 增补图标：从 https://fonts.google.com/icons 取 Outlined 24px path，写入下表。
 */

export const MATERIAL_SYMBOL_NAMES = [
  'bookmark',
  'chevron_right',
  'delete',
  'expand_more',
  'folder',
  'folder_open'
] as const

export type MaterialSymbolName = (typeof MATERIAL_SYMBOL_NAMES)[number]

/** viewBox 统一 0 0 24 24；fill 由 CSS currentColor 控制。 */
const MATERIAL_SYMBOL_PATHS: Record<MaterialSymbolName, string> = {
  // Material Icons Outlined · bookmark
  bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z',
  // Material Icons · chevron_right
  chevron_right: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  // Material Icons / Symbols Outlined · delete
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  // Material Icons · expand_more
  expand_more: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  // Material Icons · folder
  folder:
    'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  // Material Icons · folder_open
  folder_open:
    'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z'
}

/** 读取已登记 Material Symbol 的 path `d`。 */
export function getMaterialSymbolPath(name: MaterialSymbolName): string {
  return MATERIAL_SYMBOL_PATHS[name]
}
