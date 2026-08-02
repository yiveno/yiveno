/**
 * Capture enrichment LLM 提议：与扩展侧 MemoryEnrichmentProposal 字段对齐。
 * 写库不在 Worker；仅校验模型 JSON 后返回给扩展 merge。
 */

import { z } from 'zod'

const OBJECT_TYPES = [
  'poem', // 诗
  'article', // 文章
  'song', // 歌曲
  'video', // 视频
  'code', // 代码
  'command', // 命令
  'page', // 页面
  'password', // 密码
  'quote' // 引文
] as const

function cappedTokenList(max: number) {
  return z
    .array(z.string())
    .max(max * 2)
    .optional()
    .transform(list => {
      if (!list) {
        return undefined
      }
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
}

/** Worker 侧提议 schema（与 frontend memory-enrichment-proposal 对齐）。 */
export const MemoryEnrichmentProposalSchema = z
  .object({
    tags: cappedTokenList(8),
    keywords: cappedTokenList(24),
    entities: cappedTokenList(12),
    summary: z
      .string()
      .trim()
      .max(280)
      .optional()
      .transform(value => {
        if (!value) {
          return undefined
        }
        const trimmed = value.trim().slice(0, 280)
        return trimmed.length > 0 ? trimmed : undefined
      }),
    objectType: z.enum(OBJECT_TYPES).optional()
  })
  .strict()

export type MemoryEnrichmentProposal = z.infer<typeof MemoryEnrichmentProposalSchema>

export const EnrichmentCompleteRequestSchema = z.object({
  title: z.string().max(500).optional(),
  text: z.string().max(4000).optional(),
  url: z.string().max(2000).optional(),
  domain: z.string().max(253).optional(),
  note: z.string().max(1000).optional(),
  ruleHints: z
    .object({
      tags: z.array(z.string()).max(16).optional(),
      keywords: z.array(z.string()).max(48).optional(),
      entities: z.array(z.string()).max(24).optional()
    })
    .optional()
})

export type EnrichmentCompleteRequest = z.infer<typeof EnrichmentCompleteRequestSchema>

const JSON_SHAPE = `{
  "objectType": "video|article|song|poem|code|command|page|password|quote",
  "tags": ["english-slug"],
  "keywords": ["english recall keyword"],
  "entities": ["English Canonical Name"],
  "summary": "one short sentence for recall, not a review"
}`

/** 系统提示：只允许结构化 JSON，服务库内可问。 */
export function buildEnrichmentSystemPrompt(): string {
  return [
    'You enrich a saved personal memory for later recall inside a private library.',
    'Return ONLY one JSON object. No markdown. No commentary.',
    'Use English canonical tokens for tags, keywords, entities, objectType.',
    'Do NOT invent URLs, ids, or write commands. Do NOT include note or embedding.',
    'Prefer recall hooks (topic, entity, type) over long reviews.',
    `JSON shape: ${JSON_SHAPE}`
  ].join(' ')
}

/** 用户提示：原始字段 + 规则层 hint。 */
export function buildEnrichmentUserPrompt(input: EnrichmentCompleteRequest): string {
  const lines: string[] = ['Memory fields:']
  if (input.title?.trim()) {
    lines.push(`title: ${input.title.trim()}`)
  }
  if (input.text?.trim()) {
    lines.push(`text: ${input.text.trim().slice(0, 2000)}`)
  }
  if (input.url?.trim()) {
    lines.push(`url: ${input.url.trim()}`)
  }
  if (input.domain?.trim()) {
    lines.push(`domain: ${input.domain.trim()}`)
  }
  if (input.note?.trim()) {
    lines.push(`user_note: ${input.note.trim()}`)
  }
  if (input.ruleHints) {
    lines.push(`rule_hints: ${JSON.stringify(input.ruleHints)}`)
  }
  lines.push('Propose additional recall fields as JSON.')
  return lines.join('\n')
}

/** 从模型原文解析提议。 */
export function parseEnrichmentProposalText(raw: string): MemoryEnrichmentProposal | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  const tryParse = (text: string): unknown => {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return null
    }
  }
  let candidate = tryParse(body)
  if (candidate === null) {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start >= 0 && end > start) {
      candidate = tryParse(body.slice(start, end + 1))
    }
  }
  if (candidate === null) {
    return null
  }
  const parsed = MemoryEnrichmentProposalSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
