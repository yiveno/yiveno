/**
 * DEV：列出探针精选夹具目录（不写库）。
 * 语料本体在 `@yiveno/probe`；本文件仅加 DEV 门禁。
 */

import {
  listProbeFixtureCatalog as listFromProbe,
  type ProbeFixtureCatalog,
  type ProbeFixtureClueRow,
  type RecallProbePersonaId
} from '@yiveno/probe'

export type { ProbeFixtureCatalog, ProbeFixtureClueRow }

/** 展开全部（或指定）画像的精选 suggestedClues。 */
export function listProbeFixtureCatalog(
  personas?: readonly RecallProbePersonaId[]
): ProbeFixtureCatalog {
  if (!import.meta.env.DEV) {
    throw new Error('listProbeFixtureCatalog 仅允许 DEV 构建')
  }
  return personas === undefined ? listFromProbe() : listFromProbe(personas)
}
