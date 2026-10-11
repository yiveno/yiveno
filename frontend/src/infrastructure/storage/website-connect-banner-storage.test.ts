import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  readWebsiteConnectBannerDismissed,
  writeWebsiteConnectBannerDismissed,
  WEBSITE_CONNECT_BANNER_DISMISSED_KEY
} from '@/infrastructure/storage/website-connect-banner-storage'

describe('website-connect-banner-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined)
        }
      }
    })
  })

  it('未 dismiss → false', async () => {
    await expect(readWebsiteConnectBannerDismissed()).resolves.toBe(false)
  })

  it('write 后可读 true', async () => {
    await writeWebsiteConnectBannerDismissed()
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [WEBSITE_CONNECT_BANNER_DISMISSED_KEY]: { dismissed: true }
    })
    vi.mocked(chrome.storage.local.get).mockImplementation(async () => ({
      [WEBSITE_CONNECT_BANNER_DISMISSED_KEY]: { dismissed: true }
    }))
    await expect(readWebsiteConnectBannerDismissed()).resolves.toBe(true)
  })
})
