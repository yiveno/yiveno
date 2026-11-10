/**
 * 非召回词面与谓词（闭合产品枚举）。
 * 供编排层零锚点拦截与理解层失败路径意图判断共用。
 */

import { normalizeRecallText } from '@/core/recall/keyword-filter'

/**
 * 零锚点助手发令词面（闭合产品枚举）：无真实记忆锚时须诚实 no_match，禁止当推荐引擎。
 */
export const ASSISTANT_IMPERATIVE_SURFACES = [
  'i feel bored',
  "i'm bored",
  'feel bored',
  'recommend a',
  'recommend me',
  'suggest a',
  'suggest me',
  'pick something',
  'something fun',
  'for me',
  'play some',
  'put on some'
] as const

/**
 * 生活助手 / 非找回意图（闭合产品枚举）。
 * Yiveno 不是天气/点餐/摘要/行程/写码助理；无线索记忆锚时一律诚实空。
 * 须先于「有内容词则放行」判定，否则 summarize/plan/write 会被 LLM 残留词扫库。
 *
 * **点餐已知近似：** `order takeout` / `order dinner`（动词 + 裸宾语、无限定词）仍不覆盖；
 * 裸 `order` 不进表——`my order history` / `the order confirmation I saved` 是召回。
 */
export const NON_RECALL_LIFE_SURFACES = [
  'what is the weather',
  'whats the weather',
  "what's the weather",
  'weather going to be',
  'weather tomorrow',
  // 点餐：动词 + 代词/冠词/限定词（构造级，非具体菜名）
  'order me', // order me a coffee / order me some food
  'order a', // order a pizza / order a coffee
  'order some', // order some food
  // 用餐决策问式（替代易误伤召回的片段 for dinner）
  'what should i eat', // what should I eat for dinner
  'what to eat', // what to eat tonight
  'what to cook', // 做饭决策
  'what time is it',
  'translate this',
  'write me an email',
  'send an email',
  // 摘要 / 行程规划 / 写码：助手任务，不是找回
  'summarize the',
  'summarize this',
  'summarize latest',
  'summarize for me',
  'plan a trip',
  'plan a weekend',
  'plan me a',
  'write a python',
  'write a script',
  'write me a script',
  'write a program',
  'generate a script',
  'generate code',
  // R5：提醒 / 删除（英文）；走 life 谓词 → instruction；有记忆锚时仍放行找回
  'remind me', // 提醒我…
  'remind me to', // 提醒我去做…
  'delete all', // 全删
  'delete my', // 删我的…
  'remove all' // 全移除
] as const

/**
 * 记忆找回锚词面：出现则不作「生活助手」拦截（如「weather article I saved」仍可找回）。
 */
export const MEMORY_RECALL_ANCHOR_SURFACES = [
  'saved',
  'bookmarked',
  'bookmark',
  'I noted',
  'i noted',
  'my note',
  'left a note',
  'excerpt',
  'clip I',
  'I highlighted',
  'i highlighted',
  'I bookmarked',
  'i bookmarked',
  'from last',
  'a while ago',
  'few days ago',
  'the other day',
  'I read',
  'i read'
] as const

/**
 * 问题类子集（标签分流 → question）。
 * 词面本就在 NON_RECALL_LIFE_SURFACES；此处只用于 R5 意图标签，不另扩覆盖。
 */
export const NON_RECALL_QUESTION_SURFACES = [
  'what is the weather',
  'whats the weather',
  "what's the weather",
  'weather going to be',
  'weather tomorrow',
  'what time is it'
] as const

/**
 * 情绪类子集（标签分流 → chitchat）。
 * 词面本就在 ASSISTANT_IMPERATIVE_SURFACES；须先于发令/生活谓词判断。
 */
export const ASSISTANT_MOOD_SURFACES = ['i feel bored', "i'm bored", 'feel bored'] as const

/**
 * 中文指令词面（祈使子串 → instruction）。
 * 仅保留已通用的动词级「提醒我」；「写 / 翻译」改走构造检查（见下方 helpers）。
 */
export const CHINESE_INSTRUCTION_SURFACES = [
  '提醒我' // 提醒类指令（动词级，已通用）
] as const

/**
 * 创作指令构造：写 + （一）+ 量词（首/篇/封/段/本）。
 * 类是「写/创作一个东西」，不是「写首诗」这一个短语。
 * （正则分组用 ASCII 括号；Brief 全角括号视为笔误。）
 */
export function matchesChineseCreationInstruction(clue: string): boolean {
  return /写(一)?(首|篇|封|段|本)/.test(clue)
}

/**
 * 翻译指令构造：翻译 + 指示词（这/那/一下/一）。
 * 刻意不用裸「翻译」，避免误伤「翻译过的那篇文章」。
 */
export function matchesChineseTranslateInstruction(clue: string): boolean {
  return /翻译(这|那|一下|一)/.test(clue)
}

/**
 * 中文删除词面（→ instruction；须 parsed.timeRange 为空，保护「昨天删掉的那篇文章」）。
 * 刻意不用裸「删除」「删」。
 */
export const NON_RECALL_DELETE_SURFACES_ZH = [
  '全删', // 全删了
  '都删', // 都删了
  '删了', // …删了
  '删掉' // …删掉
] as const

/**
 * 英文删除词面（与 life 表新增条目同源；供文档/对照；判断仍走 life 谓词）。
 */
export const NON_RECALL_DELETE_SURFACES_EN = ['delete all', 'delete my', 'remove all'] as const

export function isAsciiWordCharForSurface(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9]/.test(char))
}

/** 规范化线索是否含某 surface（ASCII 词边界；CJK 非 [a-z0-9] → 边界恒真，按子串匹配）。 */
export function normalizedClueHasSurface(normalized: string, surface: string): boolean {
  const needle = normalizeRecallText(surface)
  if (!needle) {
    return false
  }
  let fromIndex = 0
  while (fromIndex < normalized.length) {
    const index = normalized.indexOf(needle, fromIndex)
    if (index < 0) {
      return false
    }
    const before = normalized[index - 1]
    const after = normalized[index + needle.length]
    if (!isAsciiWordCharForSurface(before) && !isAsciiWordCharForSurface(after)) {
      return true
    }
    fromIndex = index + 1
  }
  return false
}

export function clueHasAnySurface(clue: string, surfaces: readonly string[]): boolean {
  const normalized = normalizeRecallText(clue)
  return surfaces.some(surface => normalizedClueHasSurface(normalized, surface))
}

/** 线索是否含助手发令词面（ASCII 词边界）。 */
export function looksLikeAssistantImperativeClue(clue: string): boolean {
  return clueHasAnySurface(clue, ASSISTANT_IMPERATIVE_SURFACES)
}

/**
 * 生活助手请求（天气/点餐/摘要/行程/写码等）且无线索记忆锚 → 非 Recall。
 * 有 saved/bookmarked/note 等锚时放行，避免误伤「weather article I saved」。
 */
export function looksLikeNonRecallLifeRequest(clue: string): boolean {
  if (clueHasAnySurface(clue, MEMORY_RECALL_ANCHOR_SURFACES)) {
    return false
  }
  // 英文删除子集与 life 表同源；显式并查，避免死导出且语义仍走同一谓词
  return (
    clueHasAnySurface(clue, NON_RECALL_LIFE_SURFACES) ||
    clueHasAnySurface(clue, NON_RECALL_DELETE_SURFACES_EN)
  )
}
