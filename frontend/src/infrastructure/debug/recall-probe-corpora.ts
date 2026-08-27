/**
 * DEV 召回探针语料索引（按产品首发分群优先级）。
 */

import { CREATOR_PROBE_CORPUS } from '@/infrastructure/debug/recall-probe-corpus-creator'
import { DEVELOPER_PROBE_CORPUS } from '@/infrastructure/debug/recall-probe-corpus-developer'
import { RESEARCHER_PROBE_CORPUS } from '@/infrastructure/debug/recall-probe-corpus-researcher'
import type {
  RecallProbePersonaCorpus,
  RecallProbePersonaId
} from '@/infrastructure/debug/recall-probe-corpus-types'

/** 首发优先：研究者 → 创作者 → 开发者。 */
export const RECALL_PROBE_PERSONA_ORDER: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer'
]

const BY_PERSONA: Record<RecallProbePersonaId, RecallProbePersonaCorpus> = {
  researcher: RESEARCHER_PROBE_CORPUS,
  creator: CREATOR_PROBE_CORPUS,
  developer: DEVELOPER_PROBE_CORPUS
}

export function resolveProbeCorpora(
  personas: readonly RecallProbePersonaId[]
): RecallProbePersonaCorpus[] {
  const ordered = RECALL_PROBE_PERSONA_ORDER.filter(id => personas.includes(id))
  return ordered.map(id => BY_PERSONA[id])
}
