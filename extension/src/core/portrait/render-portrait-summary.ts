/**
 * 画像摘要 → UI 文案（§9.7 措辞 + 确定性叙事提炼；经 t()）。
 * LLM 组装不可用时，summaryText / narrative 为最终展示文案。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type {
  PortraitSummary,
  PortraitSummaryGroup,
  PortraitSummaryItem
} from '@/core/portrait/build-portrait-summary'
import { buildPortraitFactSignature } from '@/core/portrait/portrait-narrative-signature'

const GROUP_I18N: Record<PortraitSummaryGroup, string> = {
  verified: 'portrait_group_verified',
  corroborated: 'portrait_group_corroborated',
  unconfirmed: 'portrait_group_unconfirmed',
  contested: 'portrait_group_contested'
}

const NARRATIVE_I18N: Record<PortraitSummaryGroup, { base: string; more: string }> = {
  verified: {
    base: 'portrait_narrative_verified',
    more: 'portrait_narrative_verified_more'
  },
  corroborated: {
    base: 'portrait_narrative_corroborated',
    more: 'portrait_narrative_corroborated_more'
  },
  unconfirmed: {
    base: 'portrait_narrative_unconfirmed',
    more: 'portrait_narrative_unconfirmed_more'
  },
  contested: {
    base: 'portrait_narrative_contested',
    more: 'portrait_narrative_contested_more'
  }
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
  /** 可信度；叙事提炼排序用 */
  credibility: number
  state: PortraitSummaryItem['state']
}

export type PortraitSummaryViewModel = {
  empty: boolean
  emptyText: string
  introText: string
  /** 总述段落（确定性兜底；可被 LLM 文案替换） */
  summaryText: string
  groups: Array<{
    key: PortraitSummaryGroup
    title: string
    /** 组级叙事（确定性提炼） */
    narrative: string
    items: PortraitSummaryViewItem[]
  }>
  /** pending 区叙事 */
  pendingNarrative: string
  pendingInferences: Array<{
    factId: string
    line: string
    value: string
  }>
  /** 事实签名（LLM 缓存键） */
  factSignature: string
}

/** 代表项拼接：zh 顿号 / en 逗号空格（由文案语言侧适应；此处统一顿号+逗号兼容）。 */
function joinRepresentativeValues(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? ''
  }
  // 含非 ASCII → 顿号；否则英文逗号
  const useIdeographic = values.some(v => /[^\u0000-\u007f]/.test(v))
  return values.join(useIdeographic ? '、' : ', ')
}

/**
 * 组内按 credibility 降序取前 3 为代表；其余收成数量。
 */
export function renderPortraitGroupNarrative(
  key: PortraitSummaryGroup,
  items: Array<{ value: string; credibility: number }>,
  t: TranslateFn
): string {
  if (items.length === 0) {
    return ''
  }
  const sorted = [...items].sort((a, b) => b.credibility - a.credibility)
  const top = sorted.slice(0, 3).map(i => i.value)
  const rest = sorted.length - top.length
  const joined = joinRepresentativeValues(top)
  const keys = NARRATIVE_I18N[key]
  if (rest > 0) {
    return t(keys.more, [joined, String(rest)])
  }
  return t(keys.base, [joined])
}

/** pending 叙事提炼。 */
export function renderPortraitPendingNarrative(
  items: Array<{ value: string; credibility?: number }>,
  t: TranslateFn
): string {
  if (items.length === 0) {
    return ''
  }
  const sorted = [...items].sort(
    (a, b) => (b.credibility ?? 0) - (a.credibility ?? 0) || a.value.localeCompare(b.value)
  )
  const top = sorted.slice(0, 3).map(i => i.value)
  const rest = sorted.length - top.length
  const joined = joinRepresentativeValues(top)
  if (rest > 0) {
    return t('portrait_narrative_pending_more', [joined, String(rest)])
  }
  return t('portrait_narrative_pending', [joined])
}

/**
 * 组装总述：lead（verified）+ contested/pending 计数；无 verified 时用首个非空组 narrative。
 */
export function buildPortraitSummaryText(input: {
  groups: Array<{
    key: PortraitSummaryGroup
    narrative: string
    items: Array<{ value: string; credibility: number }>
  }>
  pendingCount: number
  contestedCount: number
  t: TranslateFn
}): string {
  const parts: string[] = []
  const verified = input.groups.find(g => g.key === 'verified')
  if (verified && verified.items.length > 0) {
    const sorted = [...verified.items].sort((a, b) => b.credibility - a.credibility)
    const top = sorted.slice(0, 3).map(i => i.value)
    const rest = sorted.length - top.length
    const joined = joinRepresentativeValues(top)
    parts.push(
      rest > 0
        ? input.t('portrait_summary_lead_more', [joined, String(rest)])
        : input.t('portrait_summary_lead', [joined])
    )
  } else {
    const first = input.groups.find(g => g.narrative)
    if (first?.narrative) {
      parts.push(first.narrative)
    }
  }
  if (input.contestedCount > 0) {
    parts.push(input.t('portrait_summary_contested_count', [String(input.contestedCount)]))
  }
  if (input.pendingCount > 0) {
    parts.push(input.t('portrait_summary_pending_count', [String(input.pendingCount)]))
  }
  return parts.join(' ')
}

function toViewItem(item: PortraitSummaryItem, t: TranslateFn): PortraitSummaryViewItem {
  return {
    factId: item.factId,
    line: renderPortraitFactLine(item, t),
    inPortrait: item.inPortrait,
    pendingInference: item.pendingInference,
    value: item.value,
    credibility: item.credibility,
    state: item.state
  }
}

/** 从当前 groups/pending 重算叙事与签名（批准/忽略后调用）。 */
export function refreshPortraitSummaryNarratives(
  view: PortraitSummaryViewModel,
  t: TranslateFn
): PortraitSummaryViewModel {
  if (view.empty) {
    return {
      ...view,
      summaryText: '',
      pendingNarrative: '',
      factSignature: ''
    }
  }
  const groups = view.groups.map(group => ({
    ...group,
    narrative: renderPortraitGroupNarrative(group.key, group.items, t)
  }))
  const pendingNarrative = renderPortraitPendingNarrative(
    view.pendingInferences.map(p => ({ value: p.value, credibility: 0 })),
    t
  )
  const contestedCount =
    groups.find(g => g.key === 'contested')?.items.length ??
    groups.reduce((n, g) => n + (g.key === 'contested' ? g.items.length : 0), 0)
  const summaryText = buildPortraitSummaryText({
    groups,
    pendingCount: view.pendingInferences.length,
    contestedCount,
    t
  })
  const signatureParts = [
    ...groups.flatMap(g =>
      g.items.map(i => ({
        factId: i.factId,
        state: i.state,
        inPortrait: i.inPortrait
      }))
    ),
    ...view.pendingInferences.map(p => {
      const fromGroup = groups.flatMap(g => g.items).find(i => i.factId === p.factId)
      return {
        factId: p.factId,
        state: fromGroup?.state ?? 'unconfirmed',
        inPortrait: false
      }
    })
  ]
  // pending 可能已在 groups 中，按 factId 去重
  const seen = new Set<string>()
  const deduped = signatureParts.filter(p => {
    if (seen.has(p.factId)) {
      return false
    }
    seen.add(p.factId)
    return true
  })
  return {
    ...view,
    groups,
    pendingNarrative,
    summaryText,
    factSignature: buildPortraitFactSignature(deduped)
  }
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
      summaryText: '',
      groups: [],
      pendingNarrative: '',
      pendingInferences: [],
      factSignature: ''
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
      const viewItems = items.map(item => toViewItem(item, t))
      return {
        key,
        title: t(GROUP_I18N[key]),
        narrative: renderPortraitGroupNarrative(key, viewItems, t),
        items: viewItems
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  const pendingInferences = summary.pendingInferences.map(item => ({
    factId: item.factId,
    line: renderPortraitFactLine(item, t),
    value: item.value
  }))

  const base: PortraitSummaryViewModel = {
    empty: false,
    emptyText: '',
    introText: t('portrait_intro'),
    summaryText: '',
    groups,
    pendingNarrative: '',
    pendingInferences,
    factSignature: ''
  }
  return refreshPortraitSummaryNarratives(base, t)
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
      pendingInference: false,
      credibility: 0.8,
      state: 'verified'
    }
    const verifiedGroup = nextGroups.find(g => g.key === 'verified')
    if (verifiedGroup) {
      verifiedGroup.items = [item, ...verifiedGroup.items]
    } else {
      nextGroups.unshift({
        key: 'verified',
        title: t('portrait_group_verified'),
        narrative: '',
        items: [item]
      })
    }
  }
  const next: PortraitSummaryViewModel = {
    ...view,
    empty: nextGroups.every(g => g.items.length === 0) && nextPending.length === 0,
    groups: nextGroups,
    pendingInferences: nextPending
  }
  if (next.empty) {
    return {
      ...next,
      emptyText: t('portrait_empty'),
      summaryText: '',
      pendingNarrative: '',
      factSignature: ''
    }
  }
  return refreshPortraitSummaryNarratives(next, t)
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
  const next: PortraitSummaryViewModel = {
    ...view,
    empty,
    emptyText: empty && t ? t('portrait_empty') : view.emptyText,
    groups: nextGroups,
    pendingInferences: nextPending
  }
  if (empty || !t) {
    return {
      ...next,
      summaryText: empty ? '' : next.summaryText,
      pendingNarrative: empty ? '' : next.pendingNarrative,
      factSignature: empty ? '' : next.factSignature
    }
  }
  return refreshPortraitSummaryNarratives(next, t)
}
