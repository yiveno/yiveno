/**
 * Capture enrichment 的 LLM 结构化提议（写库前必须经 Zod 校验）。
 * 模型只产出字段提议；落库由 merge + 确定性代码完成（产品文档 §0.1.1）。
 */

import { z } from 'zod'

import { RecallObjectTypeSchema } from '@/core/recall/parse-recall-clue-types'

/** 列表：去空、去重（大小写不敏感保序）、硬上限。 */
function cappedTokenList(max: number) {
  // Zod 4 + exactOptionalPropertyTypes：先 transform 再 optional，键才保持可缺省
  return z
    .array(z.string())
    .max(max * 2)
    .transform(list => {
      const seen = new Set<string>()
      const out: string[] = []
      for (const raw of list) {
        const token = raw.trim().slice(0, 64)
        if (!token) {
          continue
        }
        const key = token.toLowerCase()
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        out.push(token)
        if (out.length >= max) {
          break
        }
      }
      return out.length > 0 ? out : undefined
    })
    .optional()
}

/**
 * LLM enrichment 提议 schema。
 * - tags / keywords / entities：English canonical 优先（与规则 enrichment 对齐）
 * - summary：短摘要，供解释/追问；不作唯一真相
 * - objectType：对象类型 slug；merge 时写入 tags
 * - 禁止：note、embedding、任意写库指令
 */
export const MemoryEnrichmentProposalSchema = z
  .object({
    tags: cappedTokenList(8),
    keywords: cappedTokenList(24),
    entities: cappedTokenList(12),
    summary: z
      .string()
      .trim()
      .max(280)
      .transform(value => {
        const trimmed = value.trim().slice(0, 280)
        return trimmed.length > 0 ? trimmed : undefined
      })
      .optional(),
    objectType: RecallObjectTypeSchema.optional()
  })
  .strict()

export type MemoryEnrichmentProposal = z.infer<typeof MemoryEnrichmentProposalSchema>

/** 从模型原文解析提议（允许 ```json 围栏）；失败返回 null。 */
export function parseMemoryEnrichmentProposal(raw: unknown): MemoryEnrichmentProposal | null {
  const candidate = coerceProposalJson(raw)
  if (candidate === null) {
    return null
  }
  const parsed = MemoryEnrichmentProposalSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function coerceProposalJson(raw: unknown): unknown {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw
  }
  if (typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  try {
    return JSON.parse(body) as unknown
  } catch {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start < 0 || end <= start) {
      return null
    }
    try {
      return JSON.parse(body.slice(start, end + 1)) as unknown
    } catch {
      return null
    }
  }
}

/** 供 Worker / 客户端拼 prompt：只描述可写字段。 */
export const MEMORY_ENRICHMENT_PROPOSAL_JSON_SHAPE = `{
  "objectType": "video|article|song|poem|code|command|page|password|quote",
  "tags": ["english-slug", "..."],
  "keywords": ["english recall keyword", "..."],
  "entities": ["English Canonical Name", "..."],
  "summary": "one short sentence for recall, not a review"
}` as const
