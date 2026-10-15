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

  it('mint ok → ok', async () => {
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

  it('取消挤掉 → cancelled_displace 且不清官网（只清 pending）', async () => {
    getSessionMock.mockResolvedValue({
      access_token: 'at',
      user: { id: '11111111-1111-4111-8111-111111111111' }
    })
    mintAndHandoffMock.mockResolvedValue({ status: 'cancelled_displace' })
    const status = await runExtensionConnectFromWebsite('ext-id-1')
    expect(status).toBe('cancelled_displace')
    expect(clearPendingMock).toHaveBeenCalled()
    expect(publishResultMock).toHaveBeenCalledWith('cancelled_displace')
  })
})
