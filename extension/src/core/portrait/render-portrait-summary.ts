/**
 * 画像摘要 → UI 文案（§9.7 措辞；经 t()）。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type {
  PortraitSummary,
  PortraitSummaryGroup,
  PortraitSummaryItem
} from '@/core/portrait/build-portrait-summary'

const GROUP_I18N: Record<PortraitSummaryGroup, string> = {
  verified: 'portrait_group_verified',
  corroborated: 'portrait_group_corroborated',
  unconfirmed: 'portrait_group_unconfirmed',
  contested: 'portrait_group_contested'
}

/** 单条事实措辞。 */
export function renderPortraitFactLine(item: PortraitSummaryItem, t: TranslateFn): string {
  const value = item.value
  switch (item.wording) {
    case 'direct':
      return t('portrait_fact_direct', [value])
    case 'hedged':
      return t('portrait_fact_hedged', [value])
    case 'juxtapose':
      return t('portrait_fact_juxtapose', [value])
    case 'paraphrase':
    default:
      return t('portrait_fact_paraphrase', [value])
  }
}

export type PortraitSummaryViewModel = {
  empty: boolean
  emptyText: string
  introText: string
  groups: Array<{
    key: PortraitSummaryGroup
    title: string
    items: Array<{
      factId: string
      line: string
      inPortrait: boolean
      pendingInference: boolean
    }>
  }>
  pendingInferences: Array<{
    factId: string
    line: string
  }>
}

/** 构建可渲染视图模型。 */
export function buildPortraitSummaryViewModel(
  summary: PortraitSummary,
  t: TranslateFn
): PortraitSummaryViewModel {
  if (summary.empty) {
    return {
      empty: true,
      emptyText: t('portrait_empty'),
      introText: '',
      groups: [],
      pendingInferences: []
    }
  }
  const groupOrder: PortraitSummaryGroup[] = [
    'verified',
    'corroborated',
    'unconfirmed',
    'contested'
  ]
  const groups = groupOrder
    .map(key => {
      const items = summary.groups[key]
      if (items.length === 0) {
        return null
      }
      return {
        key,
        title: t(GROUP_I18N[key]),
        items: items.map(item => ({
          factId: item.factId,
          line: renderPortraitFactLine(item, t),
          inPortrait: item.inPortrait,
          pendingInference: item.pendingInference
        }))
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  return {
    empty: false,
    emptyText: '',
    introText: t('portrait_intro'),
    groups,
    pendingInferences: summary.pendingInferences.map(item => ({
      factId: item.factId,
      line: renderPortraitFactLine(item, t)
    }))
  }
}
