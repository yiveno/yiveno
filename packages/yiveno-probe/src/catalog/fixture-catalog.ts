/**
 * 探针精选夹具目录（不写库；纯展开语料 clues）。
 */

import {
  RECALL_PROBE_DEFAULT_PERSONAS,
  RECALL_PROBE_PERSONA_ORDER,
  resolveProbeCorpora,
  type RecallProbePersonaId
} from '../corpus/index'
import type { ProbeTypedClue } from '../corpus/types'

export type ProbeFixtureClueRow = {
  persona: RecallProbePersonaId
  kind: 'bookmark' | 'excerpt'
  key: string
  label: string
  clues: ProbeTypedClue[]
}

export type ProbeFixtureCatalog = {
  defaultPersonas: readonly RecallProbePersonaId[]
  personaOrder: readonly RecallProbePersonaId[]
  rows: ProbeFixtureClueRow[]
}

/** 展开全部（或指定）画像的精选 clues。 */
export function listProbeFixtureCatalog(
  personas: readonly RecallProbePersonaId[] = RECALL_PROBE_PERSONA_ORDER
): ProbeFixtureCatalog {
  const corpora = resolveProbeCorpora(personas)
  const rows: ProbeFixtureClueRow[] = []

  for (const corpus of corpora) {
    for (const bm of corpus.bookmarks) {
      rows.push({
        persona: corpus.persona,
        kind: 'bookmark',
        key: bm.key,
        label: bm.title,
        clues: [...bm.clues]
      })
    }
    for (const ex of corpus.excerpts) {
      rows.push({
        persona: corpus.persona,
        kind: 'excerpt',
        key: ex.key,
        label: ex.pageTitle,
        clues: [...ex.clues]
      })
    }
  }

  return {
    defaultPersonas: RECALL_PROBE_DEFAULT_PERSONAS,
    personaOrder: RECALL_PROBE_PERSONA_ORDER,
    rows
  }
}
