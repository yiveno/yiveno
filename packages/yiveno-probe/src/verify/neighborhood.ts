/**
 * DEV：邻域对拍判定（纯函数；与 recall-eval in_topk / top1 语义对齐）。
 */

export type ProbeVerifyVerdict =
  | 'top1' // 排序第 1
  | 'in_topk' // 在 top-k 内但非 Top1
  | 'miss' // top-k 外或空池

/**
 * @param rankedIds 邻域有序 id（topPick 在前，再 alsoPossible）
 * @param expectedId 期望 MemoryItem id
 * @param k top-k（默认 3）
 */
export function judgeProbeNeighborhood(
  rankedIds: readonly string[],
  expectedId: string,
  k = 3
): ProbeVerifyVerdict {
  const index = rankedIds.indexOf(expectedId)
  if (index < 0 || index >= k) {
    return 'miss'
  }
  if (index === 0) {
    return 'top1'
  }
  return 'in_topk'
}

/** 从 RecallResult 抽出有序邻域 id。 */
export function rankedIdsFromRecallResult(result: {
  topPick: { item: { id: string } } | null
  alsoPossible: Array<{ item: { id: string } }>
}): string[] {
  const ids: string[] = []
  if (result.topPick) {
    ids.push(result.topPick.item.id)
  }
  for (const match of result.alsoPossible) {
    ids.push(match.item.id)
  }
  return ids
}
