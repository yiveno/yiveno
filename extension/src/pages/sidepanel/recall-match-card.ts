import type { TranslateFn } from '@/core/i18n/translate'
import type { RecallMatch } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { explainRecallMatch } from '@/core/recall/explain-recall-match'
import { buildRecallCardHighlightParts } from '@/core/recall/highlight-recall-text'
import { formatRecallSavedTime } from '@/core/recall/format-recall-saved-time'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'

/** `toRecallMatchCard` 可选行为。 */
export interface RecallMatchCardOptions {
  includeSiblings?: boolean
  rank?: number
  /** detail 页绝对 URL（`chrome.runtime.getURL('detail.html')`）。 */
  detailPageUrl: string
}

/**
 * 将 RecallMatch 映射为结果卡展示模型（含可选折叠组与 TTE rank）。
 */
export function toRecallMatchCard(
  match: RecallMatch,
  resultClue: string,
  t: TranslateFn,
  options: RecallMatchCardOptions
): RecallCardModel {
  const display = getMemoryItemDisplay(match.item, t)
  const explanation = explainRecallMatch(
    {
      clue: resultClue,
      matchedFields: match.matchedFields,
      item: match.item
    },
    t
  )
  const highlights = buildRecallCardHighlightParts({
    clue: resultClue,
    matchedFields: match.matchedFields,
    item: match.item,
    title: display.title,
    subtitle: display.subtitle,
    ...(display.excerpt === undefined ? {} : { excerpt: display.excerpt }),
    ...(display.note === undefined ? {} : { note: display.note })
  })

  const duplicateTotalCount = match.duplicateGroup?.totalCount
  const duplicateLabel =
    duplicateTotalCount !== undefined && duplicateTotalCount >= 2
      ? match.item.type === 'bookmark'
        ? t('popup_duplicate_group_bookmark', String(duplicateTotalCount))
        : t('popup_duplicate_group_excerpt', String(duplicateTotalCount))
      : undefined

  const savedLabels = formatRecallSavedTime(match.item.createdAt, {
    justSavedLabel: t('recall_card_saved_just_now')
  })

  const siblings =
    options.includeSiblings !== false && match.duplicateGroup
      ? match.duplicateGroup.siblings.map(sibling =>
          toRecallMatchCard(sibling, resultClue, t, {
            detailPageUrl: options.detailPageUrl,
            includeSiblings: false
          })
        )
      : undefined

  return {
    id: match.item.id,
    itemKind: match.item.type === 'bookmark' ? 'bookmark' : 'text_excerpt',
    title: display.title,
    subtitle: display.subtitle,
    url: getMemoryItemOpenHref(match.item, {
      detailPageUrl: options.detailPageUrl
    }),
    typeLabel: display.typeLabel,
    savedAtIso: match.item.createdAt,
    reasonLine: explanation.reasonLine,
    reasonCodes: [...new Set(match.matchedFields)],
    ...(savedLabels
      ? {
          savedAtLabel: t('recall_card_saved', savedLabels.relative),
          savedAtTitle: savedLabels.absolute
        }
      : {}),
    titleParts: highlights.titleParts,
    subtitleParts: highlights.subtitleParts,
    excerptParts: highlights.excerptParts,
    noteParts: highlights.noteParts,
    ...(display.excerpt === undefined ? {} : { excerpt: display.excerpt }),
    ...(display.note === undefined ? {} : { note: display.note }),
    ...(duplicateTotalCount !== undefined &&
    duplicateTotalCount >= 2 &&
    duplicateLabel !== undefined
      ? { duplicateTotalCount, duplicateLabel }
      : {}),
    ...(siblings && siblings.length > 0 ? { siblings } : {}),
    ...(options.rank !== undefined ? { telemetryRank: options.rank } : {})
  }
}
