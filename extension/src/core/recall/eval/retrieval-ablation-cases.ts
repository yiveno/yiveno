/**
 * L2 召回消融用例：固定 `goldParsed`，禁止策略内重新 parse。
 *
 * 样本设计权威：`docs/audits/2026-10-L2召回消融-样本设计与实现差异.md`
 * - `labelConfidence=ambiguous`：金标可能争议，仍跑表但不做算法/模型结论。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import {
  RETRIEVAL_ABLATION_IDS,
  type RetrievalAblationItemId
} from '@/core/recall/eval/retrieval-ablation-ids'

export type RetrievalAblationGate = 'measure' | 'negative'

/** 场景标签（覆盖矩阵用）。 */
export type RetrievalAblationScenario =
  | 'keyword_anchor' // 词面强锚
  | 'paraphrase' // 同义改写
  | 'zero_overlap' // 零/近零词面
  | 'fuzzy_memory' // 模糊记忆（专名未必在库）
  | 'time_hard' // 时间硬筛
  | 'strong_distractor_hit' // 有正确目标，库内有强干扰
  | 'negative_orthogonal' // 正交负例（禁止某条进前 K）
  | 'negative_no_match' // 无匹配查询（库无正解；测误报）

/**
 * - hit：期望目标进入候选（用于 Recall@K / MRR / nDCG）
 * - miss：期望目标**不**进入前 K（负例；**不用** Recall@K 当质量分）
 */
export type RetrievalAblationExpectation =
  | { kind: 'hit'; expectedId: RetrievalAblationItemId }
  | { kind: 'miss'; expectedId: RetrievalAblationItemId; k?: number }

export interface RetrievalAblationCase {
  id: string
  /** 仅展示 / 拼 embedding 文本；不用于重新理解 */
  clueForDisplay: string
  /** 固定理解快照（所有策略共用） */
  goldParsed: ParsedRecallClue
  /**
   * 写入 Worker embed 的 clue 文本。
   * 默认由 runner 用 `buildClueEmbeddingText({ rawClue, parsed: goldParsed })`；
   * 显式给出时覆盖（便于对照生产拼接）。
   */
  clueEmbeddingText?: string
  expectation: RetrievalAblationExpectation
  gate: RetrievalAblationGate
  scenario: RetrievalAblationScenario
  /** 金标是否可能争议；ambiguous 不据此换模型/算法 */
  labelConfidence: 'clear' | 'ambiguous'
  /**
   * 金标复核状态。
   * - stable：常规 clear/ambiguous
   * - pending_review：标签暂维持，人工复核中；**禁止**因策略输出改标签
   */
  goldReviewStatus?: 'stable' | 'pending_review'
  /** 判定依据（预期目标为什么是这一条） */
  judgmentZh: string
  /** 歧义说明（仅 ambiguous） */
  labelAmbiguityZh?: string
  /** 短备注 */
  note: string
}

/** 昨天窗（相对消融 now=2026-07-25）。 */
const YESTERDAY_RANGE = {
  from: '2026-07-24T00:00:00.000Z',
  to: '2026-07-24T23:59:59.999Z',
  label: 'yesterday'
} as const

const OPPENHEIMER_PARSED: ParsedRecallClue = {
  raw: 'that Oppenheimer biopic writeup I bookmarked',
  objectTypes: ['video'],
  contentTerms: ['oppenheimer', 'biopic', 'writeup'],
  confidence: 'medium'
}

const ANXIOUS_LEAD_PARSED: ParsedRecallClue = {
  raw: 'that film where the lead actor looks anxious about the device',
  objectTypes: ['video'],
  // 故意避开 Manhattan / Cillian / Murphy / re-enactment / bomb（bomb 易撞 atomic 书签）
  contentTerms: ['film', 'lead', 'actor', 'anxious', 'device'],
  confidence: 'medium'
}

const YELLOWSTONE_PARSED: ParsedRecallClue = {
  raw: 'my Yellowstone trip packing list from that summer',
  contentTerms: ['yellowstone', 'trip', 'packing', 'list', 'summer'],
  confidence: 'medium'
}

export const RETRIEVAL_ABLATION_CASES: RetrievalAblationCase[] = [
  {
    id: 'ablate-keyword-strong-atomic',
    clueForDisplay: 'atomic bomb documentary notes',
    goldParsed: {
      raw: 'atomic bomb documentary notes',
      contentTerms: ['atomic', 'bomb', 'documentary', 'notes'],
      confidence: 'high'
    },
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.keywordLeaderPage },
    gate: 'measure',
    scenario: 'keyword_anchor',
    labelConfidence: 'clear',
    judgmentZh: '书签标题与 clue 词面高度重合（atomic/bomb/documentary/notes）',
    note: '词面强锚：keyword 应覆盖；测 semantic/hybrid 是否仍保'
  },
  {
    id: 'ablate-semantic-movie-paraphrase',
    clueForDisplay: 'that movie review about the first nuclear detonation',
    goldParsed: {
      raw: 'that movie review about the first nuclear detonation',
      objectTypes: ['video'],
      contentTerms: ['movie', 'review', 'first', 'nuclear', 'detonation'],
      confidence: 'medium'
    },
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt },
    gate: 'measure',
    scenario: 'paraphrase',
    labelConfidence: 'clear',
    judgmentZh: 'objectTypes=video + 核试/影评语义；目标正文为曼哈顿计划影评摘录',
    note: '同义改写：词面弱重叠，测真实 semantic 是否补缝'
  },
  {
    id: 'ablate-pure-semantic-physicists',
    clueForDisplay: 'review of physicists behind the first chain reaction',
    goldParsed: {
      raw: 'review of physicists behind the first chain reaction',
      contentTerms: ['review', 'physicists', 'behind', 'first', 'chain', 'reaction'],
      confidence: 'medium'
    },
    expectation: {
      kind: 'hit',
      expectedId: RETRIEVAL_ABLATION_IDS.pureSemanticPhysicistsNote
    },
    gate: 'measure',
    scenario: 'paraphrase',
    labelConfidence: 'clear',
    judgmentZh: '目标正文含 physicists / chain reaction；与 clue 对齐',
    note: '词面几乎只靠 physicists/chain/reaction；测 embedding 覆盖'
  },
  {
    id: 'ablate-privacy-yesterday',
    clueForDisplay: 'the privacy article I saved yesterday',
    goldParsed: {
      raw: 'the privacy article I saved yesterday',
      timeRange: YESTERDAY_RANGE,
      timeConfidence: 'high',
      objectTypes: ['article'],
      contentTerms: ['privacy', 'article'],
      confidence: 'high'
    },
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.privacyRecentExcerpt },
    gate: 'measure',
    scenario: 'time_hard',
    labelConfidence: 'clear',
    judgmentZh: '时窗内唯一 privacy 主题摘录；窗外 burial 不得冒充',
    note: '时间硬筛 + 内容词'
  },
  {
    id: 'ablate-nuclear-vs-weekly-noise',
    clueForDisplay: 'notes on the first nuclear detonation film',
    goldParsed: {
      raw: 'notes on the first nuclear detonation film',
      objectTypes: ['video'],
      contentTerms: ['notes', 'first', 'nuclear', 'detonation', 'film'],
      confidence: 'medium'
    },
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt },
    gate: 'measure',
    scenario: 'strong_distractor_hit',
    labelConfidence: 'clear',
    judgmentZh: '正确目标=影评摘录；weekly review 为词面噪音；政策简报为后增强干扰',
    note: '干扰 weekly review；测语义是否仍指向电影摘录'
  },
  {
    id: 'ablate-documentary-not-recipe',
    clueForDisplay: 'atomic bomb documentary',
    goldParsed: {
      raw: 'atomic bomb documentary',
      contentTerms: ['atomic', 'bomb', 'documentary'],
      confidence: 'high'
    },
    expectation: { kind: 'miss', expectedId: RETRIEVAL_ABLATION_IDS.unrelatedRecipeExcerpt, k: 10 },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: '食谱与核武纪录片正交；不应进前 10',
    note: '负例：食谱误报'
  },
  {
    id: 'ablate-privacy-not-weather',
    clueForDisplay: 'the privacy article I saved yesterday',
    goldParsed: {
      raw: 'the privacy article I saved yesterday',
      timeRange: YESTERDAY_RANGE,
      timeConfidence: 'high',
      objectTypes: ['article'],
      contentTerms: ['privacy', 'article'],
      confidence: 'high'
    },
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.weatherInWindowExcerpt,
      k: 5
    },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: '窗内天气与 privacy 正交；不应进前 5',
    note: '负例：窗内正交误报'
  },
  {
    id: 'ablate-physicists-not-burial',
    clueForDisplay: 'review of physicists behind the first chain reaction',
    goldParsed: {
      raw: 'review of physicists behind the first chain reaction',
      contentTerms: ['review', 'physicists', 'behind', 'first', 'chain', 'reaction'],
      confidence: 'medium'
    },
    expectation: { kind: 'miss', expectedId: RETRIEVAL_ABLATION_IDS.ancientBurialExcerpt, k: 10 },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: '埋葬考古与 physicists 线索正交',
    note: '负例：burial 误报'
  },
  {
    id: 'ablate-zero-overlap-oppenheimer-biopic',
    clueForDisplay: 'that Oppenheimer biopic writeup I bookmarked',
    goldParsed: OPPENHEIMER_PARSED,
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt },
    gate: 'measure',
    scenario: 'zero_overlap',
    labelConfidence: 'clear',
    judgmentZh:
      '目标正文含 Manhattan Project / Cillian Murphy；clue 词面 Oppenheimer/biopic 与正文零重叠（机制区分题）',
    note: '零词面：keyword 预期 miss；semantic/hybrid 补缝'
  },
  {
    id: 'ablate-oppenheimer-not-cookie',
    clueForDisplay: 'that Oppenheimer biopic writeup I bookmarked',
    goldParsed: OPPENHEIMER_PARSED,
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.cookieConsentLegalExcerpt,
      k: 10
    },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: 'cookie 法务与影评正交',
    note: '负例：cookie 误报'
  },
  {
    id: 'ablate-zero-overlap-anxious-lead',
    clueForDisplay: 'that film where the lead actor looks anxious about the device',
    goldParsed: ANXIOUS_LEAD_PARSED,
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt },
    gate: 'measure',
    scenario: 'zero_overlap',
    labelConfidence: 'clear',
    judgmentZh:
      '目标含 looking worried / Cillian；clue 用 anxious/lead/actor/device，避开 Manhattan/Cillian/bomb 词面',
    note: '第二道零词面区分题'
  },
  {
    id: 'ablate-fuzzy-trinity-test-film',
    clueForDisplay: 'that Trinity test film writeup I meant to reopen',
    goldParsed: {
      raw: 'that Trinity test film writeup I meant to reopen',
      objectTypes: ['video'],
      contentTerms: ['trinity', 'test', 'film', 'writeup'],
      confidence: 'low'
    },
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt },
    gate: 'measure',
    scenario: 'fuzzy_memory',
    labelConfidence: 'ambiguous',
    goldReviewStatus: 'pending_review',
    judgmentZh:
      '评测意图：曼哈顿影评为「Trinity 试验电影」模糊记忆的合理落点（corpus 无 Trinity 字面）；裁定：暂维持 hit→301，待复核',
    labelAmbiguityZh:
      '也可能被理解为泛核武纪录片 → keywordLeader（atomic bomb documentary）可能更贴；不因当前策略 Top1 改标签',
    note: '模糊记忆：专名不在库 · 金标待复核'
  },
  {
    id: 'ablate-paraphrase-privacy-quiet-data',
    clueForDisplay: 'the thing I saved yesterday about keeping user data quiet in dashboards',
    goldParsed: {
      raw: 'the thing I saved yesterday about keeping user data quiet in dashboards',
      timeRange: YESTERDAY_RANGE,
      timeConfidence: 'high',
      objectTypes: ['article'],
      contentTerms: ['user', 'data', 'quiet', 'dashboards'],
      confidence: 'medium'
    },
    expectation: { kind: 'hit', expectedId: RETRIEVAL_ABLATION_IDS.privacyRecentExcerpt },
    gate: 'measure',
    scenario: 'paraphrase',
    labelConfidence: 'clear',
    judgmentZh:
      'yesterday 窗 + dashboards/user data 同义指向 privacy 摘录（正文含 privacy/dashboards）',
    note: '同义改写 + 时窗'
  },
  {
    id: 'ablate-fuzzy-fermi-pile-notes',
    clueForDisplay: 'notes on the Fermi pile and those physicists',
    goldParsed: {
      raw: 'notes on the Fermi pile and those physicists',
      contentTerms: ['notes', 'fermi', 'pile', 'physicists'],
      confidence: 'low'
    },
    expectation: {
      kind: 'hit',
      expectedId: RETRIEVAL_ABLATION_IDS.pureSemanticPhysicistsNote
    },
    gate: 'measure',
    scenario: 'fuzzy_memory',
    labelConfidence: 'ambiguous',
    goldReviewStatus: 'pending_review',
    judgmentZh:
      '意图：chain-reaction physicists 摘录；corpus 无 Fermi 字面，靠语义桥；裁定：暂维持 hit→303，待复核',
    labelAmbiguityZh:
      '核主题影评可能近邻抢位；不因当前策略输出改标签，不把抢位单独判为 embedding 失败',
    note: '模糊记忆：Fermi ↔ chain reaction · 金标待复核'
  },
  {
    id: 'ablate-oppenheimer-not-nuclear-policy',
    clueForDisplay: 'that Oppenheimer biopic writeup I bookmarked',
    goldParsed: OPPENHEIMER_PARSED,
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.nuclearPolicyBriefExcerpt,
      k: 10
    },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: '政策简报含 nuclear 但是非影评；不应进 Oppenheimer 线索前 10',
    note: '强干扰负例：政策简报'
  },
  {
    id: 'ablate-anxious-lead-not-policy',
    clueForDisplay: 'that film where the lead actor looks anxious about the device',
    goldParsed: ANXIOUS_LEAD_PARSED,
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.nuclearPolicyBriefExcerpt,
      k: 10
    },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: '与零词面 hit 同 clue；政策简报不得抢前 10',
    note: '强干扰负例：anxious-lead vs policy'
  },
  {
    id: 'ablate-nomatch-yellowstone-not-movie',
    clueForDisplay: 'my Yellowstone trip packing list from that summer',
    goldParsed: YELLOWSTONE_PARSED,
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt,
      k: 10
    },
    gate: 'negative',
    scenario: 'negative_no_match',
    labelConfidence: 'clear',
    judgmentZh: '无匹配查询：电影摘录不得冒充行程记忆',
    note: '无匹配：禁电影'
  },
  {
    id: 'ablate-nomatch-yellowstone-not-privacy',
    clueForDisplay: 'my Yellowstone trip packing list from that summer',
    goldParsed: YELLOWSTONE_PARSED,
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.privacyRecentExcerpt,
      k: 10
    },
    gate: 'negative',
    scenario: 'negative_no_match',
    labelConfidence: 'clear',
    judgmentZh: '无匹配查询：privacy 摘录不得冒充',
    note: '无匹配：禁 privacy'
  },
  {
    id: 'ablate-nomatch-yellowstone-not-hiking',
    clueForDisplay: 'my Yellowstone trip packing list from that summer',
    goldParsed: YELLOWSTONE_PARSED,
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt,
      k: 5
    },
    gate: 'negative',
    scenario: 'negative_no_match',
    labelConfidence: 'ambiguous',
    goldReviewStatus: 'pending_review',
    judgmentZh:
      '裁定：保持 ambiguous，不改为意图 A/B；独立 clear 案见 ablate-yellowstone-exclude-hike-clear / find-hike-clear',
    labelAmbiguityZh:
      '现 clue 无法区分「明确排除徒步」与「不确定是否徒步」；旧案保留、不覆盖。禁止用模型 Top1 反推金标',
    note: 'Yellowstone 旧案：保持 ambiguous（裁定）'
  },
  {
    id: 'ablate-yellowstone-exclude-hike-clear',
    clueForDisplay:
      'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist',
    goldParsed: {
      raw: 'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist',
      // 用户意图冻结（实验金标）：正侧 lodging 确认；排除 NP = day-hike packing checklist。
      // 非生产 LLM/规则输出；执行仍为词项匹配 ≠ 完整语义理解。
      contentTerms: ['yellowstone', 'lodging', 'booking', 'confirmation', 'summer'],
      excludeContentTerms: ['day-hike', 'packing', 'checklist'],
      confidence: 'high'
    },
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt,
      k: 5
    },
    gate: 'negative',
    scenario: 'negative_no_match',
    labelConfidence: 'clear',
    goldReviewStatus: 'stable',
    judgmentZh:
      '意图 A（独立新案）：用户字面排除 day-hike packing checklist → hiking 条目应 miss@5；库中无 lodging 正解',
    note: 'Yellowstone 意图 A：冻结 exclude=[day-hike,packing,checklist] · 不覆盖旧 ambiguous 案'
  },
  {
    id: 'ablate-yellowstone-find-hike-clear',
    clueForDisplay: 'the Yellowstone day hike packing checklist with bear spray I saved',
    goldParsed: {
      raw: 'the Yellowstone day hike packing checklist with bear spray I saved',
      contentTerms: ['yellowstone', 'day', 'hike', 'packing', 'checklist', 'bear', 'spray'],
      confidence: 'high'
    },
    expectation: {
      kind: 'hit',
      expectedId: RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt
    },
    gate: 'measure',
    scenario: 'keyword_anchor',
    labelConfidence: 'clear',
    goldReviewStatus: 'stable',
    judgmentZh:
      '意图 B（独立新案）：clue 明示 day hike packing checklist + bear spray → 与 hiking 条目正文对齐，应为 hit',
    note: 'Yellowstone 意图 B：明确寻找徒步清单 · 不覆盖旧 ambiguous 案'
  },
  {
    id: 'ablate-documentary-not-sourdough',
    clueForDisplay: 'atomic bomb documentary',
    goldParsed: {
      raw: 'atomic bomb documentary',
      contentTerms: ['atomic', 'bomb', 'documentary'],
      confidence: 'high'
    },
    expectation: {
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.sourdoughStarterExcerpt,
      k: 10
    },
    gate: 'negative',
    scenario: 'negative_orthogonal',
    labelConfidence: 'clear',
    judgmentZh: '酸种笔记与纪录片正交（第二食物域）',
    note: '负例：sourdough'
  }
]
