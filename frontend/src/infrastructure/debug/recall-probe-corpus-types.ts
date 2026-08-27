/**
 * DEV 召回探针语料共享类型（仅 seeder / 夹具；禁止进召回 runtime）。
 */

export type RecallProbeBookmarkSeed = {
  /** 稳定键，便于日志与探针对照 */
  key: string
  title: string
  url: string
  /** 相对「今天」的天数（负=过去；实现侧按过去天数用） */
  daysAgo: number
  note?: string
  /** 英语口语线索（期望邻域命中本条）；噪声可为空 */
  suggestedClues: string[]
}

export type RecallProbeExcerptSeed = {
  key: string
  pageTitle: string
  sourceUrl: string
  selectedText: string
  daysAgo: number
  note?: string
  suggestedClues: string[]
}

export type RecallProbePersonaId = 'researcher' | 'creator' | 'developer'

export type RecallProbePersonaCorpus = {
  persona: RecallProbePersonaId
  label: string
  bookmarks: RecallProbeBookmarkSeed[]
  excerpts: RecallProbeExcerptSeed[]
}
