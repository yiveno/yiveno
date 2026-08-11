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

import { buildMergedMemoryEnrichment } from '@/application/memory/build-merged-memory-enrichment'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'

function createRepoMock(item: MemoryItem | null) {
  const putEnrichmentClues = vi.fn(async () => undefined)
  const repo = {
    getById: vi.fn(async () => item),
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
})

describe('scheduleAsyncMemoryLlmEnrichment', () => {
  afterEach(() => {
    resetAsyncMemoryLlmEnrichmentQueueForTests()
  })

  it('空 id 不入队', () => {
    expect(() => scheduleAsyncMemoryLlmEnrichment('  ')).not.toThrow()
  })
})
