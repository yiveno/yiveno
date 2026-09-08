import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'
import {
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds,
  buildNoiseBookmarkSeeds,
  buildNoiseExcerptSeeds,
  resolveProbeCorpora
} from '@yiveno/probe'
import {
  PROBE_OMNIBOX_SMOKE_CASES,
  type ProbeOmniboxSmokeCase
} from '@/dev/probe/recall-probe-omnibox-smoke'

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const profileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function buildDefaultQualityProbeItems() {
  const personas = ['researcher', 'creator', 'developer'] as const
  const items = []
  for (const corpus of resolveProbeCorpora([...personas])) {
    for (const bm of corpus.bookmarks) {
      items.push(
        createBookmarkMemoryItem({
          ownerId,
          sourceLocalProfileId: profileId,
          payload: { title: bm.title, url: bm.url },
          ...(bm.note ? { clues: { note: bm.note } } : {}),
          now: () => '2026-08-01T12:00:00.000Z'
        })
      )
    }
    for (const ex of corpus.excerpts) {
      items.push(
        createTextExcerptMemoryItem({
          ownerId,
          sourceLocalProfileId: profileId,
          payload: {
            pageTitle: ex.pageTitle,
            sourceUrl: ex.sourceUrl,
            selectedText: ex.selectedText
          },
          ...(ex.note ? { clues: { note: ex.note } } : {}),
          now: () => '2026-08-01T12:00:00.000Z'
        })
      )
    }
  }
  for (const persona of personas) {
    for (const bm of buildDiversityBookmarkSeeds(persona, 117)) {
      items.push(
        createBookmarkMemoryItem({
          ownerId,
          sourceLocalProfileId: profileId,
          payload: { title: bm.title, url: bm.url },
          now: () => '2026-08-01T12:00:00.000Z'
        })
      )
    }
    for (const ex of buildDiversityExcerptSeeds(persona, 50)) {
      items.push(
        createTextExcerptMemoryItem({
          ownerId,
          sourceLocalProfileId: profileId,
          payload: {
            pageTitle: ex.pageTitle,
            sourceUrl: ex.sourceUrl,
            selectedText: ex.selectedText
          },
          now: () => '2026-08-01T12:00:00.000Z'
        })
      )
    }
  }
  for (const bm of buildNoiseBookmarkSeeds(400)) {
    items.push(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId: profileId,
        payload: { title: bm.title, url: bm.url },
        now: () => '2026-08-01T12:00:00.000Z'
      })
    )
  }
  for (const ex of buildNoiseExcerptSeeds(150)) {
    items.push(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId: profileId,
        payload: {
          pageTitle: ex.pageTitle,
          sourceUrl: ex.sourceUrl,
          selectedText: ex.selectedText
        },
        now: () => '2026-08-01T12:00:00.000Z'
      })
    )
  }
  return items
}

async function judgeSmokeCase(
  items: ReturnType<typeof buildDefaultQualityProbeItems>,
  spec: ProbeOmniboxSmokeCase
): Promise<boolean> {
  const understood = await understandRecallClue(spec.clue, {
    forceMode: 'lexical',
    nowMs: RECALL_EVAL_NOW_MS
  })
  const result = recallByKeywordWithParsedClue(items, spec.clue, {
    nowMs: RECALL_EVAL_NOW_MS,
    parsed: understood.parsed
  })
  const top = result.topPick?.item
  const title =
    top?.type === 'bookmark'
      ? top.payload.title
      : top?.type === 'text_excerpt'
        ? top.payload.pageTitle
        : null
  return (
    result.outcome === 'top_pick' &&
    Boolean(title?.toLowerCase().includes(spec.expectTitleIncludes.toLowerCase()))
  )
}

describe('recall-probe-omnibox-smoke', () => {
  it('默认质量档探针库：手测 §4.1–4.2 线索均可 Top1 命中', async () => {
    const items = buildDefaultQualityProbeItems()
    const failures: string[] = []
    for (const spec of PROBE_OMNIBOX_SMOKE_CASES) {
      const passed = await judgeSmokeCase(items, spec)
      if (!passed) {
        failures.push(spec.id)
      }
    }
    expect(failures, `失败 case: ${failures.join(', ')}`).toEqual([])
  })

  it('旧 eval 专用 token 在探针库上不应冒充通过（防文档混用）', async () => {
    const items = buildDefaultQualityProbeItems()
    const understood = await understandRecallClue('i18n:check', {
      forceMode: 'lexical',
      nowMs: RECALL_EVAL_NOW_MS
    })
    const result = recallByKeywordWithParsedClue(items, 'i18n:check', {
      nowMs: RECALL_EVAL_NOW_MS,
      parsed: understood.parsed
    })
    const top = result.topPick?.item
    const title = top?.type === 'bookmark' ? top.payload.title : top?.payload.pageTitle
    expect(title ?? '').not.toContain('i18n:check')
  })
})
