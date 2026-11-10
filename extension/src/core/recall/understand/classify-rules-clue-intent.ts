/**
 * 失败路径最小意图判断（R5）。
 *
 * **定位：** LLM 失败 / 无 completer / 断网时，规则解析后补一次确定性意图，
 * 使后端非召回短路能给出诚实降级回复；不确定一律回召回（fail-open）。
 *
 * **覆盖：** 18 条非召回金标里约拦截 9 条（问号问题、既有生活/发令词面、中文指令/删除）。
 * 未覆盖 9 条问候/天气/心情陈述（`今天天气不错` / `hello` / `你好` 等）是有意取舍——
 * 失败路径误拦截代价高于漏拦截；问候集属产品决定，本批不加词表。
 *
 * **禁止「优化」成主题判断：** `deriveRecallTopic` 对问候也产主题、对部分召回无主题，
 * 主题锚不能用来分非召回 vs 召回。本模块不得调用主题派生。
 */

import {
  ASSISTANT_MOOD_SURFACES,
  CHINESE_INSTRUCTION_SURFACES,
  clueHasAnySurface,
  looksLikeAssistantImperativeClue,
  looksLikeNonRecallLifeRequest,
  matchesChineseCreationInstruction,
  matchesChineseTranslateInstruction,
  NON_RECALL_DELETE_SURFACES_ZH,
  NON_RECALL_QUESTION_SURFACES
} from '@/core/recall/non-recall-clue-surfaces'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

/** 规则路径可产出的非召回意图（不含 recall）。 */
export type RulesClueIntent = 'chitchat' | 'question' | 'instruction'

export interface RulesClueIntentResult {
  intent: RulesClueIntent
  assistantReply: string
  /** 命中信号（遥测 / trace） */
  signal:
    | 'question_mark' // 问号结尾
    | 'question_surface' // 问题类英文词面
    | 'mood_surface' // 情绪类词面
    | 'life_surface' // 生活助手 / 发令词面
    | 'imperative_surface' // 助手发令（与 life 同规则分支）
    | 'chinese_instruction' // 中文指令词面
    | 'chinese_delete' // 中文删除词面
}

/** 中文降级回复（硬状态提示；跟随线索语言，非 UI locale）。 */
const RULES_DEGRADED_REPLY_ZH =
  '理解服务现在连不上，这句我处理不了——等恢复后你再说一次就行；想找什么存过的东西，也可以直接告诉我。'

/** 英文降级回复。 */
const RULES_DEGRADED_REPLY_EN =
  "I can't reach the understanding service right now, so I couldn't process that — try again once it's back, or just tell me what you'd like to find."

function hasCjk(clue: string): boolean {
  return /[\u3400-\u9fff]/.test(clue)
}

function degradedReplyForClue(clue: string): string {
  return hasCjk(clue) ? RULES_DEGRADED_REPLY_ZH : RULES_DEGRADED_REPLY_EN
}

function objectTypesEmpty(parsed: ParsedRecallClue): boolean {
  return !parsed.objectTypes || parsed.objectTypes.length === 0
}

/**
 * 规则路径最小意图判断。
 * @param clue 调用方保证已 trim 的原始线索
 * @param parsed `parseRecallClue` 的真实结果（守卫依赖真实槽位）
 * @returns 非召回结果；`null` = 走召回
 */
export function classifyRulesClueIntent(
  clue: string,
  parsed: ParsedRecallClue
): RulesClueIntentResult | null {
  const reply = degradedReplyForClue(clue)

  // 1) 问号 + 无对象类型 → question
  if ((clue.endsWith('?') || clue.endsWith('？')) && objectTypesEmpty(parsed)) {
    return { intent: 'question', assistantReply: reply, signal: 'question_mark' }
  }

  // 2) 问题类英文词面 → question
  if (clueHasAnySurface(clue, NON_RECALL_QUESTION_SURFACES)) {
    return { intent: 'question', assistantReply: reply, signal: 'question_surface' }
  }

  // 3) 情绪类词面 → chitchat（须先于发令/生活谓词）
  if (clueHasAnySurface(clue, ASSISTANT_MOOD_SURFACES)) {
    return { intent: 'chitchat', assistantReply: reply, signal: 'mood_surface' }
  }

  // 4) 生活助手 / 助手发令 → instruction
  if (looksLikeNonRecallLifeRequest(clue)) {
    return { intent: 'instruction', assistantReply: reply, signal: 'life_surface' }
  }
  if (looksLikeAssistantImperativeClue(clue)) {
    return { intent: 'instruction', assistantReply: reply, signal: 'imperative_surface' }
  }

  // 5) 中文指令 → instruction（词面 + 构造；无槽位守卫）
  if (
    clueHasAnySurface(clue, CHINESE_INSTRUCTION_SURFACES) ||
    matchesChineseCreationInstruction(clue) ||
    matchesChineseTranslateInstruction(clue)
  ) {
    return { intent: 'instruction', assistantReply: reply, signal: 'chinese_instruction' }
  }

  // 6) 中文删除词面 + 无时间窗 → instruction
  if (clueHasAnySurface(clue, NON_RECALL_DELETE_SURFACES_ZH) && !parsed.timeRange) {
    return { intent: 'instruction', assistantReply: reply, signal: 'chinese_delete' }
  }

  return null
}
