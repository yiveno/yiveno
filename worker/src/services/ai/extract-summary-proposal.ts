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
    'Return ONLY valid JSON: {"summary":"..."} — no prose before or after the JSON.',
    'Write the summary in the same language as the page text.',
    'summary must be 120–450 characters, one plain paragraph.',
    'Do not use markdown characters (#, *, or backticks).',
    'Do not use bullets, headings, or quotes around the whole summary.',
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
/** 句末标点（截断优先落点） */
const SENTENCE_END = /[.!?。！？]/g

function cjkRatio(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }
  const cjkCount = (trimmed.match(/[\u3400-\u9fff]/g) ?? []).length
  return cjkCount / trimmed.length
}

/** 去掉首尾代码围栏（``` / ```json）。 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fenced?.[1]?.trim() ?? trimmed
}

/** JSON 候选：完整 trimmed + 第一个 { 到最后一个 }。 */
function collectJsonCandidates(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) {
    return []
  }
  const candidates: string[] = [trimmed]
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const slice = trimmed.slice(first, last + 1)
    if (slice !== trimmed) {
      candidates.push(slice)
    }
  }
  return candidates
}

/**
 * 有限 summary 字段回收：定位 "summary":"…" 字符串值，处理常见转义。
 * 回收不到则返回 null；不凭空生成摘要。
 */
function salvageSummaryFromDamagedJson(text: string): string | null {
  const marker = /"summary"\s*:\s*"/
  const match = marker.exec(text)
  if (!match || match.index === undefined) {
    return null
  }
  let i = match.index + match[0].length
  let result = ''
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '\\' && i + 1 < text.length) {
      const next = text[i + 1]!
      if (next === 'n') {
        result += '\n'
        i += 2
        continue
      }
      if (next === 'r') {
        result += '\r'
        i += 2
        continue
      }
      if (next === 't') {
        result += '\t'
        i += 2
        continue
      }
      if (next === '"' || next === '\\' || next === '/') {
        result += next
        i += 2
        continue
      }
      if (next === 'u' && i + 5 < text.length) {
        const hex = text.slice(i + 2, i + 6)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(Number.parseInt(hex, 16))
          i += 6
          continue
        }
      }
      result += next
      i += 2
      continue
    }
    if (ch === '"') {
      break
    }
    result += ch
    i += 1
  }
  return result.length > 0 ? result : null
}

/**
 * 归一化 summary：trim；去行首 heading/bullet；去 # * ` 字符保留文字；换行折为空格成单段。
 */
export function normalizeExtractSummary(summary: string): string {
  let s = summary.trim()
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  s = s.replace(/^\s*[-*•]\s+/gm, '')
  s = s.replace(/[#*`]/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * 超长截断到 ≤600：优先落在 600 内最后一个句末标点；否则硬截 600。
 * 截断后仍须 ≥80，否则 null。
 */
export function truncateExtractSummary(summary: string): string | null {
  if (summary.length < EXTRACT_SUMMARY_MIN_CHARS) {
    return null
  }
  if (summary.length <= EXTRACT_SUMMARY_MAX_CHARS) {
    return summary
  }
  const window = summary.slice(0, EXTRACT_SUMMARY_MAX_CHARS)
  let lastEnd = -1
  SENTENCE_END.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SENTENCE_END.exec(window)) !== null) {
    lastEnd = m.index + 1
  }
  if (lastEnd > 0) {
    const cut = window.slice(0, lastEnd).trim()
    if (cut.length >= EXTRACT_SUMMARY_MIN_CHARS) {
      return cut
    }
  }
  const hard = window.trim()
  return hard.length >= EXTRACT_SUMMARY_MIN_CHARS ? hard : null
}

/** 语言粗检：CJK 占比高的正文要求摘要含 CJK；无 CJK 正文拒绝含 CJK 摘要。 */
function passesLanguageCheck(summary: string, sourceText: string): boolean {
  const ratio = cjkRatio(sourceText)
  const summaryHasCjk = CJK_CHAR.test(summary)
  if (ratio > 0.3 && !summaryHasCjk) {
    return false
  }
  if (!CJK_CHAR.test(sourceText) && summaryHasCjk) {
    return false
  }
  return true
}

/** 归一化 → 截断 → 语言粗检；失败返回 null。 */
function finalizeSummary(rawSummary: string, sourceText: string): ExtractLlmPayload | null {
  const normalized = normalizeExtractSummary(rawSummary)
  const truncated = truncateExtractSummary(normalized)
  if (!truncated) {
    return null
  }
  if (!passesLanguageCheck(truncated, sourceText)) {
    return null
  }
  return { summary: truncated }
}

/** 从模型原文解析摘要；失败返回 null（走 422，不扣费）。 */
export function parseExtractSummaryText(raw: string, sourceText: string): ExtractLlmPayload | null {
  const withoutFence = stripCodeFence(raw)
  const candidates = collectJsonCandidates(withoutFence)

  for (const candidate of candidates) {
    try {
      const json = JSON.parse(candidate) as unknown
      if (
        json &&
        typeof json === 'object' &&
        'summary' in json &&
        typeof (json as { summary: unknown }).summary === 'string'
      ) {
        const result = finalizeSummary((json as { summary: string }).summary, sourceText)
        if (result) {
          return result
        }
      }
    } catch {
      // 尝试下一候选或损坏回收
    }
  }

  // JSON.parse 失败：有限 summary 字段回收
  for (const candidate of [...candidates, withoutFence, raw.trim()]) {
    const salvaged = salvageSummaryFromDamagedJson(candidate)
    if (!salvaged) {
      continue
    }
    const result = finalizeSummary(salvaged, sourceText)
    if (result) {
      return result
    }
  }

  // 纯文本回退：同一套归一化与截断（疑似 JSON 残片则不回退）
  const plain = withoutFence.trim()
  if (plain && !plain.startsWith('{')) {
    return finalizeSummary(plain, sourceText)
  }

  return null
}
