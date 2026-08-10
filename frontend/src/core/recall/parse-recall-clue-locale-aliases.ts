/**
 * 非英语 locale 的对象类型 / 填充词 alias。
 * 不进入 English canonical；仅供 parseRecallClue 识别词面。
 * T1 英语主路径不依赖本文件（去掉后英语语料仍成立）。
 */

import type { RecallLexiconEntry } from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/** 中文等 locale → 英文 objectType slug（alias only）。 */
export const RECALL_OBJECT_TYPE_LOCALE_ALIASES: RecallLexiconEntry<RecallObjectType>[] = [
  { surface: '视频', value: 'video' },
  { surface: '影片', value: 'video' },
  { surface: '电影', value: 'video' },
  { surface: '录像', value: 'video' }
]

/** 中文弱关系 / 虚词，剥除后不进 contentTerms。 */
export const RECALL_CLUE_LOCALE_FILLER_SURFACES: string[] = ['相关的', '相关', '的那个', '那个']
