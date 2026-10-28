/**
 * 扩展商店安装深链（ADR-020）。
 * 空串 = 该店尚未公开上架；UI 须诚实 Coming soon，禁止假装可装。
 */
import { isCnMarketHost } from '../geo/resolve-geo-domain-redirect'

/** Microsoft Edge Add-ons 公开页；上架后填入 Partner Center 商店 URL。 */
export const EDGE_ADDONS_LISTING_URL = '' as string

/** Chrome Web Store 公开页；上架后填入。 */
export const CHROME_WEB_STORE_LISTING_URL = '' as string

export type ExtensionStoreId = 'edge' | 'chrome'

export type PrimaryInstallCta = {
  store: ExtensionStoreId
  /** null = 未上架 */
  href: string | null
  /** 用户可见主按钮文案（en；zh 走 i18n 时另键） */
  labelEn: string
  secondary: {
    store: ExtensionStoreId
    href: string | null
    labelEn: string
  }
}

function listingOrNull(url: string): string | null {
  const trimmed = url.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * 大陆 / `.cn` 主 CTA → Edge；其它主机主 CTA → Chrome。
 * 副链给出另一店（同样可能未上架）。
 */
export function resolvePrimaryInstallCta(hostname: string): PrimaryInstallCta {
  const edgeHref = listingOrNull(EDGE_ADDONS_LISTING_URL)
  const chromeHref = listingOrNull(CHROME_WEB_STORE_LISTING_URL)
  const preferEdge = isCnMarketHost(hostname)

  if (preferEdge) {
    return {
      store: 'edge',
      href: edgeHref,
      labelEn: 'Get for Microsoft Edge',
      secondary: {
        store: 'chrome',
        href: chromeHref,
        labelEn: 'Chrome Web Store'
      }
    }
  }

  return {
    store: 'chrome',
    href: chromeHref,
    labelEn: 'Get for Chrome',
    secondary: {
      store: 'edge',
      href: edgeHref,
      labelEn: 'Microsoft Edge'
    }
  }
}
