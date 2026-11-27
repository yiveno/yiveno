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

/**
 * sourceQuote 须为该 source 的 text / title / note 任一字段的逐字子串。
 * 空串一律不通过（`String.includes('')` 恒为 true，不能靠 includes  alone）。
 */
export function isVerbatimSourceQuote(
  sourceQuote: string,
  source: Pick<DreamingCompileSource, 'text' | 'title' | 'note'>
): boolean {
  const quote = sourceQuote.trim()
  if (!quote) {
    return false
  }
  if (source.text.includes(quote)) {
    return true
  }
  if (source.title != null && source.title.includes(quote)) {
    return true
  }
  if (source.note != null && source.note.includes(quote)) {
    return true
  }
  return false
}

/** 每个请求 source 在过滤后的行状态（全覆盖）。 */
export type DreamingCompileSourceStatus = 'ok' | 'empty' | 'dropped' | 'omitted'

export type DreamingCompileFilteredRow = {
  sourceId: string
  status: DreamingCompileSourceStatus
  propositions: DreamingCompileLlmPayload['results'][number]['propositions']
}

export type DreamingCompileFilterResult = {
  /** 对每个请求 source 恰好一行（未知 LLM sourceId 已排除） */
  results: DreamingCompileFilteredRow[]
  /** 因空引用或非逐字引用丢弃的命题条数（总数语义不变） */
  droppedQuoteCount: number
}

/**
 * 按请求 source 全覆盖输出 + 逐字 sourceQuote 过滤。
 * - ok：过滤后 propositions ≥ 1
 * - empty：LLM 对该 source 返回了行且原始 propositions 为 0
 * - dropped：LLM 返回 ≥ 1 条但全部因空引用/非逐字被过滤
 * - omitted：LLM 未返回该 source 的行
 */
export function filterDreamingCompileResults(
  parsed: DreamingCompileLlmPayload,
  sources: readonly DreamingCompileSource[],
  allowedIds: ReadonlySet<string>
): DreamingCompileFilterResult {
  const llmBySourceId = new Map<string, DreamingCompileLlmPayload['results'][number]>()
  for (const row of parsed.results) {
    if (!allowedIds.has(row.sourceId)) {
      continue
    }
    if (!llmBySourceId.has(row.sourceId)) {
      llmBySourceId.set(row.sourceId, row)
    }
  }

  let droppedQuoteCount = 0
  const results: DreamingCompileFilteredRow[] = sources.map(source => {
    const row = llmBySourceId.get(source.id)
    if (row == null) {
      return { sourceId: source.id, status: 'omitted', propositions: [] }
    }

    const propositions = row.propositions.filter(prop => {
      if (!isVerbatimSourceQuote(prop.sourceQuote, source)) {
        droppedQuoteCount += 1
        return false
      }
      return true
    })

    if (row.propositions.length === 0) {
      return { sourceId: source.id, status: 'empty', propositions: [] }
    }
    if (propositions.length === 0) {
      return { sourceId: source.id, status: 'dropped', propositions: [] }
    }
    return { sourceId: source.id, status: 'ok', propositions }
  })

  return { results, droppedQuoteCount }
}
