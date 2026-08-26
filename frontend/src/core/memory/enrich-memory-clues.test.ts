import { describe, expect, it } from 'vitest'

import {
  enrichMemoryClues,
  mergeEnrichmentIntoMemoryItem,
  mergeUniqueStrings
} from '@/core/memory/enrich-memory-clues'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'

describe('mergeUniqueStrings', () => {
  it('保序去重（大小写不敏感）', () => {
    expect(mergeUniqueStrings(['music', 'audio'], ['Audio', 'listen'], ['music'])).toEqual([
      'music',
      'audio',
      'listen'
    ])
  })
})

describe('enrichMemoryClues', () => {
  it('music domain -> song + recall-oriented English keywords', () => {
    expect(
      enrichMemoryClues({
        title: 'NetEase Cloud Music',
        url: 'https://music.163.com/#/song?id=1',
        domain: 'music.163.com'
      })
    ).toEqual({
      tags: ['song'],
      keywords: expect.arrayContaining(['music', 'listen', 'audio', 'song', 'playlist', 'track']),
      entities: []
    })
  })

  it('YouTube -> video（不再标 song）+ watch keywords', () => {
    const result = enrichMemoryClues({
      title: 'Lo-fi beats',
      url: 'https://www.youtube.com/watch?v=abc',
      domain: 'youtube.com'
    })
    expect(result.tags).toContain('video')
    expect(result.tags).not.toContain('song')
    expect(result.keywords).toEqual(expect.arrayContaining(['video', 'youtube', 'watch', 'clip']))
  })

  it('YouTube bookmark keeps video tags without topic/entity seed keywords', () => {
    const result = enrichMemoryClues({
      title: 'Why Hitler still casts a shadow after 80 years - BBC News',
      url: 'https://www.youtube.com/watch?v=hitler',
      domain: 'youtube.com'
    })
    expect(result.tags).toEqual(['video'])
    expect(result.entities).toEqual([])
    expect(result.keywords).not.toEqual(expect.arrayContaining(['wwii', 'Hitler', 'BBC']))
    expect(result.keywords).toEqual(expect.arrayContaining(['video', 'youtube', 'watch']))
  })

  it('city title does not invent economy topic keywords', () => {
    const result = enrichMemoryClues({
      title: 'Will Changchun become a bankrupt capital city as growth slows?',
      url: 'https://www.youtube.com/watch?v=_weXNUQ5NS4',
      domain: 'www.youtube.com'
    })
    expect(result.tags).toContain('video')
    expect(result.entities).toEqual([])
    expect(result.keywords).not.toEqual(expect.arrayContaining(['economy', 'Changchun']))
  })

  it('GitHub -> code + repo keywords', () => {
    const result = enrichMemoryClues({
      title: 'yiveno',
      url: 'https://github.com/cqw/yiveno',
      domain: 'github.com'
    })
    expect(result.tags).toContain('code')
    expect(result.keywords).toEqual(
      expect.arrayContaining(['code', 'repo', 'snippet', 'repository'])
    )
  })

  it('MDN docs -> article + guide keywords', () => {
    const result = enrichMemoryClues({
      title: 'IndexedDB API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
      domain: 'developer.mozilla.org'
    })
    expect(result.tags).toContain('article')
    expect(result.keywords).toEqual(
      expect.arrayContaining(['docs', 'tutorial', 'guide', 'reference'])
    )
  })

  it('title contains tutorial -> tutorial + guide keywords', () => {
    const result = enrichMemoryClues({
      title: 'Vue 3 Composition API tutorial',
      text: 'A step-by-step guide for beginners.'
    })
    expect(result.tags).toContain('article')
    expect(result.keywords).toEqual(expect.arrayContaining(['tutorial', 'guide']))
  })

  it('text contains auth -> auth keywords', () => {
    const result = enrichMemoryClues({
      title: 'OAuth notes',
      text: 'How authentication works with JWT tokens.'
    })
    expect(result.keywords).toEqual(expect.arrayContaining(['auth', 'authentication']))
  })

  it('body contains poem → poem tag; no entity allowlist', () => {
    const result = enrichMemoryClues({
      title: 'Li Bai poem',
      text: 'This is a poem by Li Bai. It mentions moon and home.'
    })
    expect(result.tags).toContain('poem')
    expect(result.entities).toEqual([])
    expect(result.keywords).toEqual(expect.arrayContaining(['poem']))
    expect(result.keywords).not.toContain('Li Bai')
  })

  it('proper names in title are not rule-enriched into entities', () => {
    const result = enrichMemoryClues({
      title: 'Tang poetry',
      text: 'Moonlight by the bed. A poem written by Li Bai.'
    })
    expect(result.entities).toEqual([])
    expect(result.keywords).not.toContain('Li Bai')
  })

  it('GitHub bookmark gets code tag from domain', () => {
    const result = enrichMemoryClues({
      title: 'yiveno',
      url: 'https://github.com/cqw/yiveno',
      domain: 'github.com'
    })
    expect(result.tags).toContain('code')
  })

  it('generic page wording does not over-tag as page', () => {
    const result = enrichMemoryClues({
      title: 'A generic web page title'
    })
    expect(result.tags).not.toContain('page')
  })
})

describe('create-memory-item enrichment', () => {
  const baseContext = {
    ownerId: '11111111-1111-4111-8111-111111111111',
    sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
    now: () => '2026-07-22T06:00:00.000Z'
  }

  it('creating bookmark auto-fills tags/keywords', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'NetEase Cloud Music',
        url: 'https://music.163.com/'
      }
    })
    expect(item.clues.tags).toContain('song')
    expect(item.clues.keywords).toEqual(expect.arrayContaining(['music', 'song', 'listen']))
  })

  it('creating excerpt detects poem type without entity allowlist', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Li Bai poem about the moon',
        sourceUrl: 'https://poem.example/li',
        pageTitle: 'poem'
      }
    })
    expect(item.clues.tags).toContain('poem')
    expect(item.clues.entities).toEqual([])
  })

  it('caller-provided tags merge with enrichment tags', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Custom bookmark',
        url: 'https://music.163.com/x'
      },
      clues: { tags: ['favorite'] }
    })
    expect(item.clues.tags).toEqual(expect.arrayContaining(['favorite', 'song']))
  })
})

describe('mergeEnrichmentIntoMemoryItem', () => {
  const baseContext = {
    ownerId: '11111111-1111-4111-8111-111111111111',
    sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
    now: () => '2026-07-22T06:00:00.000Z'
  }

  it('legacy item without tags backfills song without touching updatedAt', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'NetEase Cloud Music',
        url: 'https://music.163.com/'
      }
    })
    // 模拟 enrichment 上线前写入的旧数据
    const legacy = {
      ...item,
      clues: {
        ...item.clues,
        tags: [],
        keywords: [],
        entities: []
      }
    }
    const merged = mergeEnrichmentIntoMemoryItem(legacy)
    expect(merged.changed).toBe(true)
    expect(merged.item.clues.tags).toContain('song')
    expect(merged.item.updatedAt).toBe(legacy.updatedAt)
  })

  it('already enriched item keeps changed=false', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'NetEase Cloud Music',
        url: 'https://music.163.com/'
      }
    })
    const merged = mergeEnrichmentIntoMemoryItem(item)
    expect(merged.changed).toBe(false)
  })

  it('scrubs retired topic/entity seeds from legacy clues', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Why Hitler still casts a shadow - BBC News',
        url: 'https://www.youtube.com/watch?v=x'
      }
    })
    const polluted = {
      ...item,
      clues: {
        ...item.clues,
        keywords: mergeUniqueStrings(item.clues.keywords, [
          'wwii',
          'world war ii',
          'Hitler',
          'BBC'
        ]),
        entities: ['Hitler', 'BBC']
      }
    }
    const merged = mergeEnrichmentIntoMemoryItem(polluted)
    expect(merged.changed).toBe(true)
    expect(merged.item.clues.entities).toEqual([])
    expect(merged.item.clues.keywords).not.toEqual(
      expect.arrayContaining(['wwii', 'Hitler', 'BBC', 'world war ii'])
    )
    expect(merged.item.clues.keywords).toEqual(expect.arrayContaining(['video', 'youtube']))
  })
})
