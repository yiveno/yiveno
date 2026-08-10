/**
 * LLM 追问提议 → UI 可用 follow-up；冲突门禁失败则返回 null（上层降级规则）。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallEmptyKind, RecallOutcome } from '@/core/recall/recall-result'
import type { LlmFollowUpProposal } from '@/core/recall/understand/llm-follow-up-proposal'

/** 已解析出的对象类型时，禁止再问类型的芯片 value（canonical 英文）。 */
const TYPE_CHIP_VALUES = new Set([
  'article',
  'poem',
  'code',
  'song',
  'video',
  'command',
  'page',
  'password',
  'quote'
])

/** 回复里若出现这些「类型问卷」句式且已有 objectTypes → 整段拒收。 */
const TYPE_QUESTIONNAIRE_REPLY =
  /(文章[、,，]?诗|article,\s*poem|poem,\s*code|代码[、,，]?还是歌|was it an article|article, poem, code|文章、诗、代码)/i

/** chip.value 须偏英文稳定串，避免把本地化句子当 clue 再发。 */
const STABLE_VALUE = /^[a-z0-9][a-z0-9 '\-]{0,79}$/i

export type MappedLlmFollowUp = {
  text: string
  suggestions: Array<{ id: string; label: string; value: string }>
}

export type MapLlmFollowUpContext = {
  parsed: ParsedRecallClue
  outcome: Extract<RecallOutcome, 'need_a_clue' | 'no_match'>
  emptyKind?: RecallEmptyKind
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * 门禁映射。失败抛错或返回 null 由调用方决定；本函数返回 null 表示拒收。
 */
export function mapLlmFollowUpProposal(
  proposal: LlmFollowUpProposal,
  context: MapLlmFollowUpContext
): MappedLlmFollowUp | null {
  const reply = proposal.reply.trim()
  if (!reply) {
    return null
  }

  const hasObjectTypes = Boolean(
    context.parsed.objectTypes && context.parsed.objectTypes.length > 0
  )
  if (hasObjectTypes && TYPE_QUESTIONNAIRE_REPLY.test(reply)) {
    return null
  }

  // 约束下库空：禁止暗示「检索坏了」的硬失败腔（软性诚实由模型写；门禁只拦明显违禁）
  if (
    context.emptyKind === 'constrained_none' &&
    /system (failed|error)|检索失败|系统出错/i.test(reply)
  ) {
    return null
  }

  const suggestions: MappedLlmFollowUp['suggestions'] = []
  for (const [index, chip] of proposal.chips.entries()) {
    const label = chip.label.trim()
    const value = normalizeValue(chip.value)
    if (!label || !value || !STABLE_VALUE.test(value)) {
      continue
    }
    if (hasObjectTypes && TYPE_CHIP_VALUES.has(value.toLowerCase())) {
      continue
    }
    // 约束空：只保留时间向芯片（域内）
    if (context.emptyKind === 'constrained_none') {
      const lower = value.toLowerCase()
      const timeLike =
        lower.includes('yesterday') ||
        lower.includes('week') ||
        lower.includes('recent') ||
        lower.includes('today') ||
        lower.includes('ago')
      if (!timeLike) {
        continue
      }
    }
    suggestions.push({
      id: `llm-chip-${index}-${value.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      value
    })
    if (suggestions.length >= 5) {
      break
    }
  }

  return { text: reply, suggestions }
}
