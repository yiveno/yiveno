/**
 * Side Panel 结果卡派生：可见截取、Framing/回声文案、match→卡映射。
 * 从 SidePanel.vue 机械抽出的纯辅助；行为与原文一致。
 */

import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { renderRecallFraming } from '@/core/recall/render-recall-framing'
import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'
import {
  formatRecallUnderstandingEchoChips,
  recallUnderstandingEchoSourceFromParsed,
  type RecallUnderstandingEchoChip
} from '@/core/recall/format-recall-understanding-echo'
import { formatRecallVisibleProgressBasis } from '@/core/recall/format-recall-visible-progress-basis'
import {
  selectBasisKindsForResultCopy,
  selectRecallVisibleProgressBasisKinds
} from '@/core/recall/visible-progress-basis'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { t } from '@/infrastructure/i18n/t'
import { type RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import type { AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import { toRecallMatchCard } from '@/pages/sidepanel/recall-match-card'

/** 助手轮次当前可见的候选卡（Show more 截取）。 */
export function visibleCandidateCards(turn: AssistantTurn): RecallCardModel[] {
  const cards = turn.candidateCards ?? []
  const limit = turn.visibleCount ?? cards.length
  return cards.slice(0, Math.max(0, limit))
}

/** 排序短名单回复文案：报总数 N，并标明当前展示区间。 */
export function formatRankedReplyText(total: number, visible: number): string {
  if (total <= 0) {
    return t('popup_reply_confident')
  }
  const shown = Math.min(visible, total)
  if (shown >= total) {
    return t('popup_reply_ranked_all', [String(total)])
  }
  return t('popup_reply_ranked_partial', [String(total), '1', String(shown)])
}

/** 有真实槽位时生成理解回声芯片；无则 undefined。 */
export function resolveUnderstandingEchoChips(
  parsed: ParsedRecallClue | undefined
): RecallUnderstandingEchoChip[] | undefined {
  const source = recallUnderstandingEchoSourceFromParsed(parsed)
  if (!source) {
    return undefined
  }
  const chips = formatRecallUnderstandingEchoChips(source, t)
  return chips.length > 0 ? chips : undefined
}

/** 列表级 Framing 文案；有理解回声时省略 P1 / 「主要依据」；有卡时省略 P6（卡前计数承接）。 */
export function resolveListReplyText(
  result: RecallResult,
  total: number,
  visibleCount: number,
  fallback: string,
  options: { omitUnderstood?: boolean; omitCounts?: boolean } = {}
): { text: string; recallFramingFacts?: RecallFramingFacts } {
  const omitUnderstood = options.omitUnderstood === true
  const omitCounts = options.omitCounts === true
  const facts = result.recallFraming?.facts
  let text: string
  if (facts) {
    text = renderFramingWithShownCount(facts, total, visibleCount, {
      omitUnderstood,
      omitCounts
    })
  } else if (result.recallFraming?.text.trim() && !omitUnderstood) {
    text = result.recallFraming.text
  } else if (omitCounts) {
    // 无 facts 且卡前已报计数：勿再塞纯计数 fallback
    text = ''
  } else {
    text = fallback
  }

  // 有 Heard as：仅保留回声未覆盖的 source；无回声：完整 Mainly based on
  {
    const framingForBasis = facts ?? result.recallFraming?.facts
    const basisKinds = selectBasisKindsForResultCopy(
      selectRecallVisibleProgressBasisKinds({
        ...(result.parsed !== undefined ? { parsed: result.parsed } : {}),
        ...(framingForBasis !== undefined ? { framingFacts: framingForBasis } : {})
      }),
      { omitEchoOverlap: omitUnderstood }
    )
    const basis = formatRecallVisibleProgressBasis(basisKinds, t)
    if (basis) {
      text = `${text} ${basis}`
    }
  }

  if (facts) {
    return { text, recallFramingFacts: facts }
  }
  if (result.recallFraming?.facts) {
    return { text, recallFramingFacts: result.recallFraming.facts }
  }
  return { text }
}

export function renderFramingWithShownCount(
  facts: RecallFramingFacts,
  total: number,
  shown: number,
  options: { omitUnderstood?: boolean; omitCounts?: boolean } = {}
): string {
  if (facts.kind !== 'candidates') {
    return renderRecallFraming(facts, t, options)
  }
  return renderRecallFraming(
    {
      ...facts,
      counts: { total, shown: Math.min(shown, total) }
    },
    t,
    options
  )
}

/** Match → 结果卡模型（detail 页 URL 与壳内一致）。 */
export function toMatchCard(
  match: RecallMatch,
  resultClue: string,
  options: { includeSiblings?: boolean; rank?: number } = {},
  detailPageUrl: string = chrome.runtime.getURL('detail.html')
): RecallCardModel {
  return toRecallMatchCard(match, resultClue, t, {
    ...options,
    detailPageUrl
  })
}
