/**
 * 内容提炼：请求/响应 Zod + prompt + 解析。
 * 客户端绝不传 system 文本；摘要与正文同语言。
 */

import { z } from 'zod'

/** 单页正文上限（字符）；与扩展侧截断一致。 */
export const EXTRACT_TEXT_MAX_CHARS = 12_000

export const ExtractCompleteRequestSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  text: z.string().min(1).max(EXTRACT_TEXT_MAX_CHARS)
})

const ExtractLlmPayloadSchema = z.object({
  summary: z.string().min(1).max(2000)
})

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

/** 从模型原文解析摘要；失败返回 null（走 422，不扣费）。 */
export function parseExtractSummaryText(raw: string): ExtractLlmPayload | null {
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
    if (!summary) {
      return null
    }
    return { summary }
  } catch {
    // 容错：模型偶发直接回纯文本摘要
    if (trimmed.length >= 40 && trimmed.length <= 2000 && !trimmed.startsWith('{')) {
      return { summary: trimmed }
    }
    return null
  }
}
