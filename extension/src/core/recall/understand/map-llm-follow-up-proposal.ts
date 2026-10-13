/**
 * LLM 追问提议 → UI 可用 follow-up；冲突门禁失败则返回 null（上层降级静态文案）。
 * 仅服务 need_a_clue（候选收窄）。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
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

/**
 * 偏好建档 / 助理人设（产品文档 §0.1.1 空结果契约）→ 整段拒收。
 */
const PREFERENCE_PROFILE_REPLY =
  /(还不了解你|告诉我你喜欢|喜欢什么类型.{0,12}记住|我会记住你的|跟我聊聊你的喜好|get to know you|don'?t know you (well )?enough|tell me what you (?:\\w+\\s){0,4}(like|prefer)|tell me what you (?:usually\\s)?(like|prefer)|i'?ll remember (?:your )?(?:prefer|it)|i'?ll remember (your )?prefer|build (a )?profile)/i

/** chip.value 须偏英文稳定串，避免把本地化句子当 clue 再发。 */
const STABLE_VALUE = /^[a-z0-9][a-z0-9 '\-]{0,79}$/i

export type MappedLlmFollowUp = {
  text: string
  suggestions: Array<{ id: string; label: string; value: string }>
}

export type MapLlmFollowUpContext = {
  parsed: ParsedRecallClue
  outcome: 'need_a_clue'
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * 门禁映射。返回 null 表示拒收。
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

  if (PREFERENCE_PROFILE_REPLY.test(reply)) {
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
