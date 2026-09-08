/**
 * 探针 filler（diversity / noise）过程随机：可复现 PRNG。
 * 仅 DEV 语料生成；禁止进召回 runtime。
 */

/** 默认 filler 种子（配方未指定时）；保证同配方默认可复现。 */
export const DEFAULT_PROBE_FILLER_SEED = 20260906

/** mulberry32：返回 [0, 1)。 */
export function createMulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** 把若干片段混进 32-bit 种子。 */
export function mixSeed(seed: number, ...parts: Array<string | number>): number {
  let h = seed >>> 0
  for (const part of parts) {
    const text = String(part)
    for (let i = 0; i < text.length; i += 1) {
      h = Math.imul(h ^ text.charCodeAt(i), 0x9e3779b1)
      h = (h << 13) | (h >>> 19)
    }
  }
  return h >>> 0
}

export type SeededRng = {
  /** [0, 1) */
  next: () => number
  /** [0, maxExclusive) 整数 */
  nextInt: (maxExclusive: number) => number
  pick: <T>(list: readonly T[]) => T
}

export function createSeededRng(seed: number): SeededRng {
  const next = createMulberry32(seed)
  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) {
        return 0
      }
      return Math.floor(next() * maxExclusive)
    },
    pick<T>(list: readonly T[]): T {
      return list[Math.floor(next() * list.length)]!
    }
  }
}

/** 为单条 filler 派生独立流（同 seed+坐标 → 同内容）。 */
export function rngForFillerItem(
  seed: number,
  kind: string,
  index: number,
  persona?: string
): SeededRng {
  return createSeededRng(mixSeed(seed, kind, index, persona ?? ''))
}
