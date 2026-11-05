import { describe, expect, it } from 'vitest'

import {
  isCuratedProbeItem,
  isProbeNoiseOrDiversityItem,
  isProbeNoiseOrDiversityUrl
} from '@/dev/probe/recall-probe-purge-classify'
import type { MemoryItem } from '@/core/memory/memory-item'

function excerpt(partial: { sourceUrl: string; selectedText: string; note?: string }): MemoryItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    ownerId: '00000000-0000-4000-8000-000000000099',
    sourceLocalProfileId: '00000000-0000-4000-8000-000000000098',
    type: 'text_excerpt',
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0,
      ...(partial.note ? { note: partial.note } : {})
    },
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    deletedAt: null,
    payload: {
      sourceUrl: partial.sourceUrl,
      selectedText: partial.selectedText,
      pageTitle: 'Probe classify fixture',
      domain: new URL(partial.sourceUrl).hostname
    }
  }
}

function bookmark(partial: { url: string; title: string; note?: string }): MemoryItem {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    ownerId: '00000000-0000-4000-8000-000000000099',
    sourceLocalProfileId: '00000000-0000-4000-8000-000000000098',
    type: 'bookmark',
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0,
      ...(partial.note ? { note: partial.note } : {})
    },
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    deletedAt: null,
    payload: {
      url: partial.url,
      title: partial.title,
      domain: new URL(partial.url).hostname
    }
  }
}

describe('isProbeNoiseOrDiversityUrl', () => {
  it('识别多样性 host', () => {
    expect(isProbeNoiseOrDiversityUrl('https://linear.app/blog/yiveno-div/excerpt/3')).toBe(true)
  })

  it('保留精选 yiveno-probe 路径', () => {
    expect(isProbeNoiseOrDiversityUrl('https://notion.so/yiveno-probe-interview-notes')).toBe(false)
  })

  it('识别噪声 /probe 路径', () => {
    expect(isProbeNoiseOrDiversityUrl('https://www.nytimes.com/probe/excerpt/0')).toBe(true)
  })
})

describe('isProbeNoiseOrDiversityItem', () => {
  it('清除多样性摘录', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        excerpt({
          sourceUrl: 'https://linear.app/blog/yiveno-div/excerpt/1',
          selectedText: 'Branch-scoped caches miss. (div 2)',
          note: 'cut CI minutes with this excerpt 1'
        })
      )
    ).toBe(true)
  })

  it('保留精选 GitHub 摘录', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        excerpt({
          sourceUrl:
            'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows',
          selectedText: 'Caches are scoped per branch by default.'
        })
      )
    ).toBe(false)
  })

  it('保留真实 example.com Capture', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        excerpt({
          sourceUrl: 'https://example.com/',
          selectedText: 'This domain is for use in documentation examples.'
        })
      )
    ).toBe(false)
  })

  it('清除噪声书签标题', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        bookmark({
          url: 'https://medium.com/probe/12',
          title: 'gardening tips (#13)'
        })
      )
    ).toBe(true)
  })

  it('无脚手架后缀的 cluster 书签仍靠 URL 识别为 filler', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        bookmark({
          url: 'https://docs.github.com/en/yiveno-div/cluster/clu-bm-developer-0-1',
          title: 'Runbook: idempotent payment retries',
          note: 'link from onboarding doc'
        })
      )
    ).toBe(true)
  })

  it('无脚手架后缀的 cluster 摘录仍靠 URL 识别为 filler', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        excerpt({
          sourceUrl:
            'https://www.figma.com/community/yiveno-div/cluster-excerpt/clu-ex-creator-0-0',
          selectedText: 'Hierarchy that whispers beats decoration that shouts for attention.',
          note: 'reuse spacing rhythm in client deck'
        })
      )
    ).toBe(true)
  })

  it('保留精选 developer 书签附注', () => {
    expect(
      isProbeNoiseOrDiversityItem(
        bookmark({
          url: 'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows',
          title: 'Caching dependencies to speed up workflows',
          note: 'cut CI minutes'
        })
      )
    ).toBe(false)
  })
})

describe('isCuratedProbeItem', () => {
  const curatedUrls = new Set(['https://www.theatlantic.com/yiveno-probe/attention-economy-myth/'])

  it('命中语料 URL', () => {
    expect(
      isCuratedProbeItem(
        bookmark({
          url: 'https://www.theatlantic.com/yiveno-probe/attention-economy-myth/',
          title: 'The Attention Economy Is a Lie'
        }),
        { curatedUrls, probeChromeIds: new Set() }
      )
    ).toBe(true)
  })

  it('命中 yiveno-probe 指纹', () => {
    expect(
      isCuratedProbeItem(
        bookmark({
          url: 'https://notion.so/yiveno-probe-interview-notes',
          title: 'Notes'
        }),
        { curatedUrls, probeChromeIds: new Set() }
      )
    ).toBe(true)
  })

  it('噪声层不算精选', () => {
    expect(
      isCuratedProbeItem(
        bookmark({
          url: 'https://medium.com/probe/12',
          title: 'gardening tips (#13)'
        }),
        { curatedUrls, probeChromeIds: new Set() }
      )
    ).toBe(false)
  })

  it('真实 Capture 不算精选', () => {
    expect(
      isCuratedProbeItem(
        excerpt({
          sourceUrl: 'https://example.com/',
          selectedText: 'This domain is for use in documentation examples.'
        }),
        { curatedUrls, probeChromeIds: new Set() }
      )
    ).toBe(false)
  })
})
