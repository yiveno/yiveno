/**
 * 画像 LLM 叙事输出审核（纯函数）。
 * 任一校验不过 → ok=false + reasons；通过才可展示并缓存。
 */

import type { PortraitNarrativeContentPoints } from '@/core/portrait/portrait-narrative-prompt'
import type { UiLocaleId } from '@/core/i18n/ui-locale'

export type PortraitNarrativeValidateResult = {
  ok: boolean
  reasons: string[]
}

const ZH_UNCERTAIN = /可能|也许|猜|还不确定|拿不准/
const EN_UNCERTAIN = /\bmight\b|\bmaybe\b|\bguessing\b|\bnot sure\b/i
const ZH_CONFLICT = /对不上|矛盾|不一致/
const EN_CONFLICT = /don'?t line up|conflicting/i
const ZH_ASSERT = /喜欢|偏好|热衷/
const EN_ASSERT = /you(?:'re| are) into|you like|you love/i

const INTERNAL_TERMS =
  /可信度|credibility|画像事实|分组|inPortrait|pendingInference|portrait\s*fact/i

const MARKDOWN_MARK = /[#*`]/m
const DOMAIN_LIKE = /\b[a-z0-9][a-z0-9-]*\.[a-z]{2,}\b/gi
const CJK_CHAR = /[\u3400-\u9fff]/
/** 中文数字 + 项/个/条（含十二、二十一等组合） */
const CN_COUNT = /([一二三四五六七八九十两]{1,3})\s*([项个条])/g

const CN_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
}

/** 解析常见中文数量词（1–99）。失败返回 null。 */
export function parseChineseCountToken(token: string): number | null {
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed === '十') {
    return 10
  }
  if (trimmed.length === 1) {
    return CN_DIGIT[trimmed] ?? null
  }
  if (trimmed.startsWith('十')) {
    const ones = CN_DIGIT[trimmed.slice(1)]
    return ones == null ? null : 10 + ones
  }
  if (trimmed.endsWith('十')) {
    const tens = CN_DIGIT[trimmed.slice(0, -1)]
    return tens == null ? null : tens * 10
  }
  const tenIndex = trimmed.indexOf('十')
  if (tenIndex > 0) {
    const tens = CN_DIGIT[trimmed.slice(0, tenIndex)]
    const onesPart = trimmed.slice(tenIndex + 1)
    const ones = onesPart ? CN_DIGIT[onesPart] : 0
    if (tens == null || ones == null) {
      return null
    }
    return tens * 10 + ones
  }
  return null
}

/** zh 字数 / en 词数上限。 */
export function portraitNarrativeLengthLimit(locale: UiLocaleId): number {
  return locale === 'zh_CN' ? 150 : 90
}

/** 计量长度（zh=字符数；en=词数）。 */
export function measurePortraitNarrativeLength(text: string, locale: UiLocaleId): number {
  const trimmed = text.trim()
  if (locale === 'zh_CN') {
    return trimmed.length
  }
  if (!trimmed) {
    return 0
  }
  return trimmed.split(/\s+/).filter(Boolean).length
}

function collectAllValues(points: PortraitNarrativeContentPoints): Set<string> {
  const set = new Set<string>()
  for (const g of points.groups) {
    for (const v of g.values) {
      set.add(v)
    }
  }
  for (const v of points.pendingValues) {
    set.add(v)
  }
  for (const v of points.contestedValues) {
    set.add(v)
  }
  return set
}

function collectAllowedCounts(points: PortraitNarrativeContentPoints): Set<number> {
  const set = new Set<number>()
  for (const g of points.groups) {
    set.add(g.total)
    if (g.values.length < g.total) {
      set.add(g.total - g.values.length)
    }
    // 确定性提炼「另外 N 项」可能相对前 3 代表
    if (g.total > 3) {
      set.add(g.total - 3)
    }
  }
  set.add(points.pendingTotal)
  set.add(points.contestedTotal)
  set.delete(0)
  return set
}

function splitSentences(text: string): string[] {
  // 中文标点直接切；英文 .!? 仅在后接空白时切，避免拆开 github.com
  return text
    .split(/(?<=[。！？])|(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function valueAppears(sentence: string, value: string): boolean {
  const needle = value.trim()
  if (!needle) {
    return false
  }
  // 拉丁 token / 域名：要求边界，避免单字母 a 误命中
  if (/^[a-z0-9][a-z0-9._-]*$/i.test(needle)) {
    return new RegExp(`(^|[^a-z0-9_-])${escapeRegExp(needle)}([^a-z0-9_-]|$)`, 'i').test(sentence)
  }
  return sentence.toLowerCase().includes(needle.toLowerCase())
}

/**
 * 审核 LLM 画像叙事。
 */
export function validatePortraitNarrative(
  text: string,
  points: PortraitNarrativeContentPoints,
  locale: UiLocaleId
): PortraitNarrativeValidateResult {
  const reasons: string[] = []
  const trimmed = text.trim()

  if (!trimmed) {
    reasons.push('empty')
    return { ok: false, reasons }
  }

  // 形式：无换行分段
  if (/\n/.test(trimmed)) {
    reasons.push('multiline')
  }

  // markdown
  if (MARKDOWN_MARK.test(trimmed) || /^\s*[-•]\s/m.test(trimmed)) {
    reasons.push('markdown')
  }

  // 内部术语
  if (INTERNAL_TERMS.test(trimmed)) {
    reasons.push('internal_terms')
  }

  // 语言粗检：locale 与回复语言须一致
  const replyHasCjk = CJK_CHAR.test(trimmed)
  if (locale === 'zh_CN' && !replyHasCjk) {
    reasons.push('language_mismatch')
  }
  if (locale === 'en' && replyHasCjk) {
    reasons.push('language_mismatch')
  }

  // 长度
  const limit = portraitNarrativeLengthLimit(locale)
  if (measurePortraitNarrativeLength(trimmed, locale) > limit) {
    reasons.push('too_long')
  }

  const allValues = collectAllValues(points)

  // 事实接地：引号内短语
  const quoted = trimmed.matchAll(/[「『""]([^」』""]+)[」』""]/g)
  for (const m of quoted) {
    const phrase = m[1]?.trim()
    if (phrase && !allValues.has(phrase)) {
      reasons.push(`invented_quote:${phrase}`)
    }
  }

  // 事实接地：域名形态 token
  const domains = trimmed.match(DOMAIN_LIKE) ?? []
  for (const token of domains) {
    const hit = [...allValues].some(v => v.toLowerCase() === token.toLowerCase())
    if (!hit) {
      reasons.push(`invented_domain:${token}`)
    }
  }

  // 文本中出现的内容点 value 必须属于全集（子集出现 OK；此处查「像 value 的串」靠上面域名/引号）
  // 额外：若某 value 出现在全文，它必须在全集（全集外不可能「出现」——改为检查疑似编造已覆盖）

  const sentences = splitSentences(trimmed)
  const uncertainRe = locale === 'zh_CN' ? ZH_UNCERTAIN : EN_UNCERTAIN
  const conflictRe = locale === 'zh_CN' ? ZH_CONFLICT : EN_CONFLICT
  const assertRe = locale === 'zh_CN' ? ZH_ASSERT : EN_ASSERT

  if (points.pendingTotal > 0) {
    for (const pending of points.pendingValues) {
      for (const sentence of sentences) {
        if (!valueAppears(sentence, pending)) {
          continue
        }
        if (!uncertainRe.test(sentence)) {
          reasons.push(`pending_missing_hedge:${pending}`)
        }
        // 「你喜欢 <pending>」式确定断言
        if (locale === 'zh_CN') {
          if (
            new RegExp(`(?:你)?(?:${assertRe.source}).{0,12}${escapeRegExp(pending)}`).test(
              sentence
            )
          ) {
            reasons.push(`pending_asserted:${pending}`)
          }
        } else if (
          new RegExp(`${assertRe.source}\\s+${escapeRegExp(pending)}`, 'i').test(sentence)
        ) {
          reasons.push(`pending_asserted:${pending}`)
        }
      }
    }
  }

  if (points.contestedTotal > 0) {
    for (const contested of points.contestedValues) {
      for (const sentence of sentences) {
        if (!valueAppears(sentence, contested)) {
          continue
        }
        if (!conflictRe.test(sentence)) {
          reasons.push(`contested_missing_marker:${contested}`)
        }
      }
    }
  }

  // 计数：阿拉伯数字须与 points 某计数相等
  const allowed = collectAllowedCounts(points)
  const nums = trimmed.match(/\d+/g) ?? []
  for (const raw of nums) {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      continue
    }
    if (!allowed.has(n)) {
      reasons.push(`bad_count:${n}`)
    }
  }

  // 中文数字计数：一二…十（含十二）+ 项/个/条
  for (const match of trimmed.matchAll(CN_COUNT)) {
    const token = match[1]
    if (!token) {
      continue
    }
    const n = parseChineseCountToken(token)
    if (n == null) {
      continue
    }
    if (!allowed.has(n)) {
      reasons.push(`bad_count_cn:${n}`)
    }
  }

  // 去重 reasons
  const unique = [...new Set(reasons)]
  return { ok: unique.length === 0, reasons: unique }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
