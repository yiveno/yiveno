import { afterEach, describe, expect, it, vi } from 'vitest'

import { rollbackMintedExtensionSession } from './rollback-minted-extension-session'

describe('rollbackMintedExtensionSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('空 token 不请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await rollbackMintedExtensionSession(undefined)).toBe(false)
    expect(await rollbackMintedExtensionSession('  ')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POST uninstall-revoke 成功', async () => {
    const token = 't'.repeat(64)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
    )
    expect(await rollbackMintedExtensionSession(token)).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/extension-uninstall-revoke'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token })
      })
    )
  })

  it('HTTP 非成功返回 false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_token' }), { status: 404 }))
    )
    expect(await rollbackMintedExtensionSession('t'.repeat(64))).toBe(false)
  })
})
