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
        title: '网易云音乐',
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

  it('希特勒 YouTube 书签 → video + WWII 主题 + Hitler 实体', () => {
    const result = enrichMemoryClues({
      title: '希特勒死亡80年後 為何仍給世界帶來陰影？－ BBC News 中文',
      url: 'https://www.youtube.com/watch?v=hitler',
      domain: 'youtube.com'
    })
    expect(result.tags).toEqual(['video'])
    expect(result.entities).toEqual(expect.arrayContaining(['Hitler', 'BBC']))
    expect(result.keywords).toEqual(
      expect.arrayContaining(['video', 'wwii', 'world war ii', 'Hitler', 'BBC'])
    )
  })

  it('长春经济 YouTube 书签 → video + Changchun + economy 主题', () => {
    const result = enrichMemoryClues({
      title: '长春会成为第一座破产省会吗？九百万人口省会，正在失去增长能力｜尉遲大官人',
      url: 'https://www.youtube.com/watch?v=_weXNUQ5NS4',
      domain: 'www.youtube.com'
    })
    expect(result.tags).toContain('video')
    expect(result.entities).toContain('Changchun')
    expect(result.keywords).toEqual(
      expect.arrayContaining(['video', 'economy', 'city', 'growth', 'Changchun'])
    )
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

  it('body contains poem and Li Bai → poem + entity', () => {
    const result = enrichMemoryClues({
      title: 'Li Bai poem',
      text: 'This is a poem by Li Bai. It mentions moon and home.'
    })
    expect(result.tags).toContain('poem')
    expect(result.entities).toContain('Li Bai')
    expect(result.keywords).toEqual(expect.arrayContaining(['poem', 'Li Bai']))
  })

  it('body contains 李白 → entities canonical to Li Bai', () => {
    const result = enrichMemoryClues({
      title: '唐诗',
      text: '床前明月光。李白写的诗。'
    })
    // object type 可能因正文语言不同而未识别，但实体应 canonical 化
    expect(result.entities).toContain('Li Bai')
    expect(result.keywords).toContain('Li Bai')
  })

  it('GitHub bookmark gets code tag from domain', () => {
    const result = enrichMemoryClues({
      title: 'yiveno',
      url: 'https://github.com/cqw/yiveno',
      domain: 'github.com'
    })
    expect(result.tags).toContain('code')
  })

  it('不因「网页」二字滥打 page', () => {
    const result = enrichMemoryClues({
      title: '某个普通网页标题'
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

  it('创建书签时自动写入 tags/keywords', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '网易云音乐',
        url: 'https://music.163.com/'
      }
    })
    expect(item.clues.tags).toContain('song')
    expect(item.clues.keywords).toEqual(expect.arrayContaining(['music', 'song', 'listen']))
  })

  it('创建摘录时识别实体与类型', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Li Bai poem about the moon',
        sourceUrl: 'https://poem.example/li',
        pageTitle: 'poem'
      }
    })
    expect(item.clues.tags).toContain('poem')
    expect(item.clues.entities).toContain('Li Bai')
  })

  it('调用方传入的 tags 与 enrichment 合并', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '自定义',
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

  it('存量无 tags 时回填 song，且不改 updatedAt', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '网易云音乐',
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

  it('已 enrichment 过则 changed=false', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '网易云音乐',
        url: 'https://music.163.com/'
      }
    })
    const merged = mergeEnrichmentIntoMemoryItem(item)
    expect(merged.changed).toBe(false)
  })
})
