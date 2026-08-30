/**
 * 扩展工具栏 / 商店图标权威路径（与 manifest `icons` / `action.default_icon` 同源）。
 * 改此处须同步 `public/manifest.json` 与 `frontend/public/images/` 资产。
 */
export const EXTENSION_ICON_SIZES = ['16', '32', '48', '128'] as const

export type ExtensionIconSize = (typeof EXTENSION_ICON_SIZES)[number]

/** manifest 中各尺寸 PNG 相对 public 根目录的路径。 */
export const EXTENSION_ICON_FILES: Record<ExtensionIconSize, string> = {
  '16': 'images/icon16.png',
  '32': 'images/icon32.png',
  '48': 'images/icon48.png',
  '128': 'images/icon128.png'
}
