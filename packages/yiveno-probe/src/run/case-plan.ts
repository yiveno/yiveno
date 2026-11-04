/**
 * 展开批量探针用例：精选 + diversity + cluster + 负例。
 * 纯函数；不读映射、不召回。
 */

import { listProbeFixtureCatalog } from '../catalog/fixture-catalog'
import {
  buildClusterBookmarkSeeds,
  buildClusterExcerptSeeds,
  listProbeClusters
} from '../corpus/clusters'
import { buildDiversityBookmarkSeeds, buildDiversityExcerptSeeds } from '../corpus/diversity'
import { PROBE_NEGATIVE_CLUES } from '../corpus/negatives'
import type { ProbeClueType, ProbeTypedClue, RecallProbePersonaId } from '../corpus/types'
import type { ProbeBatchCasePlan } from './types'

export type BuildProbeBatchCasePlanInput = {
  personas: readonly RecallProbePersonaId[]
  fillerSeed: number
  diversityBookmarkCount: number
  diversityExcerptCount: number
  clusterBookmarkCount?: number
  clusterExcerptCount?: number
  /** 是否纳入负例（默认 true） */
  includeNegatives?: boolean
}

/** 将总数按画像均分（余数给前列；与 seed-service 对齐）。 */
export function splitCountAcrossPersonas(
  total: number,
  personas: readonly RecallProbePersonaId[]
): number[] {
  if (personas.length === 0) {
    return []
  }
  const base = Math.floor(total / personas.length)
  const rem = total % personas.length
  return personas.map((_, index) => base + (index < rem ? 1 : 0))
}

function pushTypedClues(
  out: ProbeBatchCasePlan[],
  input: {
    expectedKey: string
    persona: RecallProbePersonaId
    source: ProbeBatchCasePlan['source']
    kind: ProbeBatchCasePlan['kind']
    label: string
    clues: readonly ProbeTypedClue[]
    clusterId?: string
  }
): void {
  input.clues.forEach((clue, clueIndex) => {
    const trimmed = clue.text.trim()
    if (!trimmed) {
      return
    }
    out.push({
      caseId: `${input.expectedKey}#${clueIndex}`,
      clue: trimmed,
      clueType: clue.type,
      expectedKey: input.expectedKey,
      persona: input.persona,
      source: input.source,
      kind: input.kind,
      label: input.label,
      clueIndex,
      ...(input.clusterId ? { clusterId: input.clusterId } : {})
    })
  })
}

/**
 * 构建 runner 用例表。
 */
export function buildProbeBatchCasePlan(input: BuildProbeBatchCasePlanInput): ProbeBatchCasePlan[] {
  const out: ProbeBatchCasePlan[] = []
  const personas =
    input.personas.length > 0 ? input.personas : (['researcher', 'creator', 'developer'] as const)

  const catalog = listProbeFixtureCatalog(personas)
  for (const row of catalog.rows) {
    pushTypedClues(out, {
      expectedKey: row.key,
      persona: row.persona,
      source: 'curated',
      kind: row.kind,
      label: row.label,
      clues: row.clues
    })
  }

  const bmSplits = splitCountAcrossPersonas(input.diversityBookmarkCount, personas)
  const exSplits = splitCountAcrossPersonas(input.diversityExcerptCount, personas)
  for (let i = 0; i < personas.length; i += 1) {
    const persona = personas[i]!
    const bookmarks = buildDiversityBookmarkSeeds(persona, bmSplits[i] ?? 0, {
      seed: input.fillerSeed
    })
    for (const bm of bookmarks) {
      if (bm.clues.length === 0) {
        continue
      }
      pushTypedClues(out, {
        expectedKey: bm.key,
        persona,
        source: 'diversity',
        kind: 'bookmark',
        label: bm.title,
        clues: bm.clues
      })
    }
    const excerpts = buildDiversityExcerptSeeds(persona, exSplits[i] ?? 0, {
      seed: input.fillerSeed
    })
    for (const ex of excerpts) {
      if (ex.clues.length === 0) {
        continue
      }
      pushTypedClues(out, {
        expectedKey: ex.key,
        persona,
        source: 'diversity',
        kind: 'excerpt',
        label: ex.pageTitle,
        clues: ex.clues
      })
    }
  }

  // cluster：成员仅消歧线索 → 单条 expected；组级 ambiguous → 集合判定
  const clusterBm = input.clusterBookmarkCount ?? 0
  const clusterEx = input.clusterExcerptCount ?? 0
  if (clusterBm > 0 || clusterEx > 0) {
    for (const persona of personas) {
      const bookmarks = buildClusterBookmarkSeeds(persona, clusterBm, {
        seed: input.fillerSeed
      })
      for (const bm of bookmarks) {
        const clusterId = bm.key.replace(/-\d+$/, '')
        const disambig = bm.clues[bm.clues.length - 1]
        if (!disambig) {
          continue
        }
        out.push({
          caseId: `${bm.key}#disambig`,
          clue: disambig.text,
          clueType: disambig.type,
          expectedKey: bm.key,
          persona,
          source: 'cluster',
          kind: 'bookmark',
          label: bm.title,
          clueIndex: bm.clues.length - 1,
          clusterId
        })
      }
      const excerpts = buildClusterExcerptSeeds(persona, clusterEx, {
        seed: input.fillerSeed
      })
      for (const ex of excerpts) {
        const clusterId = ex.key.replace(/-\d+$/, '')
        const disambig = ex.clues[ex.clues.length - 1]
        if (!disambig) {
          continue
        }
        out.push({
          caseId: `${ex.key}#disambig`,
          clue: disambig.text,
          clueType: disambig.type,
          expectedKey: ex.key,
          persona,
          source: 'cluster',
          kind: 'excerpt',
          label: ex.pageTitle,
          clueIndex: ex.clues.length - 1,
          clusterId
        })
      }
    }

    const metas = listProbeClusters(personas, {
      seed: input.fillerSeed,
      bookmarkClusterCount: clusterBm,
      excerptClusterCount: clusterEx
    })
    for (const meta of metas) {
      out.push({
        caseId: `${meta.clusterId}#ambiguous`,
        clue: meta.ambiguousClue.text,
        clueType: meta.ambiguousClue.type as ProbeClueType,
        expectedKey: meta.preferredKey,
        expectedKeys: meta.memberKeys,
        preferredKey: meta.preferredKey,
        clusterId: meta.clusterId,
        persona: meta.persona,
        source: 'cluster',
        kind: meta.kind,
        label: `cluster ${meta.clusterId}`,
        clueIndex: 0
      })
    }
  }

  if (input.includeNegatives !== false) {
    const personaSet = new Set(personas)
    for (const neg of PROBE_NEGATIVE_CLUES) {
      if (!personaSet.has(neg.persona)) {
        continue
      }
      out.push({
        caseId: neg.key,
        clue: neg.clue,
        clueType: 'associative',
        expectedKey: '',
        persona: neg.persona,
        source: 'negative',
        kind: 'negative',
        label: neg.key,
        clueIndex: 0
      })
    }
  }

  return out
}
