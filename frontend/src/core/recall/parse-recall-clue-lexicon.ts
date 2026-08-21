/**
 * P0 口语线索词典：时间 / 对象类型 / 行为 / 备注指向。
 *
 * 规范见产品文档 §0.1.1「市场语言与 Recall Language Strategy」：
 * T1 英语为 parser 一级语料；surface 优先真实用户口语，而非开发者/技术文档用语。
 * 内部 canonical 一律英文 slug；其它语言仅作 alias（本文件 P0 暂不含 alias）。
 */

import type { RecallBehaviorHint, RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/** 词典条目：surface 为用户口语中的词面。 */
export type RecallLexiconEntry<T extends string> = {
  surface: string
  value: T
}

/**
 * 相对时间标签（解析后再换成具体 ISO 窗）。
 * - today：今天
 * - yesterday：昨天
 * - day_before_yesterday：前天
 * - last_week：上周
 * - recent：最近
 * - a_while_ago：前一阵
 * - long_ago：很久以前
 */
export type RecallRelativeTimeLabel =
  | 'today' // 今天
  | 'yesterday' // 昨天
  | 'day_before_yesterday' // 前天
  | 'last_week' // 上周
  | 'recent' // 最近
  | 'a_while_ago' // 前一阵
  | 'long_ago' // 很久以前

/** 各对象类型的 canonical 英文词面。 */
export const RECALL_OBJECT_TYPE_CANONICAL_SURFACES: Record<RecallObjectType, string> = {
  poem: 'poem',
  article: 'article',
  song: 'song',
  video: 'video',
  code: 'code',
  command: 'command',
  page: 'page',
  password: 'password',
  quote: 'quote',
  bookmark: 'bookmark'
}

/** 时间词：真实口语优先（长 phrase 由 parser 按长度优先匹配）。 */
export const RECALL_TIME_LEXICON: RecallLexiconEntry<RecallRelativeTimeLabel>[] = [
  { surface: 'day before yesterday', value: 'day_before_yesterday' },
  { surface: 'a few days ago', value: 'a_while_ago' },
  { surface: 'the other day', value: 'a_while_ago' },
  { surface: 'earlier this week', value: 'recent' },
  { surface: 'last few days', value: 'recent' },
  { surface: 'yesterday', value: 'yesterday' },
  { surface: 'today', value: 'today' },
  { surface: 'last week', value: 'last_week' },
  { surface: 'recently', value: 'recent' },
  { surface: 'a while ago', value: 'a_while_ago' },
  { surface: 'long ago', value: 'long_ago' }
]

/** 对象类型词：口语 + 常见同义说法。 */
export const RECALL_OBJECT_TYPE_LEXICON: RecallLexiconEntry<RecallObjectType>[] = [
  // poem
  { surface: 'poetry', value: 'poem' },
  { surface: 'poems', value: 'poem' },
  { surface: 'poem', value: 'poem' },

  // article
  { surface: 'blog post', value: 'article' },
  { surface: 'write-up', value: 'article' },
  { surface: 'writeup', value: 'article' },
  { surface: 'documentation', value: 'article' },
  { surface: 'articles', value: 'article' },
  { surface: 'article', value: 'article' },
  { surface: 'tutorial', value: 'article' },
  { surface: 'story', value: 'article' },
  { surface: 'readme', value: 'article' },
  { surface: 'blog', value: 'article' },
  { surface: 'docs', value: 'article' },
  { surface: 'post', value: 'article' },
  { surface: 'essay', value: 'article' },

  // song
  { surface: 'playlist', value: 'song' },
  { surface: 'recording', value: 'song' },
  { surface: 'tracks', value: 'song' },
  { surface: 'track', value: 'song' },
  { surface: 'songs', value: 'song' },
  { surface: 'song', value: 'song' },
  { surface: 'music', value: 'song' },

  // video（与 song 分立：YouTube 等站不得再标成 song；movie/film 口语归 video）
  { surface: 'youtube video', value: 'video' },
  { surface: 'movies', value: 'video' },
  { surface: 'movie', value: 'video' },
  { surface: 'films', value: 'video' },
  { surface: 'film', value: 'video' },
  { surface: 'videos', value: 'video' },
  { surface: 'video', value: 'video' },
  { surface: 'youtube', value: 'video' },
  { surface: 'clip', value: 'video' },

  // code
  { surface: 'source code', value: 'code' },
  { surface: 'code snippet', value: 'code' },
  { surface: 'snippet', value: 'code' },
  { surface: 'repository', value: 'code' },
  { surface: 'gist', value: 'code' },
  { surface: 'repo', value: 'code' },
  { surface: 'code', value: 'code' },

  // command
  { surface: 'terminal command', value: 'command' },
  { surface: 'shell command', value: 'command' },
  { surface: 'cli command', value: 'command' },
  { surface: 'command', value: 'command' },

  // page
  { surface: 'web page', value: 'page' },
  { surface: 'webpage', value: 'page' },
  { surface: 'website', value: 'page' },
  { surface: 'link', value: 'page' },
  { surface: 'site', value: 'page' },
  { surface: 'page', value: 'page' },

  // password
  { surface: 'credentials', value: 'password' },
  { surface: 'login info', value: 'password' },
  { surface: 'login', value: 'password' },
  { surface: 'password', value: 'password' },

  // quote
  { surface: 'highlight', value: 'quote' },
  { surface: 'quotation', value: 'quote' },
  { surface: 'excerpt', value: 'quote' },
  { surface: 'quote', value: 'quote' },
  { surface: 'passage', value: 'quote' },

  // bookmark（语料类型；匹配 MemoryItem.type，勿与 page/article 主题混淆）
  { surface: 'bookmarks', value: 'bookmark' },
  { surface: 'bookmark', value: 'bookmark' }
]

/** 行为词：用户描述「怎么用/看到哪」时的自然说法。 */
export const RECALL_BEHAVIOR_LEXICON: RecallLexiconEntry<RecallBehaviorHint>[] = [
  // half_read
  { surface: "didn't finish reading", value: 'half_read' },
  { surface: 'didnt finish reading', value: 'half_read' },
  { surface: 'never finished reading', value: 'half_read' },
  { surface: 'stopped halfway through', value: 'half_read' },
  { surface: 'only got halfway through', value: 'half_read' },
  { surface: 'halfway through', value: 'half_read' },
  { surface: 'read halfway', value: 'half_read' },
  { surface: 'half read', value: 'half_read' },
  { surface: 'did not finish', value: 'half_read' },
  { surface: 'not finished', value: 'half_read' },

  // often_opened
  { surface: 'played on repeat', value: 'often_opened' },
  { surface: 'listened to a lot', value: 'often_opened' },
  { surface: 'kept opening', value: 'often_opened' },
  { surface: 'opened a bunch', value: 'often_opened' },
  { surface: 'opened many times', value: 'often_opened' },
  { surface: 'opened repeatedly', value: 'often_opened' },
  { surface: 'looped many times', value: 'often_opened' },
  { surface: 'kept playing', value: 'often_opened' },
  { surface: 'played a lot', value: 'often_opened' },
  { surface: 'on repeat', value: 'often_opened' },
  { surface: 'opened recently', value: 'often_opened' },
  { surface: 'just opened', value: 'often_opened' },

  // recently_saved
  { surface: 'recently collected', value: 'recently_saved' },
  { surface: 'just bookmarked', value: 'recently_saved' },
  { surface: 'just collected', value: 'recently_saved' },
  { surface: 'saved it earlier', value: 'recently_saved' },
  { surface: 'saved earlier', value: 'recently_saved' },
  { surface: 'just saved', value: 'recently_saved' },
  { surface: 'just stored', value: 'recently_saved' },
  { surface: 'newly saved', value: 'recently_saved' },
  { surface: 'newly collected', value: 'recently_saved' }
]

/** 备注指向词：命中则 noteHint=true。 */
export const RECALL_NOTE_HINT_LEXICON: RecallLexiconEntry<'note'>[] = [
  { surface: 'left a note', value: 'note' },
  { surface: 'made a note', value: 'note' },
  { surface: 'wrote down', value: 'note' },
  { surface: 'jotted down', value: 'note' },
  { surface: 'noted down', value: 'note' },
  { surface: 'my note', value: 'note' },
  { surface: 'i wrote', value: 'note' },
  { surface: 'i noted', value: 'note' },
  { surface: 'annotation', value: 'note' },
  { surface: 'note', value: 'note' }
]

/**
 * 剥除后不再进入 contentTerms 的填充词（整词匹配）。
 * 召回场景里常见的起手式 / 虚词；ASCII filler 需满足近似词边界。
 */
export const RECALL_CLUE_FILLER_SURFACES: string[] = [
  // 起手式
  'im looking for',
  "i'm looking for",
  'looking for',
  'trying to find',
  'trying to remember',
  'help me remember',
  'need to find',
  'where is',
  'where is the',

  // 定冠 + 类型（类型词本身由 object lexicon 处理）
  'a song',
  'a poem',
  'an article',
  'a page',
  'a quote',
  'a video',
  'the song',
  'the article',
  'the page',
  'the quote',
  'the video',
  'that one',
  'the one',
  'that',

  // 动作虚词（bookmark 已迁入 objectTypes，勿再当 filler 剥掉类型信号）
  'bookmarked',
  'collected',
  'collect',
  'saved',
  'save',
  'store',
  'stored',
  'watched',
  'watching',
  'watch',
  'viewed',
  'view',
  'saw',
  'read',
  'find',
  'find me',
  'help me find',
  'show me',

  // 定冠 + 复数类型（与 lexicon 对齐，避免残留进 contentTerms）
  'the videos',
  'videos',
  'the movies',
  'movies',
  'films',
  'the films',

  // 介词 / 代词 / 弱关系词
  'related to',
  'related',
  'about',
  'put',
  'few',
  'i was',
  'the',
  'a',
  'an',
  'my',
  'i'
]
