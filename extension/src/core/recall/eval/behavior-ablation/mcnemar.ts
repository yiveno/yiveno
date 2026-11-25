/**
 * McNemar（配对二分类）：R@1 ON vs OFF。
 * b = OFF miss / ON hit；c = OFF hit / ON miss。
 */

export interface McNemarResult {
  /** OFF=0 ON=1 */
  b: number
  /** OFF=1 ON=0 */
  c: number
  /** 连续性校正 χ² = (|b-c|-1)² / (b+c)；b+c=0 → 0 */
  chi2: number
  /** 粗近似 p（χ²₁）；仅报告用，不作门槛） */
  pApprox: number
}

/** 标准正态尾概率的粗近似（Abramowitz & Stegun 26.2.17 风格）。 */
function chiSquare1PValue(chi2: number): number {
  if (chi2 <= 0) return 1
  // P(χ²₁ > x) = 2 * (1 - Φ(√x))
  const z = Math.sqrt(chi2)
  // 1-Φ(z) ≈ φ(z) * (a1*t + a2*t² + a3*t³) 的互补
  const t = 1 / (1 + 0.33267 * z)
  const poly = 0.4361836 * t - 0.1201676 * t * t + 0.937298 * t * t * t
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const oneMinusPhi = pdf * poly
  return Math.min(1, Math.max(0, 2 * oneMinusPhi))
}

export function mcnemarFromPairedHits(pairs: readonly { a: 0 | 1; b: 0 | 1 }[]): McNemarResult {
  let b = 0
  let c = 0
  for (const pair of pairs) {
    if (pair.a === 0 && pair.b === 1) b += 1
    if (pair.a === 1 && pair.b === 0) c += 1
  }
  const denom = b + c
  const chi2 = denom === 0 ? 0 : (Math.abs(b - c) - 1) ** 2 / denom
  return {
    b,
    c,
    chi2,
    pApprox: chiSquare1PValue(chi2)
  }
}
