/**
 * 画像可查性摘要：按状态分组 + §9.7 措辞（确定性，零 LLM）。
 * 待确认项：共现/语义划分 → 按簇浮出；功能词过滤不变。
 */

import { clusterPendingInferences } from '@/core/portrait/cluster-pending-inferences'
import { isPortraitFunctionalTopicAnchor } from '@/core/portrait/portrait-functional-terms'
import type { PortraitClusterPartitionCluster } from '@/core/portrait/validate-portrait-clusters'
import {
  portraitContestedSlots,
  portraitWordingKind,
  resolvePortraitFactState,
  type PortraitFactRecord,
  type PortraitFactState,
  type PortraitWordingKind
} from '@/core/portrait/portrait-facts'

/** 摘要分组键（invalid 不进摘要）。 */
export type PortraitSummaryGroup =
  | 'verified' // 已核实
  | 'corroborated' // 已佐证
  | 'unconfirmed' // 未确认
  | 'contested' // 有争议

/** 簇浮出：任一成员 credibility ≥ 此值 → 浮出。 */
export const PENDING_DISPLAY_MIN_CREDIBILITY = 0.5

/** 送入语义/共现聚类的待确认项上限；超出按 credibility 取前 N，其余进隐藏。 */
export const PORTRAIT_CLUSTER_INPUT_CAP = 60

/** @deprecated 旧单条门槛来源数；浮出已改按簇，仅保留兼容引用。 */
export const PENDING_DISPLAY_MIN_SOURCE_REFS = 2

/** 单条摘要项（供 UI / i18n 渲染）。 */
export type PortraitSummaryItem = {
  factId: string
  slot: PortraitFactRecord['slot']
  value: string
  credibility: number
  state: Exclude<PortraitFactState, 'invalid'>
  inPortrait: boolean
  wording: PortraitWordingKind
  /** 推断来源且未进画像 → 供批准/忽略 */
  pendingInference: boolean
  sourceTypes: string[]
  /** 推断来源 note ref（共现聚类用） */
  sourceNoteRefs: string[]
}

/** 待确认簇（摘要层）。 */
export type PortraitPendingCluster = {
  clusterId: string
  label: string
  count: number
  /** 簇成员 ≥2 或任一成员 credibility ≥0.5 */
  surfaced: boolean
  items: PortraitSummaryItem[]
}

/** 画像查询摘要。 */
export type PortraitSummary = {
  groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]>
  /** 全部待确认簇（含 surfaced 标记） */
  clusters: PortraitPendingCluster[]
  /** 隐藏簇成员展平 + 超 cap 溢出项 */
  hiddenPendingItems: PortraitSummaryItem[]
  /** = hiddenPendingItems.length（日志/旧调用兼容） */
  hiddenPendingCount: number
  /** 是否完全空（无可见非 invalid 事实，且无隐藏待确认） */
  empty: boolean
}

const GROUP_ORDER: PortraitSummaryGroup[] = ['verified', 'corroborated', 'unconfirmed', 'contested']

function toGroup(state: Exclude<PortraitFactState, 'invalid'>): PortraitSummaryGroup {
  return state
}

/** 独立来源数：sources 中不同 ref（同一 note 多次只算 1）。 */
export function countDistinctPortraitSourceRefs(sources: readonly { ref: string }[]): number {
  return new Set(sources.map(s => s.ref)).size
}

/** 簇是否浮出展示。 */
export function isPortraitClusterSurfaced(items: readonly { credibility: number }[]): boolean {
  return (
    items.length >= 2 || items.some(item => item.credibility >= PENDING_DISPLAY_MIN_CREDIBILITY)
  )
}

/** @deprecated 旧单条门槛；新浮出按簇。保留供旧测试/探针对照。 */
export function meetsPendingInferenceDisplayThreshold(fact: {
  credibility: number
  sources: readonly { ref: string }[]
}): boolean {
  return (
    fact.credibility >= PENDING_DISPLAY_MIN_CREDIBILITY ||
    countDistinctPortraitSourceRefs(fact.sources) >= PENDING_DISPLAY_MIN_SOURCE_REFS
  )
}

/** FNV-1a 32-bit → hex（簇 id）。 */
function hashSortedFactIds(factIds: readonly string[]): string {
  const key = [...factIds].sort((a, b) => a.localeCompare(b)).join('\0')
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function toItem(
  fact: PortraitFactRecord,
  contested: ReadonlySet<string>
): PortraitSummaryItem | null {
  if (fact.state === 'invalid') {
    return null
  }
  const sourceTypes = [...new Set(fact.sources.map(s => s.type))]
  const effectiveState = resolvePortraitFactState(fact.credibility, {
    hasCloseContradiction: contested.has(fact.slot)
  })
  if (effectiveState === 'invalid') {
    return null
  }
  const pendingInference = !fact.inPortrait && fact.sources.some(s => s.type === 'inference')
  const sourceNoteRefs = [
    ...new Set(fact.sources.filter(s => s.type === 'inference').map(s => s.ref))
  ]
  return {
    factId: fact.id,
    slot: fact.slot,
    value: fact.value,
    credibility: fact.credibility,
    state: effectiveState,
    inPortrait: fact.inPortrait,
    wording: portraitWordingKind(fact.credibility, effectiveState, sourceTypes),
    pendingInference,
    sourceTypes,
    sourceNoteRefs
  }
}

/**
 * 将划分（label + value 列表）落到摘要项，产出簇 + 隐藏成员。
 * overflow 直接进隐藏（不参与划分）。
 */
export function materializePortraitPendingClusters(input: {
  clusterItems: readonly PortraitSummaryItem[]
  overflowItems: readonly PortraitSummaryItem[]
  partition: readonly PortraitClusterPartitionCluster[]
}): {
  clusters: PortraitPendingCluster[]
  hiddenPendingItems: PortraitSummaryItem[]
} {
  const byValue = new Map(input.clusterItems.map(item => [item.value, item]))
  const clusters: PortraitPendingCluster[] = []
  const hiddenFromClusters: PortraitSummaryItem[] = []
  const used = new Set<string>()

  for (const part of input.partition) {
    const members: PortraitSummaryItem[] = []
    for (const value of part.items) {
      const item = byValue.get(value)
      if (!item || used.has(item.factId)) {
        continue
      }
      used.add(item.factId)
      members.push(item)
    }
    if (members.length === 0) {
      continue
    }
    const itemsSorted = [...members].sort(
      (a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value)
    )
    const surfaced = isPortraitClusterSurfaced(itemsSorted)
    const cluster: PortraitPendingCluster = {
      clusterId: hashSortedFactIds(itemsSorted.map(m => m.factId)),
      label: part.label,
      count: itemsSorted.length,
      surfaced,
      items: itemsSorted
    }
    clusters.push(cluster)
    if (!surfaced) {
      hiddenFromClusters.push(...itemsSorted)
    }
  }

  // 划分未覆盖的残差 → 隐藏（防御）
  for (const item of input.clusterItems) {
    if (!used.has(item.factId)) {
      hiddenFromClusters.push(item)
    }
  }

  clusters.sort((a, b) => {
    const maxA = a.items[0]?.credibility ?? 0
    const maxB = b.items[0]?.credibility ?? 0
    return maxB - maxA || b.count - a.count || a.label.localeCompare(b.label)
  })

  return {
    clusters,
    hiddenPendingItems: [...hiddenFromClusters, ...input.overflowItems]
  }
}

/** 共现划分（value 列表形，供缺省 / 回退）。 */
export function cooccurrencePartitionForSummaryItems(
  items: readonly PortraitSummaryItem[]
): PortraitClusterPartitionCluster[] {
  const raw = clusterPendingInferences(
    items.map(item => ({
      factId: item.factId,
      value: item.value,
      credibility: item.credibility,
      sourceNoteRefs: item.sourceNoteRefs
    }))
  )
  return raw.map(cluster => ({
    label: cluster.label,
    items: cluster.items.map(row => row.value)
  }))
}

export type BuildPortraitSummaryOptions = {
  /** 语义划分；缺省走共现 */
  clusterPartition?: readonly PortraitClusterPartitionCluster[]
}

/**
 * 从 B 层行构建摘要（排除 invalid）。
 * pending：非功能词 → 按 credibility 取前 60 聚类；簇浮出或进隐藏。
 * 读侧按互斥槽重算 contested，存量误标 contentTerm 可自愈。
 */
export function buildPortraitSummary(
  facts: readonly PortraitFactRecord[],
  options?: BuildPortraitSummaryOptions
): PortraitSummary {
  const contested = portraitContestedSlots(facts)
  const groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]> = {
    verified: [],
    corroborated: [],
    unconfirmed: [],
    contested: []
  }
  const pendingAll: PortraitSummaryItem[] = []
  let anySettled = false

  for (const fact of facts) {
    const item = toItem(fact, contested)
    if (!item) {
      continue
    }
    if (item.pendingInference) {
      // 功能词存量行 → 不展示、不进隐藏区可操作列表
      if (isPortraitFunctionalTopicAnchor(item.value)) {
        continue
      }
      pendingAll.push(item)
      continue
    }
    anySettled = true
    groups[toGroup(item.state)].push(item)
  }

  pendingAll.sort((a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value))
  const clusterItems = pendingAll.slice(0, PORTRAIT_CLUSTER_INPUT_CAP)
  const overflowItems = pendingAll.slice(PORTRAIT_CLUSTER_INPUT_CAP)

  const partition = options?.clusterPartition ?? cooccurrencePartitionForSummaryItems(clusterItems)
  const { clusters, hiddenPendingItems } = materializePortraitPendingClusters({
    clusterItems,
    overflowItems,
    partition
  })

  // 浮出簇成员进 unconfirmed 组（与旧「展示项进分组」一致）
  const surfacedFactIds = new Set(
    clusters.filter(c => c.surfaced).flatMap(c => c.items.map(i => i.factId))
  )
  for (const item of clusterItems) {
    if (surfacedFactIds.has(item.factId)) {
      groups[toGroup(item.state)].push(item)
    }
  }

  for (const key of GROUP_ORDER) {
    groups[key].sort((a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value))
  }

  const hasSurfacedPending = clusters.some(c => c.surfaced)
  const empty = !anySettled && !hasSurfacedPending && hiddenPendingItems.length === 0

  return {
    groups,
    clusters,
    hiddenPendingItems,
    hiddenPendingCount: hiddenPendingItems.length,
    empty
  }
}

/** 从摘要收集全部 pending（簇成员 + 隐藏），再按 credibility 重切 60/溢出。 */
export function collectPendingItemsFromPortraitSummary(summary: PortraitSummary): {
  clusterItems: PortraitSummaryItem[]
  overflowItems: PortraitSummaryItem[]
} {
  const byId = new Map<string, PortraitSummaryItem>()
  for (const cluster of summary.clusters) {
    for (const item of cluster.items) {
      byId.set(item.factId, item)
    }
  }
  for (const item of summary.hiddenPendingItems) {
    byId.set(item.factId, item)
  }
  const all = [...byId.values()].sort(
    (a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value)
  )
  return {
    clusterItems: all.slice(0, PORTRAIT_CLUSTER_INPUT_CAP),
    overflowItems: all.slice(PORTRAIT_CLUSTER_INPUT_CAP)
  }
}

/**
 * 用新划分替换摘要中的待确认簇（保留非 pending 分组；浮出成员重写入 unconfirmed）。
 * 供 Side Panel 语义聚类刷新。
 */
export function replacePortraitSummaryClusters(
  summary: PortraitSummary,
  partition: readonly PortraitClusterPartitionCluster[]
): PortraitSummary {
  const { clusterItems, overflowItems } = collectPendingItemsFromPortraitSummary(summary)
  const { clusters, hiddenPendingItems } = materializePortraitPendingClusters({
    clusterItems,
    overflowItems,
    partition
  })

  const groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]> = {
    verified: summary.groups.verified.filter(i => !i.pendingInference),
    corroborated: summary.groups.corroborated.filter(i => !i.pendingInference),
    unconfirmed: summary.groups.unconfirmed.filter(i => !i.pendingInference),
    contested: summary.groups.contested.filter(i => !i.pendingInference)
  }
  const surfacedFactIds = new Set(
    clusters.filter(c => c.surfaced).flatMap(c => c.items.map(i => i.factId))
  )
  for (const item of clusterItems) {
    if (surfacedFactIds.has(item.factId)) {
      groups[toGroup(item.state)].push(item)
    }
  }
  for (const key of GROUP_ORDER) {
    groups[key].sort((a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value))
  }

  const anySettled = GROUP_ORDER.some(key => groups[key].some(item => !item.pendingInference))
  const hasSurfacedPending = clusters.some(c => c.surfaced)
  const empty = !anySettled && !hasSurfacedPending && hiddenPendingItems.length === 0

  return {
    groups,
    clusters,
    hiddenPendingItems,
    hiddenPendingCount: hiddenPendingItems.length,
    empty
  }
}
