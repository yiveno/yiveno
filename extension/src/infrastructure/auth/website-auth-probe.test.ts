import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_WEBSITE_URL', 'https://yiveno.com')

import {
  probeWebsiteSignedIn,
  resolveWebsiteAuthProbeFromExternal
} from '@/infrastructure/auth/website-auth-probe'

describe('website-auth-probe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-probe-test' },
      tabs: {
        create: vi.fn(async () => ({ id: 42 })),
        remove: vi.fn(async () => undefined)
      }
    })
  })

  it('收到官网 probe 回传 → websiteSignedIn true', async () => {
    const pending = probeWebsiteSignedIn()
    await Promise.resolve()
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://yiveno.com/auth/extension-session-probe?extension_id=ext-probe-test',
      active: false
    })
    expect(
      resolveWebsiteAuthProbeFromExternal({
        type: 'YIVENO_WEBSITE_AUTH_PROBE',
        payload: { signedIn: true }
      })
    ).toBe(true)
    await expect(pending).resolves.toBe(true)
    expect(chrome.tabs.remove).toHaveBeenCalledWith(42)
  })

  it('超时 → false', async () => {
    const pending = probeWebsiteSignedIn()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toBe(false)
  })
})
