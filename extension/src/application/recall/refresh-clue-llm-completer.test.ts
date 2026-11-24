import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getWorkerApiAccessTokenMock,
  getUserSettingsMock,
  setClueLlmCompleterMock,
  setClueLlmCompleterDetailedMock,
  createHostedMock,
  createHostedDetailedMock,
  createClueMock,
  createClueDetailedMock
} = vi.hoisted(() => ({
  getWorkerApiAccessTokenMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  setClueLlmCompleterMock: vi.fn(),
  setClueLlmCompleterDetailedMock: vi.fn(),
  createHostedMock: vi.fn(() => 'hosted'),
  createHostedDetailedMock: vi.fn(() => 'hosted-detailed'),
  createClueMock: vi.fn(() => 'clue-ip'),
  createClueDetailedMock: vi.fn(() => 'clue-ip-detailed')
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getWorkerApiAccessTokenMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  setClueLlmCompleter: setClueLlmCompleterMock,
  setClueLlmCompleterDetailed: setClueLlmCompleterDetailedMock
}))

vi.mock('@/infrastructure/ai/hosted-clue-understand-api-client', () => ({
  createHostedClueUnderstandApiCompleter: createHostedMock,
  createHostedClueUnderstandApiCompleterDetailed: createHostedDetailedMock
}))

vi.mock('@/infrastructure/ai/clue-understand-api-client', () => ({
  createClueUnderstandApiCompleter: createClueMock,
  createClueUnderstandApiCompleterDetailed: createClueDetailedMock
}))

import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'

describe('refreshClueLlmCompleterFromDevConfig · device token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserSettingsMock.mockResolvedValue({ aiFeaturesEnabled: true })
  })

  it('有 device token → hosted 分支（不再读 yiveno.dev.clueLlm）', async () => {
    getWorkerApiAccessTokenMock.mockResolvedValue('ydt_' + 'h'.repeat(64))
    await refreshClueLlmCompleterFromDevConfig()
    expect(createHostedMock).toHaveBeenCalled()
    expect(setClueLlmCompleterMock).toHaveBeenCalledWith('hosted')
    expect(createClueMock).not.toHaveBeenCalled()
  })

  it('无 token → 不走 hosted（生产 rules / DEV IP）', async () => {
    getWorkerApiAccessTokenMock.mockResolvedValue(null)
    await refreshClueLlmCompleterFromDevConfig()
    expect(createHostedMock).not.toHaveBeenCalled()
  })
})
