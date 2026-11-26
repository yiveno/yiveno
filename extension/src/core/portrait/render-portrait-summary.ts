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
    case 'inferred':
      return t('portrait_fact_inferred', [value])
    case 'paraphrase':
    default:
      return t('portrait_fact_paraphrase', [value])
  }
}

export type PortraitSummaryViewItem = {
  factId: string
  line: string
  inPortrait: boolean
  pendingInference: boolean
  /** 事实值；批准后按 direct 重渲染需要 */
  value: string
}

export type PortraitSummaryViewModel = {
  empty: boolean
  emptyText: string
  introText: string
  groups: Array<{
    key: PortraitSummaryGroup
    title: string
    items: PortraitSummaryViewItem[]
  }>
  pendingInferences: Array<{
    factId: string
    line: string
    value: string
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
          pendingInference: item.pendingInference,
          value: item.value
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
      line: renderPortraitFactLine(item, t),
      value: item.value
    }))
  }
}

/**
 * 批准推断项：移入 verified，行文案改 direct 措辞（与已核实组一致）。
 * 纯本地视图更新；调用方负责先写库。
 */
export function applyPortraitApproveToView(
  view: PortraitSummaryViewModel,
  factId: string,
  t: TranslateFn
): PortraitSummaryViewModel {
  const pending = view.pendingInferences.find(item => item.factId === factId)
  const nextPending = view.pendingInferences.filter(item => item.factId !== factId)
  const nextGroups = view.groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.factId !== factId)
    }))
    .filter(group => group.items.length > 0)
  if (pending) {
    const item: PortraitSummaryViewItem = {
      factId,
      value: pending.value,
      line: renderPortraitFactLine(
        {
          factId,
          slot: 'contentTerm',
          value: pending.value,
          credibility: 0.8,
          state: 'verified',
          inPortrait: true,
          wording: 'direct',
          pendingInference: false,
          sourceTypes: []
        },
        t
      ),
      inPortrait: true,
      pendingInference: false
    }
    const verifiedGroup = nextGroups.find(g => g.key === 'verified')
    if (verifiedGroup) {
      verifiedGroup.items = [item, ...verifiedGroup.items]
    } else {
      nextGroups.unshift({
        key: 'verified',
        title: t('portrait_group_verified'),
        items: [item]
      })
    }
  }
  return {
    ...view,
    empty: nextGroups.every(g => g.items.length === 0) && nextPending.length === 0,
    groups: nextGroups,
    pendingInferences: nextPending
  }
}

/**
 * 忽略推断项：从 pending 与各组移除；若清空则标 empty。
 */
export function applyPortraitDeclineToView(
  view: PortraitSummaryViewModel,
  factId: string,
  t?: TranslateFn
): PortraitSummaryViewModel {
  const nextPending = view.pendingInferences.filter(item => item.factId !== factId)
  const nextGroups = view.groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.factId !== factId)
    }))
    .filter(group => group.items.length > 0)
  const empty = nextGroups.every(g => g.items.length === 0) && nextPending.length === 0
  return {
    ...view,
    empty,
    emptyText: empty && t ? t('portrait_empty') : view.emptyText,
    groups: nextGroups,
    pendingInferences: nextPending
  }
}
