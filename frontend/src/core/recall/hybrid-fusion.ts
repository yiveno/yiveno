/**
 * Hybrid Recall 融合：余弦相似度 + Reciprocal Rank Fusion（RRF）。
 * 纯函数；不依赖 Chrome / IndexedDB。
 */

/** 两向量余弦相似度；维度不一致或零向量 → 0。 */
export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0
  }
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i] ?? 0
    const b = right[i] ?? 0
    dot += a * b
    leftNorm += a * a
    rightNorm += b * b
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

export interface RankedId {
  id: string
  /** 列表中的 0-based 名次（0 = 第一） */
  rank: number
}

/**
 * Reciprocal Rank Fusion：score(id) = Σ 1/(k + rank + 1)
 * @param lists 多路已排序 id 列表（每路按相关性从高到低）
 * @param k RRF 常数，常用 60
 */
export function reciprocalRankFusion(lists: string[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>()
  for (const list of lists) {
    list.forEach((id, rank) => {
      const prev = scores.get(id) ?? 0
      scores.set(id, prev + 1 / (k + rank + 1))
    })
  }
  return scores
}

/**
 * 按 RRF 分降序返回 id；同分保持首次出现顺序稳定。
 */
export function sortIdsByRrf(lists: string[][], k = 60): string[] {
  const scores = reciprocalRankFusion(lists, k)
  return [...scores.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1]
      }
      return a[0].localeCompare(b[0])
    })
    .map(([id]) => id)
}
