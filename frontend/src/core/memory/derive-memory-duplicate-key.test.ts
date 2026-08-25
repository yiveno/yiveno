import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  ENRICHMENT_REUSE_MIN_EXCERPT_CHARS,
  canonicalizeBookmarkDuplicateUrl,
  getEmbedReuseKey,
  getEnrichmentReuseKey,
  getMemoryFoldKey,
  isEligibleForEnrichmentReuse,
  serializeMemoryFoldKey
} from '@/core/memory/derive-memory-duplicate-key'

describe('derive-memory-duplicate-key', () => {
  it('书签：规范化完整 URL 作折叠 / enrichment / embed 键', () => {
    expect(canonicalizeBookmarkDuplicateUrl('https://www.Example.com/path/')).toBe(
      'https://example.com/path'
    )

    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'A', url: 'https://www.ai-bot.cn/' }
    })
    const key = serializeMemoryFoldKey(getMemoryFoldKey(item))
    expect(key).toBe('b:https://ai-bot.cn/')
    expect(getEnrichmentReuseKey(item)).toBe('enrich:b:https://ai-bot.cn/')
    expect(getEmbedReuseKey(item)).toBe('embed:b:https://ai-bot.cn/')
  })

  it('摘录：折叠与 enrichment 仅正文；embed 含 pageTitle + note', () => {
    const longText = 'x'.repeat(ENRICHMENT_REUSE_MIN_EXCERPT_CHARS)
    const a = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: longText,
        pageTitle: 'Page A',
        sourceUrl: 'https://a.example/1',
        domain: 'a.example'
      }
    })
    const b = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: longText,
        pageTitle: 'Page B',
        sourceUrl: 'https://b.example/2',
        domain: 'b.example'
      }
    })

    expect(serializeMemoryFoldKey(getMemoryFoldKey(a))).toBe(
      serializeMemoryFoldKey(getMemoryFoldKey(b))
    )
    expect(getEnrichmentReuseKey(a)).toBe(getEnrichmentReuseKey(b))
    expect(getEmbedReuseKey(a)).not.toBe(getEmbedReuseKey(b))
  })

  it('摘录 enrichment：过短或有 note 时不复用', () => {
    const short = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: 'too short',
        pageTitle: 'P',
        sourceUrl: 'https://a.example',
        domain: 'a.example'
      }
    })
    expect(isEligibleForEnrichmentReuse(short)).toBe(false)
    expect(getEnrichmentReuseKey(short)).toBeNull()

    const withNote = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: 'x'.repeat(ENRICHMENT_REUSE_MIN_EXCERPT_CHARS),
        pageTitle: 'P',
        sourceUrl: 'https://a.example',
        domain: 'a.example'
      },
      clues: { note: 'my note' }
    })
    expect(getEnrichmentReuseKey(withNote)).toBeNull()
  })
})
