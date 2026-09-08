/**
 * 扩展画像语料包：精选条数、多样性可生成、suggestedClues 非空。
 * 不进召回 runtime；仅保证 seeder 夹具完整。
 */

import { describe, expect, it } from 'vitest'

import {
  RECALL_PROBE_DEFAULT_PERSONAS,
  RECALL_PROBE_PERSONA_ORDER,
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds,
  resolveProbeCorpora,
  type RecallProbePersonaId
} from '../index'

const EXTENDED: readonly RecallProbePersonaId[] = ['student', 'knowledge_worker']

describe('recall-probe extended personas', () => {
  it('默认种库仍为质量轮三画像', () => {
    expect([...RECALL_PROBE_DEFAULT_PERSONAS]).toEqual(['researcher', 'creator', 'developer'])
    expect(RECALL_PROBE_PERSONA_ORDER).toContain('student')
    expect(RECALL_PROBE_PERSONA_ORDER).toContain('knowledge_worker')
  })

  it.each(EXTENDED)('%s 精选包：书签/摘录齐全且线索为英语口语', persona => {
    const [corpus] = resolveProbeCorpora([persona])
    expect(corpus).toBeDefined()
    expect(corpus!.persona).toBe(persona)
    expect(corpus!.bookmarks.length).toBeGreaterThanOrEqual(8)
    expect(corpus!.excerpts.length).toBeGreaterThanOrEqual(5)
    for (const bm of corpus!.bookmarks) {
      expect(bm.suggestedClues.length).toBeGreaterThan(0)
      expect(bm.title.length).toBeGreaterThan(0)
      expect(bm.url.startsWith('http')).toBe(true)
    }
    for (const ex of corpus!.excerpts) {
      expect(ex.suggestedClues.length).toBeGreaterThan(0)
      expect(ex.selectedText.length).toBeGreaterThan(20)
    }
  })

  it.each(EXTENDED)('%s diversity 生成器可复现且不抛错', persona => {
    const bookmarks = buildDiversityBookmarkSeeds(persona, 12)
    const excerpts = buildDiversityExcerptSeeds(persona, 8)
    expect(bookmarks).toHaveLength(12)
    expect(excerpts).toHaveLength(8)
    expect(bookmarks[0]!.key).toContain(persona)
    expect(excerpts[0]!.key).toContain(persona)
  })
})
