/**
 * 冻结探针评测夹具（纯数据）：精选语料 → items + cases。
 * 供 extension `recall/eval/fixtures` 落盘；不含 Chrome / 召回执行。
 */

import { resolveProbeCorpora, type RecallProbePersonaId } from '../corpus/index'
import type { ProbeClueType } from '../corpus/types'
import { buildProbeBatchCasePlan } from '../run/case-plan'

/** 夹具内一条可还原为 MemoryItem 的种子。 */
export type ProbeGeneratedFixtureItem = {
  key: string
  kind: 'bookmark' | 'excerpt'
  persona: RecallProbePersonaId
  title: string
  url: string
  daysAgo: number
  note?: string
  selectedText?: string
}

/** 夹具内一条跑分用例。 */
export type ProbeGeneratedFixtureCase = {
  caseId: string
  clue: string
  clueType: ProbeClueType
  expectedKey: string
  persona: RecallProbePersonaId
  source: 'curated'
  kind: 'bookmark' | 'excerpt'
}

/** 基线（由 extension 离线跑分写入；刷新见 refreshHint）。 */
export type ProbeGeneratedFixtureBaseline = {
  /** top1 / judged */
  top1Rate: number
  /** (top1+in_topk) / judged */
  inTop3Rate: number
  judged: number
}

export type ProbeGeneratedFixture = {
  meta: {
    /** 文件命名用稳定 id */
    id: string
    version: 1
    generatedNote: string
    personas: readonly RecallProbePersonaId[]
    fillerSeed: number
    /** 如何刷新本夹具与基线 */
    refreshHint: string
    baseline: ProbeGeneratedFixtureBaseline
  }
  items: ProbeGeneratedFixtureItem[]
  cases: ProbeGeneratedFixtureCase[]
}

export type BuildProbeGeneratedFixtureInput = {
  personas?: readonly RecallProbePersonaId[]
  /** 写入 meta；基线可由调用方覆写 */
  baseline: ProbeGeneratedFixtureBaseline
  fillerSeed?: number
  id?: string
}

/**
 * 仅精选语料（diversity=0）：确定性、体积可控，适合 CI 冻结夹具。
 */
export function buildProbeGeneratedFixture(
  input: BuildProbeGeneratedFixtureInput
): ProbeGeneratedFixture {
  const personas = input.personas ?? (['researcher'] as const)
  const fillerSeed = input.fillerSeed ?? 20260906
  const corpora = resolveProbeCorpora(personas)
  const items: ProbeGeneratedFixtureItem[] = []

  for (const corpus of corpora) {
    for (const bm of corpus.bookmarks) {
      items.push({
        key: bm.key,
        kind: 'bookmark',
        persona: corpus.persona,
        title: bm.title,
        url: bm.url,
        daysAgo: bm.daysAgo,
        ...(bm.note ? { note: bm.note } : {})
      })
    }
    for (const ex of corpus.excerpts) {
      items.push({
        key: ex.key,
        kind: 'excerpt',
        persona: corpus.persona,
        title: ex.pageTitle,
        url: ex.sourceUrl,
        daysAgo: ex.daysAgo,
        selectedText: ex.selectedText,
        ...(ex.note ? { note: ex.note } : {})
      })
    }
  }

  const plan = buildProbeBatchCasePlan({
    personas,
    fillerSeed,
    diversityBookmarkCount: 0,
    diversityExcerptCount: 0,
    includeNegatives: false
  })

  const cases: ProbeGeneratedFixtureCase[] = plan
    .filter(row => row.source === 'curated' && row.expectedKey.length > 0)
    .map(row => ({
      caseId: row.caseId,
      clue: row.clue,
      clueType: row.clueType,
      expectedKey: row.expectedKey,
      persona: row.persona,
      source: 'curated' as const,
      kind: row.kind === 'excerpt' ? 'excerpt' : 'bookmark'
    }))

  return {
    meta: {
      id: input.id ?? 'probe-generated-curated-researcher-v1',
      version: 1,
      generatedNote:
        '由 @yiveno/probe buildProbeGeneratedFixture 生成；仅精选、无 diversity/负例，供 CI 关键词路径门禁。',
      personas,
      fillerSeed,
      refreshHint:
        'cd extension && bun run probe-eval:export-fixture（重写 JSON 基线）后跑 vitest probe-generated-eval',
      baseline: input.baseline
    },
    items,
    cases
  }
}
