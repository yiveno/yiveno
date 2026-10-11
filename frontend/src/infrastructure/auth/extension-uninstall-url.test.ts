import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_WEBSITE_URL', 'https://yiveno.com')
vi.stubEnv('VITE_API_BASE_URL', 'https://api.yiveno.com')

import {
  buildExtensionUninstallPageUrl,
  clearExtensionUninstallRevoke,
  registerExtensionUninstallRevoke,
  UNINSTALL_REVOKE_TOKEN_STORAGE_KEY
} from '@/infrastructure/auth/extension-uninstall-url'

describe('extension-uninstall-url', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined)
        }
      },
      runtime: {
        setUninstallURL: vi.fn((_url: string, cb?: () => void) => {
          cb?.()
        }),
        lastError: undefined
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
    )
  })

  it('buildExtensionUninstallPageUrl 含 token', () => {
    const token = 't'.repeat(64)
    const url = buildExtensionUninstallPageUrl(token)
    expect(url).toContain('https://yiveno.com/auth/extension-uninstalled')
    expect(url).toContain(`token=${token}`)
  })

  it('register 写入 storage 并 setUninstallURL', async () => {
    const token = 't'.repeat(64)
    await registerExtensionUninstallRevoke(token)
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [UNINSTALL_REVOKE_TOKEN_STORAGE_KEY]: { token }
    })
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith(
      expect.stringContaining(token),
      expect.any(Function)
    )
  })

  it('clear 带 revokeRemote 会 POST 再清 URL', async () => {
    const token = 't'.repeat(64)
    vi.mocked(chrome.storage.local.get).mockImplementation(async () => ({
      [UNINSTALL_REVOKE_TOKEN_STORAGE_KEY]: { token }
    }))
    await clearExtensionUninstallRevoke({ revokeRemote: true })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.yiveno.com/api/auth/extension-uninstall-revoke',
      expect.objectContaining({ method: 'POST' })
    )
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith('', expect.any(Function))
  })
})
