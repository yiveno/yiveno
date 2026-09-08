/**
 * 召回探针语料索引（@yiveno/probe · 纯数据，无 Chrome / IDB）。
 */

import { CREATOR_PROBE_CORPUS } from './creator'
import { DEVELOPER_PROBE_CORPUS } from './developer'
import { KNOWLEDGE_WORKER_PROBE_CORPUS } from './knowledge-worker'
import { RESEARCHER_PROBE_CORPUS } from './researcher'
import { STUDENT_PROBE_CORPUS } from './student'
import type { RecallProbePersonaCorpus, RecallProbePersonaId } from './types'

export type {
  RecallProbeBookmarkSeed,
  RecallProbeExcerptSeed,
  RecallProbePersonaCorpus,
  RecallProbePersonaId
} from './types'

export { CREATOR_PROBE_CORPUS } from './creator'
export { DEVELOPER_PROBE_CORPUS } from './developer'
export { KNOWLEDGE_WORKER_PROBE_CORPUS } from './knowledge-worker'
export { RESEARCHER_PROBE_CORPUS } from './researcher'
export { STUDENT_PROBE_CORPUS } from './student'
export { buildDiversityBookmarkSeeds, buildDiversityExcerptSeeds } from './diversity'
export { buildNoiseBookmarkSeeds, buildNoiseExcerptSeeds } from './noise'
export { DEFAULT_PROBE_FILLER_SEED, createMulberry32, createSeededRng, mixSeed } from './prng'

/** 首发优先三画像，其后为学生 / 知识工作者扩展包。 */
export const RECALL_PROBE_PERSONA_ORDER: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer',
  'student',
  'knowledge_worker'
]

/** 质量轮默认种库（与 §5.11.1a 退出口径对齐；不含扩展画像）。 */
export const RECALL_PROBE_DEFAULT_PERSONAS: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer'
]

const BY_PERSONA: Record<RecallProbePersonaId, RecallProbePersonaCorpus> = {
  researcher: RESEARCHER_PROBE_CORPUS,
  creator: CREATOR_PROBE_CORPUS,
  developer: DEVELOPER_PROBE_CORPUS,
  student: STUDENT_PROBE_CORPUS,
  knowledge_worker: KNOWLEDGE_WORKER_PROBE_CORPUS
}

export function resolveProbeCorpora(
  personas: readonly RecallProbePersonaId[]
): RecallProbePersonaCorpus[] {
  const ordered = RECALL_PROBE_PERSONA_ORDER.filter(id => personas.includes(id))
  return ordered.map(id => BY_PERSONA[id])
}
