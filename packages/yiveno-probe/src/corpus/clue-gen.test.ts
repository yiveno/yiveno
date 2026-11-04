/**
 * clue-gen 重叠红线 + 独立 rng 流不污染内容。
 */

import { describe, expect, it } from 'vitest'

import { contentWordIntersection, generateDiversityClues, generateForcedClue } from './clue-gen'
import {
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds,
  DIVERSITY_PACKS
} from './diversity'
import type { RecallProbePersonaId } from './types'

const PERSONAS: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer',
  'student',
  'knowledge_worker'
]

describe('clue-gen overlap red lines', () => {
  it.each(PERSONAS)(
    '%s：≥50 条 associative/temporal 零内容词重叠；paraphrase 无完整 subject/note',
    persona => {
      const pack = DIVERSITY_PACKS[persona]
      for (let i = 0; i < 50; i += 1) {
        const subject = pack.subjects[i % pack.subjects.length]!
        const note = `${pack.noteTemplates[i % pack.noteTemplates.length]!} (#${i + 1})`
        const title = `${pack.titlePrefixes[i % pack.titlePrefixes.length]!} ${subject}`
        const meta = {
          persona,
          kind: 'bookmark' as const,
          index: i,
          seed: 4242,
          title,
          subject,
          note,
          daysAgo: 10 + (i % 100),
          host: pack.hosts[i % pack.hosts.length],
          sceneFragments: pack.sceneFragments
        }
        const associative = generateForcedClue(meta, 'associative')
        expect(contentWordIntersection(associative.text, `${title} ${subject} ${note}`)).toEqual([])

        const temporal = generateForcedClue({ ...meta, index: i + 1000 }, 'temporal')
        expect(contentWordIntersection(temporal.text, `${title} ${subject} ${note}`)).toEqual([])

        const paraphrase = generateForcedClue({ ...meta, index: i + 2000 }, 'paraphrase')
        expect(paraphrase.text.toLowerCase().includes(subject.toLowerCase())).toBe(false)
        expect(paraphrase.text.includes(note)).toBe(false)
      }
    }
  )

  it('每条 diversity 至少 1 条线索', () => {
    for (const persona of PERSONAS) {
      const bookmarks = buildDiversityBookmarkSeeds(persona, 40, { seed: 7 })
      const excerpts = buildDiversityExcerptSeeds(persona, 40, { seed: 7 })
      expect(bookmarks.every(b => b.clues.length >= 1)).toBe(true)
      expect(excerpts.every(e => e.clues.length >= 1)).toBe(true)
    }
  })

  it('同 seed 下内容字段与线索均可复现', () => {
    const a = buildDiversityBookmarkSeeds('developer', 16, { seed: 99 })
    const b = buildDiversityBookmarkSeeds('developer', 16, { seed: 99 })
    expect(a.map(x => `${x.title}|${x.url}|${x.daysAgo}|${x.note ?? ''}`)).toEqual(
      b.map(x => `${x.title}|${x.url}|${x.daysAgo}|${x.note ?? ''}`)
    )
    expect(a.map(x => JSON.stringify(x.clues))).toEqual(b.map(x => JSON.stringify(x.clues)))
  })

  it('generateDiversityClues 带 note 时含 note 型', () => {
    const pack = DIVERSITY_PACKS.researcher
    const clues = generateDiversityClues({
      persona: 'researcher',
      kind: 'bookmark',
      index: 3,
      seed: 1,
      title: 'Lab memo: attention metrics in newsrooms',
      subject: 'attention metrics in newsrooms',
      note: 'cite in weekly research digest (#4)',
      daysAgo: 12,
      host: pack.hosts[0],
      sceneFragments: pack.sceneFragments
    })
    expect(clues.some(c => c.type === 'note')).toBe(true)
    expect(clues.length).toBeGreaterThanOrEqual(2)
  })
})
