/**
 * 展开批量探针用例：精选目录全部 suggestedClues + 已种库 diversity 带线索条目。
 * 纯函数；不读映射、不召回。
 */

import { listProbeFixtureCatalog } from '../catalog/fixture-catalog'
import { buildDiversityBookmarkSeeds, buildDiversityExcerptSeeds } from '../corpus/diversity'
import type { RecallProbePersonaId } from '../corpus/types'
import type { ProbeBatchCasePlan } from './types'

export type BuildProbeBatchCasePlanInput = {
  personas: readonly RecallProbePersonaId[]
  fillerSeed: number
  diversityBookmarkCount: number
  diversityExcerptCount: number
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

function pushClues(
  out: ProbeBatchCasePlan[],
  input: {
    expectedKey: string
    persona: RecallProbePersonaId
    source: ProbeBatchCasePlan['source']
    kind: ProbeBatchCasePlan['kind']
    label: string
    suggestedClues: readonly string[]
  }
): void {
  input.suggestedClues.forEach((clue, clueIndex) => {
    const trimmed = clue.trim()
    if (!trimmed) {
      return
    }
    out.push({
      caseId: `${input.expectedKey}#${clueIndex}`,
      clue: trimmed,
      expectedKey: input.expectedKey,
      persona: input.persona,
      source: input.source,
      kind: input.kind,
      label: input.label,
      clueIndex
    })
  })
}

/**
 * 构建 runner 用例表。
 * - 精选：目录全部 suggestedClues
 * - diversity：按与种库相同的 fillerSeed / 均分规则重建，仅带线索条目
 * - noise：无线索，不纳入
 */
export function buildProbeBatchCasePlan(input: BuildProbeBatchCasePlanInput): ProbeBatchCasePlan[] {
  const out: ProbeBatchCasePlan[] = []
  const personas =
    input.personas.length > 0 ? input.personas : (['researcher', 'creator', 'developer'] as const)

  const catalog = listProbeFixtureCatalog(personas)
  for (const row of catalog.rows) {
    pushClues(out, {
      expectedKey: row.key,
      persona: row.persona,
      source: 'curated',
      kind: row.kind,
      label: row.label,
      suggestedClues: row.suggestedClues
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
      if (bm.suggestedClues.length === 0) {
        continue
      }
      pushClues(out, {
        expectedKey: bm.key,
        persona,
        source: 'diversity',
        kind: 'bookmark',
        label: bm.title,
        suggestedClues: bm.suggestedClues
      })
    }
    const excerpts = buildDiversityExcerptSeeds(persona, exSplits[i] ?? 0, {
      seed: input.fillerSeed
    })
    for (const ex of excerpts) {
      if (ex.suggestedClues.length === 0) {
        continue
      }
      pushClues(out, {
        expectedKey: ex.key,
        persona,
        source: 'diversity',
        kind: 'excerpt',
        label: ex.pageTitle,
        suggestedClues: ex.suggestedClues
      })
    }
  }

  return out
}
