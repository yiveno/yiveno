/**
 * DEV 召回探针语料共享类型（仅 seeder / 夹具；禁止进召回 runtime）。
 */

/** 线索类型（生成即标注）。 */
export type ProbeClueType =
  | 'verbatim' // 直接引用标题/主题词
  | 'paraphrase' // 改述型
  | 'associative' // 仅保存场景/用途，零内容词重叠
  | 'temporal' // 以时间表达为主区分
  | 'note' // 指向条目附注
  | 'ambiguous' // 模糊指代（精选仍单条 expected；cluster 可集合判定）

/** 带类型标注的线索。 */
export type ProbeTypedClue = {
  text: string
  type: ProbeClueType
}

/** seed 层角色；缺省即 target。不进 MemoryItem。 */
export type ProbeSeedRole = 'target' | 'distractor'

export type RecallProbeBookmarkSeed = {
  /** 稳定键，便于日志与探针对照 */
  key: string
  title: string
  url: string
  /** 相对「今天」的天数（负=过去；实现侧按过去天数用） */
  daysAgo: number
  note?: string
  /** 英语口语线索（期望邻域命中本条）；噪声可为空 */
  clues: ProbeTypedClue[]
  /** 缺省 target；noise 一律 distractor */
  role?: ProbeSeedRole
}

export type RecallProbeExcerptSeed = {
  key: string
  pageTitle: string
  sourceUrl: string
  selectedText: string
  daysAgo: number
  note?: string
  clues: ProbeTypedClue[]
  role?: ProbeSeedRole
}

export type RecallProbePersonaId =
  | 'researcher' // 跨来源研究者（首发优先）
  | 'creator' // 创作者 / 设计研究者
  | 'developer' // 开发者 / PM
  | 'student' // 学生 / 终身学习者（扩展覆盖）
  | 'knowledge_worker' // 知识工作者 / 非工程职场（扩展覆盖）

export type RecallProbePersonaCorpus = {
  persona: RecallProbePersonaId
  label: string
  bookmarks: RecallProbeBookmarkSeed[]
  excerpts: RecallProbeExcerptSeed[]
}
