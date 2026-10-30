/**
 * Chrome Web Store 图形资产 ↔ 母本目录权威对照。
 * 母本仅上传商店后台，不进扩展包；改文件名须同批更新 `CHROMEWEBSTORE.md` 与本文件。
 */

/** 相对仓库根的 CWS 图形母本目录。 */
export const CHROMEWEBSTORE_GRAPHICS_DIR = 'docs/design/brand-assets/chrome-web-store' as const

export type ChromeWebStoreGraphicKind = 'screenshot' | 'promo'

export interface ChromeWebStoreGraphicSpec {
  /** 母本文件名（位于 CHROMEWEBSTORE_GRAPHICS_DIR）。 */
  filename: string
  /** 像素宽。 */
  width: number
  /** 像素高。 */
  height: number
  kind: ChromeWebStoreGraphicKind
  /** CWS 上架最低要求（Screenshot 1 为必填）。 */
  requiredForListing: boolean
}

/** 已落盘、可上传商店的图形资产（不含设计稿导出大图 / archive-*）。 */
export const CHROMEWEBSTORE_GRAPHICS: readonly ChromeWebStoreGraphicSpec[] = [
  {
    filename: 'screenshot-01-sidepanel-recall-1280x800.png',
    width: 1280,
    height: 800,
    kind: 'screenshot',
    requiredForListing: true
  },
  {
    filename: 'screenshot-02-library-1280x800.png',
    width: 1280,
    height: 800,
    kind: 'screenshot',
    requiredForListing: false
  },
  {
    filename: 'screenshot-03-settings-1280x800.png',
    width: 1280,
    height: 800,
    kind: 'screenshot',
    requiredForListing: false
  },
  {
    filename: 'chrome-web-store-small-promo-440x280.png',
    width: 440,
    height: 280,
    kind: 'promo',
    requiredForListing: false
  },
  {
    filename: 'chrome-web-store-marquee-1400x560.png',
    width: 1400,
    height: 560,
    kind: 'promo',
    requiredForListing: false
  }
] as const
