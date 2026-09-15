import type { TranslateFn } from '@/core/i18n/translate'
import { explainRecallMatch } from '@/core/recall/explain-recall-match'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { getMemoryItemDisplay, type RecallMatch } from '@/core/recall/recall-result'

/** Getting Started 页内结果卡（轻量，非 Side Panel 全卡）。 */
export interface GettingStartedRecallCard {
  id: string
  title: string
  /** 展示用 host 或副标题 */
  host: string
  preview?: string
  reasonLine?: string
  url: string
}

function hostFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * 将 RecallMatch 映成 GS 页内卡。
 * detailPageUrl 供无外链条目打开详情页。
 */
export function mapGettingStartedRecallCard(
  match: RecallMatch,
  resultClue: string,
  t: TranslateFn,
  detailPageUrl: string
): GettingStartedRecallCard {
  const display = getMemoryItemDisplay(match.item, t)
  let reasonLine: string | undefined
  try {
    reasonLine = explainRecallMatch(
      {
        clue: resultClue,
        matchedFields: match.matchedFields,
        item: match.item
      },
      t
    ).reasonLine
  } catch {
    reasonLine = undefined
  }
  const url = getMemoryItemOpenHref(match.item, { detailPageUrl })
  const host = hostFromUrl(url) || display.subtitle.trim()
  const preview = display.excerpt?.trim() || display.note?.trim() || undefined
  return {
    id: match.item.id,
    title: display.title,
    host,
    url,
    ...(preview ? { preview } : {}),
    ...(reasonLine ? { reasonLine } : {})
  }
}
