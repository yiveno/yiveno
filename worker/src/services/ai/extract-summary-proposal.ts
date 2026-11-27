/**
 * 内容提炼：请求/响应 Zod + prompt + 解析。
 * 客户端绝不传 system 文本；摘要与正文同语言。
 */

import { z } from 'zod'

/** 单页正文上限（字符）；与扩展侧截断一致。 */
export const EXTRACT_TEXT_MAX_CHARS = 12_000

/** 摘要长度硬门（字符）；Zod 与纯文本回退同口径。 */
export const EXTRACT_SUMMARY_MIN_CHARS = 80
export const EXTRACT_SUMMARY_MAX_CHARS = 600

export const ExtractCompleteRequestSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  text: z.string().min(1).max(EXTRACT_TEXT_MAX_CHARS)
})

const ExtractLlmPayloadSchema = z.object({
  summary: z.string().min(EXTRACT_SUMMARY_MIN_CHARS).max(EXTRACT_SUMMARY_MAX_CHARS)
})

type ExtractLlmPayload = z.infer<typeof ExtractLlmPayloadSchema>

export function buildExtractSummarySystemPrompt(): string {
  return [
    'You summarize the main content of a saved web page for personal recall.',
    'Return ONLY valid JSON: {"summary":"..."}',
    'Write the summary in the same language as the page text.',
    'Aim for about 200–400 characters of plain prose.',
    'Do not add a title, bullet list, markdown headings, or quotes around the whole summary.',
    'Do not invent facts that are not in the text.'
  ].join(' ')
}

export function buildExtractSummaryUserPrompt(input: {
  url: string
  title?: string
  text: string
}): string {
  const lines = [
    `url: ${input.url}`,
    input.title ? `title: ${input.title}` : null,
    'text:',
    input.text
  ].filter((line): line is string => line != null)
  return `Summarize this saved page:\n\n${lines.join('\n')}`
}

const CJK_CHAR = /[\u3400-\u9fff]/
/** markdown 标记：# * 反引号，或行首 - */
const MARKDOWN_MARK = /[#*`]|^\s*-\s/m

function cjkRatio(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }
  const cjkCount = (trimmed.match(/[\u3400-\u9fff]/g) ?? []).length
  return cjkCount / trimmed.length
}

/**
 * 摘要机器校验：长度已由 Zod/回退保证；此处查 markdown 与语言粗检。
 */
export function isValidExtractSummary(summary: string, sourceText: string): boolean {
  const trimmed = summary.trim()
  if (trimmed.length < EXTRACT_SUMMARY_MIN_CHARS || trimmed.length > EXTRACT_SUMMARY_MAX_CHARS) {
    return false
  }
  if (MARKDOWN_MARK.test(trimmed)) {
    return false
  }
  const ratio = cjkRatio(sourceText)
  const summaryHasCjk = CJK_CHAR.test(trimmed)
  if (ratio > 0.3 && !summaryHasCjk) {
    return false
  }
  if (!CJK_CHAR.test(sourceText) && summaryHasCjk) {
    return false
  }
  return true
}

/** 从模型原文解析摘要；失败返回 null（走 422，不扣费）。 */
export function parseExtractSummaryText(raw: string, sourceText: string): ExtractLlmPayload | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  try {
    const json = JSON.parse(candidate) as unknown
    const parsed = ExtractLlmPayloadSchema.safeParse(json)
    if (!parsed.success) {
      return null
    }
    const summary = parsed.data.summary.trim()
    if (!isValidExtractSummary(summary, sourceText)) {
      return null
    }
    return { summary }
  } catch {
    // 容错：模型偶发直接回纯文本摘要（与 Zod 同口径 80–600）
    if (
      trimmed.length >= EXTRACT_SUMMARY_MIN_CHARS &&
      trimmed.length <= EXTRACT_SUMMARY_MAX_CHARS &&
      !trimmed.startsWith('{') &&
      isValidExtractSummary(trimmed, sourceText)
    ) {
      return { summary: trimmed }
    }
    return null
  }
}
