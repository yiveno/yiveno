/**
 * 语义命题相似度分桶（遥测聚合用；不写原始浮点）。
 */

/** 把余弦相似度落到闭集桶标签。 */
export function bucketSemanticNoteScore(similarity: number): string {
  if (!Number.isFinite(similarity)) {
    return 'invalid'
  }
  if (similarity < 0.5) {
    return 'lt_0.50'
  }
  if (similarity < 0.55) {
    return '0.50_0.55'
  }
  if (similarity < 0.6) {
    return '0.55_0.60'
  }
  if (similarity < 0.65) {
    return '0.60_0.65'
  }
  if (similarity < 0.7) {
    return '0.65_0.70'
  }
  if (similarity < 0.75) {
    return '0.70_0.75'
  }
  if (similarity < 0.8) {
    return '0.75_0.80'
  }
  return 'ge_0.80'
}
