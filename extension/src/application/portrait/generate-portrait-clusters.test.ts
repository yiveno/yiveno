/**
 * 画像语义聚类：回退 / 重试 / 缓存。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const readCacheMock = vi.hoisted(() => vi.fn())
const writeCacheMock = vi.hoisted(() => vi.fn())
const getCompleterMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const getTokenMock = vi.hoisted(() => vi.fn())

vi.mock('@/infrastructure/storage/portrait-cluster-cache-storage', () => ({
  readPortraitClusterCache: readCacheMock,
  writePortraitClusterCache: writeCacheMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: getCompleterMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getSettingsMock
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getTokenMock
}))

vi.mock('@/infrastructure/ai/hosted-clue-understand-api-client', () => ({
  createHostedClueUnderstandApiCompleter: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { generatePortraitClusters } from '@/application/portrait/generate-portrait-clusters'

const ITEMS = [
  {
    factId: 'f-apple',
    value: '苹果',
    credibility: 0.4,
    state: 'unconfirmed',
    sourceNoteRefs: ['note:fruit']
  },
  {
    factId: 'f-pear',
    value: '梨',
    credibility: 0.4,
    state: 'unconfirmed',
    sourceNoteRefs: ['note:fruit']
  }
]

describe('generatePortraitClusters', () => {
  beforeEach(() => {
    readCacheMock.mockReset()
    writeCacheMock.mockReset()
    getCompleterMock.mockReset()
    getSettingsMock.mockReset()
    getTokenMock.mockReset()
    readCacheMock.mockResolvedValue(null)
    writeCacheMock.mockResolvedValue(undefined)
    getCompleterMock.mockReturnValue(null)
    getSettingsMock.mockResolvedValue({ aiFeaturesEnabled: true })
    getTokenMock.mockResolvedValue(null)
  })

  it('校验两次失败 → 回退共现聚类', async () => {
    const complete = vi.fn(async () =>
      JSON.stringify({
        clusters: [{ label: '水果', items: ['苹果'] }]
      })
    )
    const result = await generatePortraitClusters({
      items: ITEMS,
      locale: 'zh_CN',
      complete
    })
    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.source).toBe('cooccurrence')
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]?.items.sort()).toEqual(['梨', '苹果'].sort())
    expect(writeCacheMock).not.toHaveBeenCalled()
  })

  it('合法 JSON 通过并缓存', async () => {
    const payload = {
      clusters: [{ label: '水果', items: ['苹果', '梨'] }]
    }
    const complete = vi.fn(async () => JSON.stringify(payload))
    const result = await generatePortraitClusters({
      items: ITEMS,
      locale: 'zh_CN',
      complete
    })
    expect(result.source).toBe('llm')
    expect(result.clusters[0]?.label).toBe('水果')
    expect(writeCacheMock).toHaveBeenCalledOnce()
  })
})
