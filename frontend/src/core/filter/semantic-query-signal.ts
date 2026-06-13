/**
 * 语义检索查询信号强度（Core 层纯函数）
 *
 * 过短查询的 embedding 向量近似随机最近邻，不宜触发语义补位。
 */

/** 语义补位所需的最小查询 grapheme 数（单字如「乐」信号过弱） */
export const SEMANTIC_SUPPLEMENT_MIN_QUERY_GRAPHEMES = 2

/**
 * 统计查询 grapheme 数（支持中文等多字节字符）
 */
export function countQueryGraphemes(query: string): number {
  const trimmed = query.trim()
  if (!trimmed) {
    return 0
  }
  return [...trimmed].length
}

/**
 * 查询是否具备足够语义信号以启用语义补位
 */
export function hasAdequateSemanticQueryLength(query: string): boolean {
  return countQueryGraphemes(query) >= SEMANTIC_SUPPLEMENT_MIN_QUERY_GRAPHEMES
}
