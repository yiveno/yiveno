/**
 * 混淆组：消歧线索组内唯一；成员与元信息对齐。
 */

import { describe, expect, it } from 'vitest'

import {
  buildClusterBookmarkSeeds,
  buildClusterExcerptSeeds,
  getClusterMemberDisambiguationClue,
  listProbeClusters
} from './clusters'
import type { RecallProbePersonaId } from './types'

const PERSONAS: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer',
  'student',
  'knowledge_worker'
]

const SEEDS = [7, 99] as const

describe('cluster disambiguation uniqueness', () => {
  it.each(PERSONAS)('%s：≥2 seed × 书签/摘录组消歧文本两两不同', persona => {
    for (const seed of SEEDS) {
      const bookmarks = buildClusterBookmarkSeeds(persona, 3, { seed })
      const byCluster = new Map<string, string[]>()
      for (const bm of bookmarks) {
        const clusterId = bm.key.replace(/-\d+$/, '')
        const disambig = getClusterMemberDisambiguationClue(bm)
        expect(disambig).toBeDefined()
        const list = byCluster.get(clusterId) ?? []
        list.push(disambig!.text)
        byCluster.set(clusterId, list)
      }
      for (const texts of byCluster.values()) {
        expect(texts.length).toBeGreaterThanOrEqual(3)
        expect(new Set(texts).size).toBe(texts.length)
      }

      const excerpts = buildClusterExcerptSeeds(persona, 2, { seed })
      const byEx = new Map<string, string[]>()
      for (const ex of excerpts) {
        const clusterId = ex.key.replace(/-\d+$/, '')
        const disambig = getClusterMemberDisambiguationClue(ex)
        expect(disambig).toBeDefined()
        const list = byEx.get(clusterId) ?? []
        list.push(disambig!.text)
        byEx.set(clusterId, list)
      }
      for (const texts of byEx.values()) {
        expect(new Set(texts).size).toBe(texts.length)
      }
    }
  })

  it('listProbeClusters 与成员 keys 对齐', () => {
    const seed = 42
    const metas = listProbeClusters(['developer'], {
      seed,
      bookmarkClusterCount: 2,
      excerptClusterCount: 1
    })
    const bookmarks = buildClusterBookmarkSeeds('developer', 2, { seed })
    const bookmarkKeys = new Set(bookmarks.map(b => b.key))
    for (const meta of metas.filter(m => m.kind === 'bookmark')) {
      expect(meta.memberKeys.every(k => bookmarkKeys.has(k))).toBe(true)
      expect(meta.preferredKey).toBe(meta.memberKeys[0])
    }
  })

  it('成员附注无脚手架后缀；摘录正文无 (cluster …) 后缀', () => {
    const rows = buildClusterBookmarkSeeds('researcher', 2, { seed: 3 })
    for (const row of rows) {
      expect(row.note ?? '').not.toMatch(/· cluster \d+ member \d+/i)
    }
    const excerpts = buildClusterExcerptSeeds('creator', 2, { seed: 3 })
    for (const row of excerpts) {
      expect(row.selectedText).not.toMatch(/\(cluster \d+ m\d+\)/i)
      expect(row.note ?? '').not.toMatch(/· cluster \d+ member \d+/i)
    }
  })
})
