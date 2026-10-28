import { describe, expect, it } from 'vitest'

import {
  CHROME_WEB_STORE_LISTING_URL,
  EDGE_ADDONS_LISTING_URL,
  resolvePrimaryInstallCta
} from './store-links'

function listingOrNull(url: string): string | null {
  const trimmed = url.trim()
  return trimmed.length > 0 ? trimmed : null
}

describe('resolvePrimaryInstallCta', () => {
  it('.cn 主机主推 Edge', () => {
    const cta = resolvePrimaryInstallCta('yiveno.cn')
    expect(cta.store).toBe('edge')
    expect(cta.labelEn).toContain('Edge')
    expect(cta.secondary.store).toBe('chrome')
    expect(cta.href).toBe(listingOrNull(EDGE_ADDONS_LISTING_URL))
  })

  it('.com 主机主推 Chrome', () => {
    const cta = resolvePrimaryInstallCta('yiveno.com')
    expect(cta.store).toBe('chrome')
    expect(cta.secondary.store).toBe('edge')
    expect(cta.href).toBe(listingOrNull(CHROME_WEB_STORE_LISTING_URL))
  })
})
