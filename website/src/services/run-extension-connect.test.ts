import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  getSessionMock,
  mintAndHandoffMock,
  primeMock,
  clearPendingMock,
  publishAckMock,
  publishResultMock
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  mintAndHandoffMock: vi.fn(),
  primeMock: vi.fn(),
  clearPendingMock: vi.fn(),
  publishAckMock: vi.fn(),
  publishResultMock: vi.fn()
}))

vi.mock('./auth', () => ({
  getSession: getSessionMock
}))

vi.mock('./extension-auth-handoff', () => ({
  clearExtensionConnectParams: clearPendingMock,
  extractProfileFromUserMetadata: () => ({}),
  mintAndHandoffSessionToExtension: mintAndHandoffMock,
  primeExtensionConnectPending: primeMock
}))

vi.mock('./ui-bridge', () => ({
  publishWebsiteConnectAck: publishAckMock,
  publishWebsiteConnectResult: publishResultMock
}))

import { runExtensionConnectFromWebsite } from './run-extension-connect'

describe('runExtensionConnectFromWebsite', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('无 session → no_session + 清 pending', async () => {
    getSessionMock.mockResolvedValue(null)
    const status = await runExtensionConnectFromWebsite('ext-id-1')
    expect(status).toBe('no_session')
    expect(publishAckMock).toHaveBeenCalled()
    expect(publishResultMock).toHaveBeenCalledWith('no_session')
    expect(clearPendingMock).toHaveBeenCalled()
    expect(mintAndHandoffMock).not.toHaveBeenCalled()
  })

  it('device handoff ok → ok', async () => {
    getSessionMock.mockResolvedValue({
      access_token: 'at',
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.com' }
    })
    mintAndHandoffMock.mockResolvedValue({ status: 'ok' })
    const status = await runExtensionConnectFromWebsite('ext-id-1')
    expect(status).toBe('ok')
    expect(primeMock).toHaveBeenCalledWith('ext-id-1')
    expect(publishResultMock).toHaveBeenCalledWith('ok')
  })

  it('扩展已是其它账号 → account_mismatch（不清官网会话）', async () => {
    getSessionMock.mockResolvedValue({
      access_token: 'at',
      user: { id: '11111111-1111-4111-8111-111111111111' }
    })
    mintAndHandoffMock.mockResolvedValue({ status: 'account_mismatch' })
    const status = await runExtensionConnectFromWebsite('ext-id-1')
    expect(status).toBe('account_mismatch')
    expect(clearPendingMock).toHaveBeenCalled()
    expect(publishResultMock).toHaveBeenCalledWith('account_mismatch')
  })
})
