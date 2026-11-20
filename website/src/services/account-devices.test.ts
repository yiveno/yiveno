import { afterEach, describe, expect, it, vi } from 'vitest'

import { listAccountDevices, renameAccountDevice, revokeAccountDevice } from './account-devices'

describe('account-devices', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('listAccountDevices 解析列表', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            devices: [
              {
                deviceId: '11111111-1111-4111-8111-111111111111',
                name: 'Chrome · macOS',
                platform: 'macOS',
                lastSeenAt: '2026-11-20T00:00:00.000Z',
                createdAt: '2026-11-19T00:00:00.000Z'
              }
            ]
          }
        })
      }))
    )
    const result = await listAccountDevices('access')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.devices).toHaveLength(1)
    expect(result.devices[0]?.name).toBe('Chrome · macOS')
  })

  it('revokeAccountDevice 成功', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { revoked: true } })
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await revokeAccountDevice('access', '11111111-1111-4111-8111-111111111111')
    expect(result).toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/device-revoke'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('renameAccountDevice 空名 → invalid_name（不发请求）', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await renameAccountDevice(
      'access',
      '11111111-1111-4111-8111-111111111111',
      '   '
    )
    expect(result).toEqual({ status: 'invalid_name' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
