/**
 * Dreaming 批量命题编译：请求/响应 Zod + prompt + 解析。
 */

import { z } from 'zod'

export const DREAMING_BATCH_MAX_SOURCES = 8
export const DREAMING_MAX_PROPOSITIONS_PER_SOURCE = 3

export const DreamingCompileSourceSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['bookmark', 'text_excerpt']),
  title: z.string().max(500).optional(),
  text: z.string().min(1).max(4000),
  note: z.string().max(2000).optional()
})

export const DreamingCompileRequestSchema = z.object({
  sources: z.array(DreamingCompileSourceSchema).min(1).max(DREAMING_BATCH_MAX_SOURCES)
})

export type DreamingCompileSource = z.infer<typeof DreamingCompileSourceSchema>

const PropositionSchema = z.object({
  text: z.string().min(1).max(400),
  sourceQuote: z.string().min(1).max(500),
  topicAnchor: z.array(z.string().min(1).max(40)).max(8).optional()
})

const SourceResultSchema = z.object({
  sourceId: z.string().uuid(),
  propositions: z.array(PropositionSchema).max(DREAMING_MAX_PROPOSITIONS_PER_SOURCE)
})

export const DreamingCompileLlmPayloadSchema = z.object({
  results: z.array(SourceResultSchema)
})

export type DreamingCompileLlmPayload = z.infer<typeof DreamingCompileLlmPayloadSchema>

export function buildDreamingCompileSystemPrompt(): string {
  return [
    'You compile saved user excerpts/bookmarks into atomic propositions for offline recall.',
    'Return ONLY valid JSON: {"results":[{"sourceId":"<uuid>","propositions":[{"text":"...","sourceQuote":"...","topicAnchor":["..."]}]}]}',
    `Each source: 1–${DREAMING_MAX_PROPOSITIONS_PER_SOURCE} propositions.`,
    'Each proposition MUST include sourceQuote copied from the source text (verbatim substring).',
    'No citation → omit that proposition. Do not invent facts. Language of text may follow the source.',
    'topicAnchor: short topic words from the proposition (optional).'
  ].join(' ')
}

export function buildDreamingCompileUserPrompt(sources: readonly DreamingCompileSource[]): string {
  const blocks = sources.map((source, index) => {
    const lines = [
      `### source ${index + 1}`,
      `sourceId: ${source.id}`,
      `type: ${source.type}`,
      source.title ? `title: ${source.title}` : null,
      source.note ? `note: ${source.note}` : null,
      `text: ${source.text}`
    ].filter((line): line is string => line != null)
    return lines.join('\n')
  })
  return `Compile propositions for these sources:\n\n${blocks.join('\n\n')}`
}

/** 从模型原文解析 JSON；失败返回 null。 */
export function parseDreamingCompileText(raw: string): DreamingCompileLlmPayload | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  try {
    const json = JSON.parse(candidate) as unknown
    const parsed = DreamingCompileLlmPayloadSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
