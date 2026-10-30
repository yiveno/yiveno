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
  it('标题含 music → song tag（不靠 host 表）', () => {
    expect(
      enrichMemoryClues({
        title: 'NetEase Cloud Music',
        url: 'https://music.163.com/#/song?id=1',
        domain: 'music.163.com'
      })
    ).toEqual({
      tags: ['song'],
      keywords: ['song'],
      entities: []
    })
  })

  it('仅 YouTube host、标题无类型词 → 不钉 video', () => {
    const result = enrichMemoryClues({
      title: 'Lo-fi beats',
      url: 'https://www.youtube.com/watch?v=abc',
      domain: 'youtube.com'
    })
    expect(result.tags).not.toContain('video')
    expect(result.tags).not.toContain('song')
    expect(result.keywords).toEqual([])
  })

  it('标题仅含 clip 不打 video（clueOnly；防 diversity 假阳性）', () => {
    const result = enrichMemoryClues({
      title: 'Perf checklist: clip 1201',
      text: 'Retries without a stable request key',
      url: 'https://linear.app/blog/x',
      domain: 'linear.app'
    })
    expect(result.tags).not.toContain('video')
    expect(result.keywords).not.toEqual(expect.arrayContaining(['video', 'youtube']))
  })

  it('merge 会 scrub 旧版 clip→video 误标（非视频站）', () => {
    const item = createTextExcerptMemoryItem({
      ownerId: '11111111-1111-4111-8111-111111111111',
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: {
        selectedText: 'Retries without a stable request key',
        sourceUrl: 'https://linear.app/blog/x',
        pageTitle: 'Perf checklist: clip 1201',
        domain: 'linear.app'
      },
      clues: {
        tags: ['video'],
        keywords: ['video', 'youtube', 'watch', 'clip', 'retries']
      }
    })
    // 构造函数会再 enrich；强制写回旧误标以模拟存量
    const stale = {
      ...item,
      clues: {
        ...item.clues,
        tags: ['video'],
        keywords: ['video', 'youtube', 'watch', 'clip', 'retries']
      }
    }
    const { item: merged, changed } = mergeEnrichmentIntoMemoryItem(stale)
    expect(changed).toBe(true)
    expect(merged.clues.tags).not.toContain('video')
    expect(merged.clues.keywords).not.toEqual(expect.arrayContaining(['video', 'youtube', 'watch']))
    expect(merged.clues.keywords).toEqual(expect.arrayContaining(['retries']))
  })

  it('无类型词面时不发明 video/topic/entity', () => {
    const result = enrichMemoryClues({
      title: 'Why Hitler still casts a shadow after 80 years - BBC News',
      url: 'https://www.youtube.com/watch?v=hitler',
      domain: 'youtube.com'
    })
    expect(result.tags).toEqual([])
    expect(result.entities).toEqual([])
    expect(result.keywords).toEqual([])
    expect(result.keywords).not.toEqual(expect.arrayContaining(['wwii', 'Hitler', 'BBC']))
  })

  it('city title does not invent economy topic keywords', () => {
    const result = enrichMemoryClues({
      title: 'Will Changchun become a bankrupt capital city as growth slows?',
      url: 'https://www.youtube.com/watch?v=_weXNUQ5NS4',
      domain: 'www.youtube.com'
    })
    expect(result.tags).not.toContain('video')
    expect(result.entities).toEqual([])
    expect(result.keywords).not.toEqual(expect.arrayContaining(['economy', 'Changchun']))
  })

  it('仅 GitHub host、标题无类型词 → 不钉 code', () => {
    const result = enrichMemoryClues({
      title: 'yiveno',
      url: 'https://github.com/cqw/yiveno',
      domain: 'github.com'
    })
    expect(result.tags).not.toContain('code')
    expect(result.keywords).toEqual([])
  })

  it('标题含 code → code tag（不靠 host）', () => {
    const result = enrichMemoryClues({
      title: 'yiveno source code',
      url: 'https://github.com/cqw/yiveno',
      domain: 'github.com'
    })
    expect(result.tags).toEqual(['code'])
    expect(result.keywords).toEqual(['code'])
  })

  it('MDN 标题无类型词 → 不钉 article', () => {
    const result = enrichMemoryClues({
      title: 'IndexedDB API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
      domain: 'developer.mozilla.org'
    })
    expect(result.tags).not.toContain('article')
    expect(result.keywords).toEqual([])
  })

  it('title contains tutorial → article 类型词面打标；不灌 guide 同义 keyword', () => {
    const result = enrichMemoryClues({
      title: 'Vue 3 Composition API tutorial',
      text: 'A step-by-step guide for beginners.'
    })
    expect(result.tags).toContain('article')
    expect(result.keywords).toEqual(['article'])
    expect(result.keywords).not.toContain('guide')
  })

  it('text contains authentication → 不灌 auth 同义 keyword', () => {
    const result = enrichMemoryClues({
      title: 'OAuth notes',
      text: 'How authentication works with JWT tokens.'
    })
    expect(result.keywords).not.toEqual(expect.arrayContaining(['auth', 'authentication']))
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

  it('GitHub bookmark 无标题类型词 → 不钉 code', () => {
    const result = enrichMemoryClues({
      title: 'yiveno',
      url: 'https://github.com/cqw/yiveno',
      domain: 'github.com'
    })
    expect(result.tags).not.toContain('code')
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
    expect(item.clues.keywords).toEqual(expect.arrayContaining(['song']))
    expect(item.clues.keywords).not.toEqual(expect.arrayContaining(['music', 'listen']))
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

  it('caller-provided tags merge；无标题类型词不因 host 钉 song', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Custom bookmark',
        url: 'https://music.163.com/x'
      },
      clues: { tags: ['favorite'] }
    })
    expect(item.clues.tags).toEqual(expect.arrayContaining(['favorite', 'bookmark']))
    expect(item.clues.tags).not.toContain('song')
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
    // 无正文类型词：scrub 掉旧 host 钉的 video
    expect(merged.item.clues.tags).not.toContain('video')
    expect(merged.item.clues.keywords).not.toContain('video')
    expect(merged.item.clues.keywords).not.toContain('youtube')
  })

  it('scrub 旧 host 钉的 song tag（标题无类型词时）', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Custom bookmark',
        url: 'https://music.163.com/x'
      }
    })
    const stale = {
      ...item,
      clues: {
        ...item.clues,
        tags: ['song', 'bookmark'],
        keywords: ['song', 'music']
      }
    }
    const merged = mergeEnrichmentIntoMemoryItem(stale)
    expect(merged.changed).toBe(true)
    expect(merged.item.clues.tags).not.toContain('song')
    expect(merged.item.clues.tags).toContain('bookmark')
    expect(merged.item.clues.keywords).not.toContain('music')
  })
})
