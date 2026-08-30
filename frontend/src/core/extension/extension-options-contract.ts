/**
 * 扩展 Options UI 权威契约（manifest `options_ui` ↔ Vite 入口 ↔ dist 平铺产物）。
 * 改此处须同步 `public/manifest.json` 与 `scripts/clean-dist.cjs`。
 */
export const EXTENSION_OPTIONS_PAGE = 'settings.html' as const

/** 全页设置（非嵌入式 options 气泡）；与 Chrome「扩展程序选项」一致。 */
export const EXTENSION_OPTIONS_OPEN_IN_TAB = true as const

/** Vite 多入口：设置页 HTML 源路径（相对 `frontend/src`）。 */
export const EXTENSION_OPTIONS_SOURCE_HTML = 'pages/settings/index.html' as const
