import type { RecallRelativeTimeLabel } from '@/core/recall/parse-recall-clue-lexicon'
import type {
  RecallBehaviorHint,
  RecallClueConfidence,
  RecallObjectType
} from '@/core/recall/parse-recall-clue-types'

/**
 * 门禁级别。
 * - must：当前规则 parser 必须通过（回归基线）
 * - stretch：理想理解金标；规则可失败，供后续 LLM 对比（不挡 CI）
 */
export type ParseGoldGate =
  | 'must' // 必过：挡门禁
  | 'stretch' // 拉伸：仅汇报

/**
 * 理想槽位（人工金标）。
 * - 字段省略 = 不检查该项
 * - `null`（timeLabel / objectTypes / behaviorHints）= 该项必须缺失
 * - contentTerms：默认要求 mustInclude 全部出现；exact 时集合须精确相等
 */
export interface ParseGoldSlots {
  timeLabel?: RecallRelativeTimeLabel | null
  objectTypes?: RecallObjectType[] | null
  behaviorHints?: RecallBehaviorHint[] | null
  /** true = 必须有 noteHint；false = 必须无 */
  noteHint?: boolean
  contentTermsMustInclude?: string[]
  contentTermsMustExclude?: string[]
  contentTermsExact?: boolean
  confidence?: RecallClueConfidence
}

export interface ParseGoldCase {
  id: string
  /** 英语口语线索（T1） */
  clue: string
  gate: ParseGoldGate
  expect: ParseGoldSlots
  /** 中文：出题意图 */
  note: string
}

/**
 * 理解层金标：口语 → ParsedRecallClue 槽位。
 * 与 recall-eval（线索 → 命中 MemoryItem id）正交；本集只量解析。
 */
export const PARSE_GOLD_CASES: ParseGoldCase[] = [
  // —— must：产品文档 P0 典型语料 + 规则已覆盖 ——
  {
    id: 'p0-time-type-entity-li-bai',
    clue: 'yesterday saved a poem about Li Bai',
    gate: 'must',
    expect: {
      timeLabel: 'yesterday',
      objectTypes: ['poem'],
      contentTermsMustInclude: ['li', 'bai'],
      contentTermsExact: true,
      confidence: 'high'
    },
    note: '时间+类型+实体 → high'
  },
  {
    id: 'p0-time-type-content-auth-code',
    clue: 'last week the code snippet about auth',
    gate: 'must',
    expect: {
      timeLabel: 'last_week',
      objectTypes: ['code'],
      contentTermsMustInclude: ['auth'],
      confidence: 'high'
    },
    note: '时间+code snippet+内容词'
  },
  {
    id: 'p0-behavior-song-yesterday',
    clue: 'the song I played on repeat yesterday',
    gate: 'must',
    expect: {
      timeLabel: 'yesterday',
      objectTypes: ['song'],
      behaviorHints: ['often_opened'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'medium'
    },
    note: '行为+类型+时间，无内容词 → medium'
  },
  {
    id: 'p0-half-read-article',
    clue: "the article I didn't finish reading",
    gate: 'must',
    expect: {
      timeLabel: null,
      objectTypes: ['article'],
      behaviorHints: ['half_read'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'medium'
    },
    note: '行为+类型'
  },
  {
    id: 'p0-note-deployment-page',
    clue: 'yesterday left a note about the deployment page',
    gate: 'must',
    expect: {
      timeLabel: 'yesterday',
      objectTypes: ['page'],
      noteHint: true,
      contentTermsMustInclude: ['deployment'],
      confidence: 'high'
    },
    note: '备注+类型+内容'
  },
  {
    id: 'p0-article-last-week-filler-read',
    clue: 'the article I read last week',
    gate: 'must',
    expect: {
      timeLabel: 'last_week',
      objectTypes: ['article'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'medium'
    },
    note: '时间+类型；read 为 filler'
  },
  {
    id: 'p0-day-before-yesterday-rag',
    clue: 'day before yesterday the article about RAG',
    gate: 'must',
    expect: {
      timeLabel: 'day_before_yesterday',
      objectTypes: ['article'],
      contentTermsMustInclude: ['rag'],
      confidence: 'high'
    },
    note: '前天+文章+实体'
  },
  {
    id: 'p0-while-ago-half-read-article',
    clue: "the article I didn't finish reading a while ago",
    gate: 'must',
    expect: {
      timeLabel: 'a_while_ago',
      objectTypes: ['article'],
      behaviorHints: ['half_read'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'medium'
    },
    note: '一段时间前+看一半'
  },
  {
    id: 'p0-full-english-li-bai-short',
    clue: 'yesterday poem about Li Bai',
    gate: 'must',
    expect: {
      timeLabel: 'yesterday',
      objectTypes: ['poem'],
      contentTermsMustInclude: ['li', 'bai'],
      confidence: 'high'
    },
    note: '短句英语主路径'
  },
  {
    id: 'p0-code-deployment-last-week',
    clue: 'last week saved code deployment',
    gate: 'must',
    expect: {
      timeLabel: 'last_week',
      objectTypes: ['code'],
      contentTermsMustInclude: ['deployment'],
      confidence: 'high'
    },
    note: '时间+code+内容'
  },
  {
    id: 'p0-command-env-sync',
    clue: 'env sync command',
    gate: 'must',
    expect: {
      objectTypes: ['command'],
      contentTermsMustInclude: ['env', 'sync'],
      confidence: 'medium'
    },
    note: '命令类型'
  },
  {
    id: 'p0-password-recently-saved',
    clue: 'recently just saved password',
    gate: 'must',
    expect: {
      timeLabel: 'recent',
      objectTypes: ['password'],
      behaviorHints: ['recently_saved'],
      confidence: 'medium'
    },
    note: '近因+刚存+密码'
  },
  {
    id: 'p0-long-ago-poem',
    clue: 'long ago a poem',
    gate: 'must',
    expect: {
      timeLabel: 'long_ago',
      objectTypes: ['poem'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'medium'
    },
    note: '很久以前+类型'
  },
  {
    id: 'p0-quote-yesterday',
    clue: 'yesterday the quote',
    gate: 'must',
    expect: {
      timeLabel: 'yesterday',
      objectTypes: ['quote'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'medium'
    },
    note: '引用类型'
  },
  {
    id: 'p0-poetry-alias-li-bai',
    clue: 'poetry about Li Bai',
    gate: 'must',
    expect: {
      objectTypes: ['poem'],
      contentTermsMustInclude: ['li', 'bai'],
      confidence: 'medium'
    },
    note: 'poetry → poem 别名'
  },
  {
    id: 'p0-just-saved-article',
    clue: 'just saved article',
    gate: 'must',
    expect: {
      objectTypes: ['article'],
      behaviorHints: ['recently_saved'],
      confidence: 'medium'
    },
    note: '刚存+文章'
  },
  {
    id: 'p0-pure-keywords-cloudflare',
    clue: 'Cloudflare Workers',
    gate: 'must',
    expect: {
      timeLabel: null,
      objectTypes: null,
      behaviorHints: null,
      noteHint: false,
      contentTermsMustInclude: ['cloudflare', 'workers'],
      contentTermsExact: true,
      confidence: 'low'
    },
    note: '纯关键词：无结构槽，仅内容词'
  },
  {
    id: 'p0-only-type-poem',
    clue: 'poem',
    gate: 'must',
    expect: {
      objectTypes: ['poem'],
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'low'
    },
    note: '仅类型 → low'
  },
  {
    id: 'p0-only-time-yesterday',
    clue: 'yesterday saved that',
    gate: 'must',
    expect: {
      timeLabel: 'yesterday',
      contentTermsExact: true,
      contentTermsMustInclude: [],
      confidence: 'low'
    },
    note: '仅时间锚（that 为 filler）→ low'
  },
  {
    id: 'p0-zero-anchor-bored',
    clue: 'i feel bored',
    gate: 'must',
    expect: {
      timeLabel: null,
      objectTypes: null,
      behaviorHints: null,
      noteHint: false,
      confidence: 'low'
    },
    note: '零锚点：不得当助手推荐；解析应保持低置信'
  },
  {
    id: 'p0-assistant-like-songs',
    clue: 'put a few songs i like',
    gate: 'must',
    expect: {
      objectTypes: ['song'],
      contentTermsMustInclude: ['like'],
      confidence: 'medium'
    },
    note: '禁主 demo 句：规则仍可能抽出 song；金标记录现状供对照'
  },
  {
    id: 'p0-half-read-compat',
    clue: 'half read the article',
    gate: 'must',
    expect: {
      objectTypes: ['article'],
      behaviorHints: ['half_read'],
      confidence: 'medium'
    },
    note: 'half read 兼容说法'
  },

  // —— stretch：理想金标；规则词典/句式常不够（未来 LLM 目标） ——
  {
    id: 'stretch-verse-as-poem',
    clue: 'that Li Bai verse from the other day',
    gate: 'stretch',
    expect: {
      timeLabel: 'a_while_ago',
      objectTypes: ['poem'],
      contentTermsMustInclude: ['li', 'bai'],
      contentTermsMustExclude: ['verse'],
      confidence: 'high'
    },
    note: 'verse→poem 理想映射；规则无 verse 词面'
  },
  {
    id: 'stretch-never-finished-writeup',
    clue: 'the deployment writeup I never finished',
    gate: 'stretch',
    expect: {
      objectTypes: ['article'],
      behaviorHints: ['half_read'],
      contentTermsMustInclude: ['deployment'],
      confidence: 'medium'
    },
    note: 'never finished 无 reading 后缀时规则易漏 half_read'
  },
  {
    id: 'stretch-music-kept-opening',
    clue: 'music I kept opening yesterday',
    gate: 'stretch',
    expect: {
      timeLabel: 'yesterday',
      objectTypes: ['song'],
      behaviorHints: ['often_opened'],
      confidence: 'medium'
    },
    note: 'music+kept opening；确认行为与类型同句'
  },
  {
    id: 'stretch-my-note-launch-checklist',
    clue: 'the page with my note about the launch checklist',
    gate: 'stretch',
    expect: {
      objectTypes: ['page'],
      noteHint: true,
      contentTermsMustInclude: ['launch', 'checklist'],
      confidence: 'high'
    },
    note: 'my note + page + 多词内容'
  },
  {
    id: 'stretch-rate-limits-docs',
    clue: 'API docs about rate limits from earlier this week',
    gate: 'stretch',
    expect: {
      timeLabel: 'recent',
      objectTypes: ['article'],
      contentTermsMustInclude: ['api', 'rate', 'limits'],
      confidence: 'high'
    },
    note: 'docs→article + 多内容词 + earlier this week'
  },
  {
    id: 'stretch-manifest-v3-looked-at',
    clue: 'the thing about Manifest V3 I looked at recently',
    gate: 'stretch',
    expect: {
      timeLabel: 'recent',
      objectTypes: null,
      contentTermsMustInclude: ['manifest', 'v3'],
      contentTermsMustExclude: ['thing', 'looked'],
      confidence: 'medium'
    },
    note: '无类型词；理想应剥虚词只留实体'
  },
  {
    id: 'must-wwii-related-video',
    clue: 'wwii related video',
    gate: 'must',
    expect: {
      objectTypes: ['video'],
      contentTermsMustInclude: ['wwii'],
      contentTermsMustExclude: ['related', 'video'],
      confidence: 'medium'
    },
    note: '视频类型与 WWII 主题词；related 为 filler'
  },
  {
    id: 'stretch-password-staging-stored',
    clue: 'password I just stored for staging',
    gate: 'stretch',
    expect: {
      objectTypes: ['password'],
      behaviorHints: ['recently_saved'],
      contentTermsMustInclude: ['staging'],
      confidence: 'high'
    },
    note: 'just stored + password + 内容'
  },
  {
    id: 'stretch-trying-to-remember-auth-snippet',
    clue: "I'm trying to remember the auth snippet from last week",
    gate: 'stretch',
    expect: {
      timeLabel: 'last_week',
      objectTypes: ['code'],
      contentTermsMustInclude: ['auth'],
      contentTermsMustExclude: ['trying', 'remember'],
      confidence: 'high'
    },
    note: '起手式 filler + snippet + 时间'
  }
]
