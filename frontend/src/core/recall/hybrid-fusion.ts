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

/** Hybrid 语义近邻：从全扫描集取 Top-K（不限关键词池）。 */
export const HYBRID_SEMANTIC_NEIGHBOR_LIMIT = 24

/** 过低余弦视为噪声，不进入融合。 */
export const HYBRID_MIN_COSINE_SIMILARITY = 0.28

/** 无词面命中时，用余弦映射到 RecallMatch.score 的系数（0.4 → 20，可过 Top Pick 下限）。 */
export const HYBRID_SEMANTIC_SCORE_SCALE = 50

/**
 * 按 query 向量对已有 embedding 的条目排序，取过阈值的近邻。
 * 供 Hybrid 与关键词池并集；关键词为空时仍可单独成结果。
 */
export function rankIdsByCosineToQuery(
  queryVector: number[],
  candidates: { id: string; embedding: number[] }[],
  options?: { limit?: number; minSimilarity?: number }
): { id: string; similarity: number }[] {
  const limit = options?.limit ?? HYBRID_SEMANTIC_NEIGHBOR_LIMIT
  const minSimilarity = options?.minSimilarity ?? HYBRID_MIN_COSINE_SIMILARITY
  return candidates
    .map(candidate => ({
      id: candidate.id,
      similarity: cosineSimilarity(queryVector, candidate.embedding)
    }))
    .filter(entry => entry.similarity >= minSimilarity)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, Math.max(0, limit))
}

/** 语义-only 命中的词面分：四舍五入后的余弦 × 系数。 */
export function scoreFromCosineSimilarity(
  similarity: number,
  scale = HYBRID_SEMANTIC_SCORE_SCALE
): number {
  return Math.round(similarity * scale)
}
