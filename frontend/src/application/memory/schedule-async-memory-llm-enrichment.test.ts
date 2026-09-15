import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resetAsyncMemoryLlmEnrichmentQueueForTests,
  runAsyncMemoryLlmEnrichment,
  scheduleAsyncMemoryLlmEnrichment
} from '@/application/memory/schedule-async-memory-llm-enrichment'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { MemoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

vi.mock('@/application/memory/build-merged-memory-enrichment', () => ({
  buildMergedMemoryEnrichment: vi.fn()
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: vi.fn(async () => ({
    selectionToolbarEnabled: true,
    aiFeaturesEnabled: true
  }))
}))

vi.mock('@/application/onboarding/cold-start-enrichment-batch-store', () => ({
  settleColdStartEnrichmentBatchItem: vi.fn(async () => null),
  pauseColdStartEnrichmentBatchForQuota: vi.fn(async () => undefined),
  clearColdStartEnrichmentBatchRemainder: vi.fn(async () => undefined),
  beginColdStartEnrichmentBatch: vi.fn(async () => null),
  readColdStartEnrichmentBatch: vi.fn(async () => null)
}))

import { buildMergedMemoryEnrichment } from '@/application/memory/build-merged-memory-enrichment'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'

function createRepoMock(item: MemoryItem | null, listItems: MemoryItem[] = []) {
  const putEnrichmentClues = vi.fn(async () => undefined)
  const repo = {
    getById: vi.fn(async () => item),
    listByOwner: vi.fn(async () => listItems),
    putEnrichmentClues
  } as unknown as MemoryItemRepository
  return { repo, putEnrichmentClues }
}

describe('runAsyncMemoryLlmEnrichment', () => {
  afterEach(() => {
    resetAsyncMemoryLlmEnrichmentQueueForTests()
    vi.mocked(buildMergedMemoryEnrichment).mockReset()
    vi.mocked(getUserSettings).mockResolvedValue({
      selectionToolbarEnabled: true,
      aiFeaturesEnabled: true
    })
  })

  it('用户关闭 AI 时跳过', async () => {
    vi.mocked(getUserSettings).mockResolvedValue({
      selectionToolbarEnabled: true,
      aiFeaturesEnabled: false
    })
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 't', url: 'https://example.com/a' },
      clues: {}
    })
    const { repo, putEnrichmentClues } = createRepoMock(item)
    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('skipped')
    expect(putEnrichmentClues).not.toHaveBeenCalled()
    expect(buildMergedMemoryEnrichment).not.toHaveBeenCalled()
  })

  it('门禁跳过时不请求 LLM', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Hitler documentary BBC', url: 'https://youtube.com/watch?v=1' },
      clues: { summary: 'kept' }
    })
    const { repo, putEnrichmentClues } = createRepoMock(item)
    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('skipped')
    expect(buildMergedMemoryEnrichment).not.toHaveBeenCalled()
    expect(putEnrichmentClues).not.toHaveBeenCalled()
  })

  it('LLM 成功且有新字段时写回且保留 updatedAt', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        title: 'Why Hitler still matters - BBC',
        url: 'https://www.youtube.com/watch?v=hitler'
      }
    })
    const { repo, putEnrichmentClues } = createRepoMock(item)

    vi.mocked(buildMergedMemoryEnrichment).mockResolvedValue({
      rule: { tags: ['video'], keywords: ['video'], entities: ['Hitler'] },
      proposal: {
        keywords: ['war', 'documentary'],
        summary: 'BBC WWII video about Hitler'
      },
      merged: {
        tags: ['video'],
        keywords: ['video', 'war', 'documentary', 'Hitler'],
        entities: ['Hitler'],
        summary: 'BBC WWII video about Hitler'
      },
      path: 'rule_plus_llm'
    })

    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('written')
    expect(putEnrichmentClues).toHaveBeenCalledTimes(1)
    const written = putEnrichmentClues.mock.calls[0]?.[0] as MemoryItem
    expect(written.updatedAt).toBe(item.updatedAt)
    expect(written.clues.summary).toBe('BBC WWII video about Hitler')
    expect(written.clues.keywords).toEqual(expect.arrayContaining(['war', 'documentary', 'Hitler']))
  })

  it('LLM 降级时不写回', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Some long enough title', url: 'https://example.com/a' }
    })
    const { repo, putEnrichmentClues } = createRepoMock(item)
    vi.mocked(buildMergedMemoryEnrichment).mockResolvedValue({
      rule: { tags: ['page'], keywords: [], entities: [] },
      proposal: null,
      merged: { tags: ['page'], keywords: [], entities: [] },
      path: 'llm_failed_degraded'
    })

    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('skipped')
    expect(putEnrichmentClues).not.toHaveBeenCalled()
  })

  it('同 URL 书签复用 donor enrichment，跳过 LLM', async () => {
    const donor = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Donor', url: 'https://example.com/same' },
      clues: { keywords: ['cached-kw'], entities: ['Entity'] }
    })
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Sibling', url: 'https://www.example.com/same/' }
    })
    const { repo, putEnrichmentClues } = createRepoMock(item, [donor, item])

    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('written')
    expect(buildMergedMemoryEnrichment).not.toHaveBeenCalled()
    expect(putEnrichmentClues).toHaveBeenCalledTimes(1)
    const written = putEnrichmentClues.mock.calls[0]?.[0] as MemoryItem
    expect(written.clues.keywords).toEqual(expect.arrayContaining(['cached-kw']))
    expect(written.clues.summary).toBeUndefined()
  })

  it('同域名不同 path：注入域名基座后仍请求页面 LLM', async () => {
    const donor = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'About', url: 'https://github.com/about' },
      clues: {
        tags: ['code', 'page'],
        keywords: ['about-page-only'],
        entities: ['GitHub']
      }
    })
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Pricing seats', url: 'https://github.com/pricing' }
    })
    const { repo, putEnrichmentClues } = createRepoMock(item, [donor, item])

    vi.mocked(buildMergedMemoryEnrichment).mockResolvedValue({
      rule: { tags: ['page'], keywords: [], entities: [] },
      proposal: { keywords: ['pricing', 'seats'], summary: 'GitHub pricing page' },
      merged: {
        tags: ['code', 'page'],
        keywords: ['pricing', 'seats'],
        entities: ['GitHub'],
        summary: 'GitHub pricing page'
      },
      path: 'rule_plus_llm'
    })

    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('written')
    expect(buildMergedMemoryEnrichment).toHaveBeenCalledTimes(1)
    const call = vi.mocked(buildMergedMemoryEnrichment).mock.calls[0]?.[0]
    expect(call?.existing?.entities).toEqual(expect.arrayContaining(['GitHub']))
    expect(call?.existing?.tags).toEqual(expect.arrayContaining(['code', 'page']))
    // 页面级 keywords 不得从 donor 整包灌入 existing
    expect(call?.existing?.keywords ?? []).not.toContain('about-page-only')
    expect(putEnrichmentClues).toHaveBeenCalledTimes(1)
  })

  it('配额耗尽时熔断：后续直接跳过且不再请求', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Some long enough title for gate', url: 'https://example.com/a' }
    })
    const { repo, putEnrichmentClues } = createRepoMock(item)
    vi.mocked(buildMergedMemoryEnrichment).mockResolvedValue({
      rule: { tags: ['page'], keywords: [], entities: [] },
      proposal: null,
      merged: { tags: ['page'], keywords: [], entities: [] },
      path: 'quota_exceeded'
    })

    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('failed')
    expect(putEnrichmentClues).not.toHaveBeenCalled()

    vi.mocked(buildMergedMemoryEnrichment).mockClear()
    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('skipped')
    expect(buildMergedMemoryEnrichment).not.toHaveBeenCalled()
  })
})

describe('scheduleAsyncMemoryLlmEnrichment', () => {
  afterEach(() => {
    resetAsyncMemoryLlmEnrichmentQueueForTests()
  })

  it('空 id 不入队', () => {
    expect(() => scheduleAsyncMemoryLlmEnrichment('  ')).not.toThrow()
  })

  it('配额熔断后新 schedule 会解除熔断并再跑', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Some long enough title for gate', url: 'https://example.com/b' }
    })
    const { repo } = createRepoMock(item)

    vi.mocked(buildMergedMemoryEnrichment).mockResolvedValueOnce({
      rule: { tags: ['page'], keywords: [], entities: [] },
      proposal: null,
      merged: { tags: ['page'], keywords: [], entities: [] },
      path: 'quota_exceeded'
    })
    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('failed')

    vi.mocked(buildMergedMemoryEnrichment).mockResolvedValue({
      rule: { tags: ['page'], keywords: ['x'], entities: [] },
      proposal: { keywords: ['x'], summary: 'ok' },
      merged: {
        tags: ['page'],
        keywords: ['x'],
        entities: [],
        summary: 'ok'
      },
      path: 'rule_plus_llm'
    })

    // schedule 应解除熔断；直接再跑一次模拟入队后执行
    scheduleAsyncMemoryLlmEnrichment(item.id)
    await expect(runAsyncMemoryLlmEnrichment(item.id, repo)).resolves.toBe('written')
  })
})
