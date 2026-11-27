/**
 * 确定性 PRNG（mulberry32）。同种子 → 同序列；无外部熵。
 */

/** 由 u32 种子构造 [0,1) 发生器。 */
export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [0, max) 整数。 */
export function nextInt(rng: () => number, max: number): number {
  if (max <= 0) {
    return 0
  }
  return Math.floor(rng() * max)
}

/** 闭区间 [min, max]。 */
export function nextIntInclusive(rng: () => number, min: number, max: number): number {
  if (max <= min) {
    return min
  }
  return min + nextInt(rng, max - min + 1)
}

/** Fisher–Yates 洗牌（就地；返回同一数组）。 */
export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = nextInt(rng, i + 1)
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

/**
 * 确定性 UUID（仍符合 UUID 形态，供 MemoryItemSchema）。
 * namespace 取 0–0xffff；index 取非负整数。
 */
export function deterministicUuid(namespace: number, index: number): string {
  const ns = (namespace >>> 0) & 0xffff
  const hi = (index >>> 16) & 0xffff
  const lo = index & 0xffff
  const a = (0xbe7a0000 | (ns & 0xffff)).toString(16).padStart(8, '0')
  const b = hi.toString(16).padStart(4, '0')
  const c = (0x4000 | (lo & 0x0fff)).toString(16).padStart(4, '0')
  const d = (0x8000 | ((index * 17) & 0x3fff)).toString(16).padStart(4, '0')
  const e = (BigInt(namespace) * 0x100000000n + BigInt(index & 0xffffffff))
    .toString(16)
    .padStart(12, '0')
    .slice(-12)
  return `${a.slice(0, 8)}-${b}-${c}-${d}-${e}`
}
