/**
 * 探针精选夹具目录（不写库；纯展开语料 suggestedClues）。
 */

import {
  RECALL_PROBE_DEFAULT_PERSONAS,
  RECALL_PROBE_PERSONA_ORDER,
  resolveProbeCorpora,
  type RecallProbePersonaId
} from '../corpus/index'

export type ProbeFixtureClueRow = {
  persona: RecallProbePersonaId
  kind: 'bookmark' | 'excerpt'
  key: string
  label: string
  suggestedClues: string[]
}

export type ProbeFixtureCatalog = {
  defaultPersonas: readonly RecallProbePersonaId[]
  personaOrder: readonly RecallProbePersonaId[]
  rows: ProbeFixtureClueRow[]
}

/** 展开全部（或指定）画像的精选 suggestedClues。 */
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
        suggestedClues: [...bm.suggestedClues]
      })
    }
    for (const ex of corpus.excerpts) {
      rows.push({
        persona: corpus.persona,
        kind: 'excerpt',
        key: ex.key,
        label: ex.pageTitle,
        suggestedClues: [...ex.suggestedClues]
      })
    }
  }

  return {
    defaultPersonas: RECALL_PROBE_DEFAULT_PERSONAS,
    personaOrder: RECALL_PROBE_PERSONA_ORDER,
    rows
  }
}
