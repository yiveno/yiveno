import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_WEBSITE_URL', 'https://yiveno.com')
vi.stubEnv('VITE_API_BASE_URL', 'https://api.yiveno.com')

import {
  buildExtensionUninstallPageUrl,
  clearExtensionUninstallRevoke,
  ensureExtensionUninstallFeedbackUrl,
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

  it('buildExtensionUninstallPageUrl 无 token 仅反馈路径', () => {
    const url = buildExtensionUninstallPageUrl()
    expect(url).toBe('https://yiveno.com/auth/extension-uninstalled')
    expect(url).not.toContain('token=')
  })

  it('buildExtensionUninstallPageUrl 含 token', () => {
    const token = 't'.repeat(64)
    const url = buildExtensionUninstallPageUrl(token)
    expect(url).toContain('https://yiveno.com/auth/extension-uninstalled')
    expect(url).toContain(`token=${token}`)
  })

  it('ensure 无 storage token 时登记无 token 反馈 URL', async () => {
    await ensureExtensionUninstallFeedbackUrl()
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith(
      'https://yiveno.com/auth/extension-uninstalled',
      expect.any(Function)
    )
  })

  it('ensure 有 storage token 时 URL 带 token', async () => {
    const token = 't'.repeat(64)
    vi.mocked(chrome.storage.local.get).mockImplementation(async () => ({
      [UNINSTALL_REVOKE_TOKEN_STORAGE_KEY]: { token }
    }))
    await ensureExtensionUninstallFeedbackUrl()
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith(
      expect.stringContaining(token),
      expect.any(Function)
    )
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

  it('register 空 token 清 storage 仍保留反馈 URL', async () => {
    await registerExtensionUninstallRevoke(null)
    expect(chrome.storage.local.remove).toHaveBeenCalled()
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith(
      'https://yiveno.com/auth/extension-uninstalled',
      expect.any(Function)
    )
    expect(chrome.runtime.setUninstallURL).not.toHaveBeenCalledWith('', expect.any(Function))
  })

  it('clear 带 revokeRemote 会 POST 再保留无 token 反馈 URL', async () => {
    const token = 't'.repeat(64)
    vi.mocked(chrome.storage.local.get).mockImplementation(async () => ({
      [UNINSTALL_REVOKE_TOKEN_STORAGE_KEY]: { token }
    }))
    await clearExtensionUninstallRevoke({ revokeRemote: true })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.yiveno.com/api/auth/extension-uninstall-revoke',
      expect.objectContaining({ method: 'POST' })
    )
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith(
      'https://yiveno.com/auth/extension-uninstalled',
      expect.any(Function)
    )
    expect(chrome.runtime.setUninstallURL).not.toHaveBeenCalledWith('', expect.any(Function))
  })
})
