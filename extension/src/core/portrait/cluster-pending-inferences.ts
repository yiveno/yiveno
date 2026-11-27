/**
 * 待确认推断项按来源共现聚类（连通分量）。
 * 共享同一 source note ref → 连边；单项自成一簇。
 */

/** 聚类输入项。 */
export type PendingInferenceClusterInput = {
  factId: string
  value: string
  credibility: number
  /** 推断来源 note ref（如 note:…）；用于共现连边 */
  sourceNoteRefs: readonly string[]
}

/** 簇内单项。 */
export type PendingInferenceClusterItem = {
  factId: string
  value: string
  credibility: number
}

/** 待确认簇。 */
export type PendingInferenceCluster = {
  /** 成员 factId 排序拼接后的哈希 */
  clusterId: string
  /** 簇内 credibility 最高项的 value；同分取字典序首个 */
  label: string
  /** 按 credibility 降序 */
  items: PendingInferenceClusterItem[]
  count: number
}

/** FNV-1a 32-bit → hex（簇 id，非密码学）。 */
function hashSortedFactIds(factIds: readonly string[]): string {
  const key = [...factIds].sort((a, b) => a.localeCompare(b)).join('\0')
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

/** 并查集：按 factId。 */
function unionFind(ids: readonly string[]): {
  find: (id: string) => string
  union: (a: string, b: string) => void
} {
  const parent = new Map<string, string>()
  for (const id of ids) {
    parent.set(id, id)
  }
  const find = (id: string): string => {
    let cur = id
    while (parent.get(cur) !== cur) {
      const p = parent.get(cur)!
      parent.set(cur, parent.get(p)!)
      cur = p
    }
    return cur
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) {
      parent.set(ra, rb)
    }
  }
  return { find, union }
}

function pickLabel(items: readonly PendingInferenceClusterItem[]): string {
  const sorted = [...items].sort(
    (a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value)
  )
  return sorted[0]?.value ?? ''
}

/**
 * 达门槛的 pending 项 → 共现簇。
 * 排序：簇内最高 credibility 降序，再按 count 降序。
 */
export function clusterPendingInferences(
  items: readonly PendingInferenceClusterInput[]
): PendingInferenceCluster[] {
  if (items.length === 0) {
    return []
  }
  const ids = items.map(item => item.factId)
  const { find, union } = unionFind(ids)

  // ref → 持有该 ref 的 factId 列表；同 ref 两两连边
  const refToFacts = new Map<string, string[]>()
  for (const item of items) {
    for (const ref of item.sourceNoteRefs) {
      const list = refToFacts.get(ref)
      if (list) {
        list.push(item.factId)
      } else {
        refToFacts.set(ref, [item.factId])
      }
    }
  }
  for (const factIds of refToFacts.values()) {
    for (let i = 1; i < factIds.length; i += 1) {
      union(factIds[0]!, factIds[i]!)
    }
  }

  const groups = new Map<string, PendingInferenceClusterItem[]>()
  for (const item of items) {
    const root = find(item.factId)
    const row: PendingInferenceClusterItem = {
      factId: item.factId,
      value: item.value,
      credibility: item.credibility
    }
    const list = groups.get(root)
    if (list) {
      list.push(row)
    } else {
      groups.set(root, [row])
    }
  }

  const clusters: PendingInferenceCluster[] = []
  for (const members of groups.values()) {
    const itemsSorted = [...members].sort(
      (a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value)
    )
    const factIds = itemsSorted.map(m => m.factId)
    clusters.push({
      clusterId: hashSortedFactIds(factIds),
      label: pickLabel(itemsSorted),
      items: itemsSorted,
      count: itemsSorted.length
    })
  }

  clusters.sort((a, b) => {
    const maxA = a.items[0]?.credibility ?? 0
    const maxB = b.items[0]?.credibility ?? 0
    return maxB - maxA || b.count - a.count || a.label.localeCompare(b.label)
  })

  return clusters
}
