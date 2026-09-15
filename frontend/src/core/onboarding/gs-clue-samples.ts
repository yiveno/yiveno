/**
 * Getting Started 示意 clue（LLM 一次 4 条）领域 shape；无 Chrome / 无 IDB。
 */

import { z } from 'zod'

export const GsClueSampleSourceSchema = z.object({
  /** Chrome 书签 id（缓存键优先） */
  chromeId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  url: z.string().trim().max(2000).optional(),
  /** 可选描述 / summary / 附注短文 */
  description: z.string().trim().max(1000).optional()
})

export type GsClueSampleSource = z.infer<typeof GsClueSampleSourceSchema>

export const GsClueSamplesListSchema = z.object({
  clues: z.array(z.string().trim().min(1).max(280)).min(1).max(4)
})

export type GsClueSamplesList = z.infer<typeof GsClueSamplesListSchema>

/** 来源：LLM 或标题模板回退。 */
export type GsClueSamplesOrigin = 'llm' | 'template'

export function parseGsClueSamplesList(value: unknown): string[] | null {
  const parsed = GsClueSamplesListSchema.safeParse(value)
  return parsed.success ? parsed.data.clues : null
}

/**
 * 在多条 clue 中随机换一条（尽量避开当前下标）。
 */
export function pickNextRandomClueIndex(currentIndex: number, length: number): number {
  if (length <= 0) {
    return 0
  }
  if (length === 1) {
    return 0
  }
  const safeCurrent = ((currentIndex % length) + length) % length
  let next = Math.floor(Math.random() * length)
  if (next === safeCurrent) {
    next = (safeCurrent + 1) % length
  }
  return next
}

/**
 * 随机换下标；若文案与当前相同则顺序找下一条不同 clue（全相同则仍换下标）。
 */
export function pickNextDistinctClueIndex(
  currentIndex: number,
  clues: readonly string[],
  randomIndex: (current: number, length: number) => number = pickNextRandomClueIndex
): number {
  const length = clues.length
  if (length <= 1) {
    return 0
  }
  const start = ((currentIndex % length) + length) % length
  let next = randomIndex(start, length)
  if (clues[next] !== clues[start]) {
    return next
  }
  for (let offset = 1; offset < length; offset += 1) {
    const candidate = (start + offset) % length
    if (clues[candidate] !== clues[start]) {
      return candidate
    }
  }
  return next
}
