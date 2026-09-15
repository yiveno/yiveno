/**
 * Hybrid eval 用的 deterministic fake embedding。
 *
 * 设计目标：
 * - CI 无外网：与生产 bge-m3 / 不同；只用做**触发点**和**夹具校准**，不追求语义正确性。
 * - 维度稳定：本仓库只用一处固定 dim。
 * - 文本 → 向量确定性：相同文本始终产出相同向量（CI 与本机一致）。
 * - 余弦曲线可控：`makeClueAlignedVector(targetText, dim)` 让目标 item 与 clue 同向；
 *   `makeOrthogonalVector(dim)` 让无关 item 与 clue 准正交，过不到阈值。
 *
 * 不依赖 Chrome / IndexedDB / Node；纯函数（字符串 hash + 数组运算）。
 */

import { stringHashU32 } from '@/core/recall/eval/string-hash-u32'

/** CI fake 向量维度（仅本地占位；非真实模型维度）。 */
export const HYBRID_FAKE_EMBEDDING_DIM = 64

/**
 * 把任意 text 映射为长度 dim 的归一化向量（确定性）。
 * 纯浏览器兼容：不依赖 Node 内置（crypto/Buffer），用字符串 hash 派生。
 */
export function makeFakeEmbedding(text: string, dim = HYBRID_FAKE_EMBEDDING_DIM): number[] {
  const vector = new Array<number>(dim).fill(0)
  if (dim <= 0) {
    return vector
  }
  // 串式 hash（mulberry32 变体）展开成伪随机字节序列；同输入必同输出
  let seed = stringHashU32(`${text}::seed`)
  for (let i = 0; i < dim; i += 1) {
    // mulberry32 单步：拿 32-bit 伪随机数
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const normalized = ((t ^ (t >>> 14)) >>> 0) / 0xffffffff // [0, 1]
    vector[i] = normalized * 2 - 1 // [-1, 1]
  }
  return l2Normalize(vector)
}

/**
 * 构造一个与给定 clue 准正交的向量（与任何文本夹角都接近 90°）。
 * 用法：corpus 「噪音 / 弱干扰」item 注入；过不了 `HYBRID_MIN_COSINE_SIMILARITY` 阈值，
 * 验证 R0 / 抑制语义命中。
 *
 * 通过把 fake 向量的低位反转得到另一组正交化向量。
 */
export function makeOrthogonalVector(
  anchorText: string,
  dim = HYBRID_FAKE_EMBEDDING_DIM
): number[] {
  const base = makeFakeEmbedding(anchorText, dim)
  const swapped = base.map((value, index) => (index % 2 === 0 ? -value : value))
  return l2Normalize(swapped)
}

/**
 * 跨库正交：corpus 内多 item 注入互不相似（避免假的「全连相近」）。
 */
export function makeOrthogonalVectorForPair(
  text: string,
  partnerTexts: readonly string[],
  dim = HYBRID_FAKE_EMBEDDING_DIM
): number[] {
  let best: { vector: number[]; score: number } | null = null
  for (let salt = 0; salt < partnerTexts.length + 1; salt += 1) {
    const candidate = makeFakeEmbedding(`${text}::salt-${salt}`, dim)
    let aggregate = 0
    for (const partner of partnerTexts) {
      aggregate += Math.abs(cosine(candidate, makeFakeEmbedding(partner, dim)))
    }
    if (!best || aggregate < best.score) {
      best = { vector: candidate, score: aggregate }
    }
  }
  return best ? best.vector : makeFakeEmbedding(text, dim)
}

function l2Normalize(vector: readonly number[]): number[] {
  let sumSquares = 0
  for (const value of vector) {
    sumSquares += value * value
  }
  const norm = Math.sqrt(sumSquares)
  if (norm === 0) {
    return [...vector]
  }
  return vector.map(value => value / norm)
}

function cosine(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0
  }
  let dot = 0
  let ln = 0
  let rn = 0
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i] ?? 0
    const b = right[i] ?? 0
    dot += a * b
    ln += a * a
    rn += b * b
  }
  if (ln === 0 || rn === 0) {
    return 0
  }
  return dot / (Math.sqrt(ln) * Math.sqrt(rn))
}
