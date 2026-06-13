/**
 * 语义检索置信度判定（Core 层纯函数）
 *
 * Embedding 对任意输入都会返回最近邻；需结合绝对分与候选池分布，
 * 区分「合理关联」（听歌→音乐）与「密集误召回」（乱码/单字噪声）。
 */

/** Embedding 向量召回宽阈值（与 e5-small 实测分布对齐，非展示门槛） */
export const SEMANTIC_VECTOR_RECALL_MIN_SCORE = 0.68

/** 语义补位/直达展示的最低绝对分（e5-small 合理关联通常 ≥ 0.74） */
export const SEMANTIC_CONFIDENCE_MIN_SCORE = 0.74

/** 无文本命中时语义直达最低分（与补位同级，靠分布检验过滤噪声） */
export const SEMANTIC_DIRECT_MIN_SCORE = SEMANTIC_CONFIDENCE_MIN_SCORE

/** 语义补位：Top1 相对 Top2 的最小领先幅度（大库） */
export const SEMANTIC_SUPPLEMENT_MIN_GAP = 0.08

/** 无文本命中时 Top1 相对 Top2 的最小领先幅度（大库） */
export const SEMANTIC_DIRECT_MIN_GAP = 0.08

/** 语义补位：与最高分的分差上限（同簇内多条） */
export const SEMANTIC_SUPPLEMENT_SCORE_BAND = 0.05

/**
 * Top1 相对候选池均值的最小领先幅度（≥3 条时启用）
 *
 * 合理查询（听歌）Top 明显高于均值；乱码/蹭热密集簇 Top≈均值。
 */
export const SEMANTIC_MARGIN_OVER_MEAN = 0.06

export interface ScoredCandidate {
  score: number
}

/**
 * 按候选数量缩放 Top1/Top2 领先幅度要求（小库分数天然挤在一起）
 */
export function resolveSemanticMinGap(candidateCount: number, baseGap: number): number {
  if (candidateCount <= 20) {
    return Math.min(baseGap, 0.03)
  }
  if (candidateCount <= 50) {
    return Math.min(baseGap, 0.05)
  }
  return baseGap
}

function computeScoreMean(scores: readonly number[]): number {
  if (scores.length === 0) {
    return 0
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/**
 * Top1 是否相对整个候选池突出（而非全员高分密集簇）
 */
export function passesSemanticDistributionGate<T extends ScoredCandidate>(
  candidates: readonly T[]
): boolean {
  if (candidates.length < 3) {
    return true
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  if (!top) {
    return false
  }

  const scores = sorted.map(candidate => candidate.score)
  const mean = computeScoreMean(scores)
  return top.score - mean >= SEMANTIC_MARGIN_OVER_MEAN
}

/**
 * 语义候选是否具备展示置信度（绝对分 + 分布 + 领先幅度）
 *
 * 若仅 Top1 达到 minScore，视为唯一合理关联；若 Top2 也达标则要求明显领先。
 */
export function passesSemanticConfidenceGate<T extends ScoredCandidate>(
  candidates: readonly T[],
  minScore: number,
  minGap: number
): boolean {
  if (candidates.length === 0) {
    return false
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  if (!top || top.score < minScore) {
    return false
  }

  // ≥3 条：用候选池分布区分合理关联与密集误召回（听歌→音乐 vs 乱码→全员高分）
  if (sorted.length >= 3) {
    return passesSemanticDistributionGate(sorted)
  }

  const second = sorted[1]
  if (!second || second.score < minScore) {
    return true
  }

  return top.score - second.score >= resolveSemanticMinGap(sorted.length, minGap)
}

/**
 * 在置信簇内选取 Top 结果（分数 ≥ max(minScore, topScore - band)）
 */
export function pickTopScoredWithinBand<T extends ScoredCandidate>(
  candidates: readonly T[],
  minScore: number,
  band: number,
  maxCount: number
): T[] {
  if (candidates.length === 0 || maxCount <= 0) {
    return []
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const topScore = sorted[0]?.score ?? 0
  const threshold = Math.max(minScore, topScore - band)
  const picked: T[] = []

  for (const candidate of sorted) {
    if (candidate.score < threshold) {
      break
    }
    picked.push(candidate)
    if (picked.length >= maxCount) {
      break
    }
  }

  return picked
}
