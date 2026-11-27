/**
 * 画像摘要 → UI 文案（§9.7 措辞 + 确定性叙事提炼；经 t()）。
 * LLM 组装不可用时，summaryText / narrative 为最终展示文案。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type {
  PortraitPendingCluster,
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

/** 视图层待确认簇（仅浮出簇）。 */
export type PortraitPendingClusterView = {
  clusterId: string
  label: string
  count: number
  items: Array<{
    factId: string
    line: string
    value: string
    credibility: number
  }>
}

/** 视图层隐藏待确认项。 */
export type PortraitHiddenPendingViewItem = {
  factId: string
  line: string
  value: string
  credibility: number
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
  /** pending 区叙事（按浮出簇 label） */
  pendingNarrative: string
  /** 浮出待确认簇 */
  clusters: PortraitPendingClusterView[]
  /** 隐藏区可操作项 */
  hiddenPendingItems: PortraitHiddenPendingViewItem[]
  /** = hiddenPendingItems.length */
  hiddenPendingCount: number
  /** 事实签名（LLM 缓存键） */
  factSignature: string
}

/** 代表项拼接：zh 顿号 / en 逗号空格。 */
function joinRepresentativeValues(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? ''
  }
  const useIdeographic = values.some(v => /[^\u0000-\u007f]/.test(v))
  return values.join(useIdeographic ? '、' : ', ')
}

/**
 * 簇副行：至多 5 个成员 + 等 N 项。
 */
export function formatPortraitClusterMemberLine(values: readonly string[], t: TranslateFn): string {
  const top = values.slice(0, 5)
  const rest = values.length - top.length
  const joined = joinRepresentativeValues([...top])
  if (rest > 0) {
    return t('portrait_pending_cluster_members_more', [joined, String(rest)])
  }
  return joined
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

/**
 * pending 叙事提炼：按浮出簇 label；前 3 + 总簇数余量。
 */
export function renderPortraitPendingNarrative(
  clusters: Array<{ label: string; credibility?: number }>,
  t: TranslateFn
): string {
  if (clusters.length === 0) {
    return ''
  }
  const sorted = [...clusters].sort(
    (a, b) => (b.credibility ?? 0) - (a.credibility ?? 0) || a.label.localeCompare(b.label)
  )
  const top = sorted.slice(0, 3).map(c => c.label)
  const rest = sorted.length - top.length
  const joined = joinRepresentativeValues(top)
  if (rest > 0) {
    return t('portrait_narrative_pending_more', [joined, String(rest)])
  }
  return t('portrait_narrative_pending', [joined])
}

/**
 * 组装总述：lead（verified）+ contested/pending 计数；无 verified 时用首个非空组 narrative。
 * pendingCount = 浮出簇数。
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

function toClusterView(
  cluster: PortraitPendingCluster,
  t: TranslateFn
): PortraitPendingClusterView {
  return {
    clusterId: cluster.clusterId,
    label: cluster.label,
    count: cluster.count,
    items: cluster.items.map(item => ({
      factId: item.factId,
      line: renderPortraitFactLine(item, t),
      value: item.value,
      credibility: item.credibility
    }))
  }
}

function toHiddenView(item: PortraitSummaryItem, t: TranslateFn): PortraitHiddenPendingViewItem {
  return {
    factId: item.factId,
    line: renderPortraitFactLine(item, t),
    value: item.value,
    credibility: item.credibility
  }
}

/** 簇内最高 credibility（叙事排序）。 */
function clusterMaxCredibility(cluster: PortraitPendingClusterView): number {
  return cluster.items[0]?.credibility ?? 0
}

/** 从当前 groups/clusters/hidden 重算叙事与签名。 */
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
    view.clusters.map(c => ({
      label: c.label,
      credibility: clusterMaxCredibility(c)
    })),
    t
  )
  const contestedCount =
    groups.find(g => g.key === 'contested')?.items.length ??
    groups.reduce((n, g) => n + (g.key === 'contested' ? g.items.length : 0), 0)
  const summaryText = buildPortraitSummaryText({
    groups,
    pendingCount: view.clusters.length,
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
    ...view.clusters.flatMap(c =>
      c.items.map(p => ({
        factId: p.factId,
        state: 'unconfirmed' as const,
        inPortrait: false
      }))
    ),
    ...view.hiddenPendingItems.map(p => ({
      factId: p.factId,
      state: 'unconfirmed' as const,
      inPortrait: false
    }))
  ]
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

/** 构建可渲染视图模型（clusters 仅浮出簇）。 */
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
      clusters: [],
      hiddenPendingItems: [],
      hiddenPendingCount: 0,
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

  const clusters = summary.clusters
    .filter(c => c.surfaced)
    .map(cluster => toClusterView(cluster, t))
  const hiddenPendingItems = summary.hiddenPendingItems.map(item => toHiddenView(item, t))

  const base: PortraitSummaryViewModel = {
    empty: false,
    emptyText: '',
    introText: t('portrait_intro'),
    summaryText: '',
    groups,
    pendingNarrative: '',
    clusters,
    hiddenPendingItems,
    hiddenPendingCount: hiddenPendingItems.length,
    factSignature: ''
  }
  return refreshPortraitSummaryNarratives(base, t)
}

/** 从簇中移除若干 factId；空簇丢弃；单成员时 label 回落为 value。 */
function removeFactsFromClusters(
  clusters: PortraitPendingClusterView[],
  factIds: ReadonlySet<string>
): PortraitPendingClusterView[] {
  const next: PortraitPendingClusterView[] = []
  for (const cluster of clusters) {
    const items = cluster.items.filter(item => !factIds.has(item.factId))
    if (items.length === 0) {
      continue
    }
    const label = items.length === 1 ? (items[0]?.value ?? cluster.label) : cluster.label
    next.push({
      clusterId: cluster.clusterId,
      label,
      count: items.length,
      items
    })
  }
  next.sort((a, b) => {
    const maxA = a.items[0]?.credibility ?? 0
    const maxB = b.items[0]?.credibility ?? 0
    return maxB - maxA || b.count - a.count || a.label.localeCompare(b.label)
  })
  return next
}

function findPendingInView(
  view: PortraitSummaryViewModel,
  factId: string
): { value: string; credibility: number } | null {
  for (const cluster of view.clusters) {
    const hit = cluster.items.find(item => item.factId === factId)
    if (hit) {
      return hit
    }
  }
  const hidden = view.hiddenPendingItems.find(item => item.factId === factId)
  return hidden ?? null
}

function isViewEffectivelyEmpty(view: {
  groups: Array<{ items: unknown[] }>
  clusters: unknown[]
  hiddenPendingItems: unknown[]
}): boolean {
  return (
    view.groups.every(g => g.items.length === 0) &&
    view.clusters.length === 0 &&
    view.hiddenPendingItems.length === 0
  )
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
  const pending = findPendingInView(view, factId)
  const nextClusters = removeFactsFromClusters(view.clusters, new Set([factId]))
  const nextHidden = view.hiddenPendingItems.filter(item => item.factId !== factId)
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
          sourceTypes: [],
          sourceNoteRefs: []
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
    empty: isViewEffectivelyEmpty({
      groups: nextGroups,
      clusters: nextClusters,
      hiddenPendingItems: nextHidden
    }),
    groups: nextGroups,
    clusters: nextClusters,
    hiddenPendingItems: nextHidden,
    hiddenPendingCount: nextHidden.length
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
 * 整簇批准：依次按单项批准语义更新视图。
 */
export function applyPortraitApproveClusterToView(
  view: PortraitSummaryViewModel,
  factIds: readonly string[],
  t: TranslateFn
): PortraitSummaryViewModel {
  let next = view
  for (const factId of factIds) {
    next = applyPortraitApproveToView(next, factId, t)
  }
  return next
}

/**
 * 忽略推断项：从 clusters / hidden / 各组移除；若清空则标 empty。
 */
export function applyPortraitDeclineToView(
  view: PortraitSummaryViewModel,
  factId: string,
  t?: TranslateFn
): PortraitSummaryViewModel {
  const nextClusters = removeFactsFromClusters(view.clusters, new Set([factId]))
  const nextHidden = view.hiddenPendingItems.filter(item => item.factId !== factId)
  const nextGroups = view.groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.factId !== factId)
    }))
    .filter(group => group.items.length > 0)
  const empty = isViewEffectivelyEmpty({
    groups: nextGroups,
    clusters: nextClusters,
    hiddenPendingItems: nextHidden
  })
  const next: PortraitSummaryViewModel = {
    ...view,
    empty,
    emptyText: empty && t ? t('portrait_empty') : view.emptyText,
    groups: nextGroups,
    clusters: nextClusters,
    hiddenPendingItems: nextHidden,
    hiddenPendingCount: nextHidden.length
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

/**
 * 整簇忽略 / 隐藏区全部忽略。
 */
export function applyPortraitDeclineClusterToView(
  view: PortraitSummaryViewModel,
  factIds: readonly string[],
  t?: TranslateFn
): PortraitSummaryViewModel {
  let next = view
  for (const factId of factIds) {
    next = applyPortraitDeclineToView(next, factId, t)
  }
  return next
}
