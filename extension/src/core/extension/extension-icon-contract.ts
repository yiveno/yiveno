/**
 * 扩展工具栏 / 商店图标权威路径（与 manifest `icons` / `action.default_icon` 同源）。
 * 改此处须同步 `public/manifest.json` 与 `extension/public/images/` 资产。
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

/** 扩展页 HTML `<link rel="icon">` 使用的尺寸（与商店 icon 同源 PNG）。 */
export const EXTENSION_PAGE_FAVICON_SIZES = [
  '32',
  '16'
] as const satisfies readonly ExtensionIconSize[]

/**
 * 扩展页 favicon href（Vite 页用 `/images/...`，clean-dist 会改为 `./images/...`）。
 * offscreen 等 public 直出页请用 `./${EXTENSION_ICON_FILES[size]}`。
 */
export function extensionPageFaviconHref(
  size: (typeof EXTENSION_PAGE_FAVICON_SIZES)[number],
  options: { rootRelative?: boolean } = {}
): string {
  const path = EXTENSION_ICON_FILES[size]
  return options.rootRelative === false ? `./${path}` : `/${path}`
}
