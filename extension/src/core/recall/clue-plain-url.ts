/**
 * Clue 纯文本中的 URL 检测 / 规范化 / 可见分面缩短。
 * 契约面：序列化与传输仍写完整 http(s)；可见面：芯片或 host/path 短标签。
 * 展示截断 / 对齐键见 `clue-url-display`。
 */

import { formatClueUrlDisplayLabel } from '@/core/recall/clue-url-display'

/** clue 文案片段：纯文本或已识别 URL。 */
export type CluePlainSegment =
  | { kind: 'text'; text: string } // 普通字面
  | { kind: 'url'; href: string; raw: string } // 规范化 http(s) + 原文匹配串

/** 匹配 http(s) 与裸 www.；不含无 scheme 裸域名（误伤 e.g. / file.ext）。 */
const CLUE_URL_FIND_RE = /https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi

/** URL 尾部常被句读粘上的标点（保留 path 内合法字符）。 */
const TRAILING_URL_PUNCT_RE = /[.,;:!?）】》」』'"`]+$/u

/**
 * URL 字面允许的 ASCII（RFC3986 常见子集）。
 * 粘在 URL 后的中文等不在此集合 → 剥掉并视为边界，避免 `url跟` 整段进芯片。
 */
const CLUE_URL_BODY_CHAR_RE = /[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/

/** 从 match 末尾剥掉非 URL body 字符（如粘上的「跟」）。 */
export function peelTrailingNonUrlBody(raw: string): string {
  let end = raw.length
  while (end > 0) {
    const ch = raw[end - 1]!
    if (CLUE_URL_BODY_CHAR_RE.test(ch)) {
      break
    }
    end -= 1
  }
  return raw.slice(0, end)
}

/** 下一字符是否结束 URL（空白 / 句读 / 非 URL body）。 */
export function isClueUrlBoundaryChar(ch: string): boolean {
  if (!ch) {
    return true
  }
  if (/\s/u.test(ch)) {
    return true
  }
  if (/[.,;:!?）】》」』"'`)\]}>]/u.test(ch)) {
    return true
  }
  return !CLUE_URL_BODY_CHAR_RE.test(ch)
}

/**
 * 剥尾部句读后尝试得到可导航 http(s) href；非法 scheme / 解析失败 → null。
 */
export function normalizeClueUrl(raw: string): string | null {
  let candidate = raw.trim()
  if (!candidate) {
    return null
  }
  candidate = candidate.replace(TRAILING_URL_PUNCT_RE, '')
  if (!candidate) {
    return null
  }
  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`
  }
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    if (!url.hostname) {
      return null
    }
    return url.href
  } catch {
    return null
  }
}

export type ParseCluePlainSegmentsOptions = {
  /**
   * 是否把文末尚未跟空白的完整 URL 也收成芯片。
   * 输入中（光标还在 URL 尾巴）默认 false；blur / 发送前 / 外部 set 用 true。
   */
  chipTrailing?: boolean
}

/**
 * 将 clue 纯文本切成 text / url 片段（url.href 已规范化）。
 */
export function parseCluePlainSegments(
  text: string,
  options: ParseCluePlainSegmentsOptions = {}
): CluePlainSegment[] {
  const chipTrailing = options.chipTrailing === true
  if (!text) {
    return []
  }

  const segments: CluePlainSegment[] = []
  let lastIndex = 0
  const re = new RegExp(CLUE_URL_FIND_RE.source, CLUE_URL_FIND_RE.flags)
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const rawMatch = match[0] ?? ''
    const start = match.index

    // 实际消费长度：去尾部句读 + 剥粘连非 URL 字符（中文等留后续 text）
    let consumed = rawMatch
    const punct = consumed.match(TRAILING_URL_PUNCT_RE)?.[0] ?? ''
    if (punct) {
      consumed = consumed.slice(0, consumed.length - punct.length)
    }
    consumed = peelTrailingNonUrlBody(consumed)
    const href = normalizeClueUrl(consumed)
    if (!href) {
      continue
    }
    const consumedEnd = start + consumed.length

    const atEnd = consumedEnd >= text.length
    if (atEnd) {
      // 文末完整 URL：仅 blur/发送/外部 set 时收芯片，避免输入中无法改字
      if (!chipTrailing) {
        continue
      }
    } else {
      const nextChar = text[consumedEnd] ?? ''
      if (!isClueUrlBoundaryChar(nextChar)) {
        continue
      }
    }

    if (start > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, start) })
    }
    segments.push({ kind: 'url', href, raw: consumed })
    lastIndex = consumedEnd
    re.lastIndex = consumedEnd
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) })
  }

  return mergeAdjacentTextSegments(segments)
}

/** 相邻 text 片段合并，避免空跑。 */
function mergeAdjacentTextSegments(segments: CluePlainSegment[]): CluePlainSegment[] {
  const out: CluePlainSegment[] = []
  for (const segment of segments) {
    if (segment.kind === 'text' && segment.text.length === 0) {
      continue
    }
    const prev = out[out.length - 1]
    if (segment.kind === 'text' && prev?.kind === 'text') {
      out[out.length - 1] = { kind: 'text', text: prev.text + segment.text }
      continue
    }
    out.push(segment)
  }
  return out
}

/**
 * 片段序列化回纯 clue（URL 用规范化 href，保证提交稳定）。
 */
export function serializeClueSegmentsToPlain(segments: CluePlainSegment[]): string {
  return segments.map(segment => (segment.kind === 'url' ? segment.href : segment.text)).join('')
}

/**
 * **仅用户可见展示**：把 clue 纯文本里的 URL 换成缩短 host/path。
 * 不碰传输/存储/会话字面（prior utterances、RECALL_WITH_CLUE、aria 完整标题等仍用原文）。
 * 权威原则：`docs/product/Yiveno-可见与契约分面-体验原则.md`。
 */
export function formatCluePlainForUserDisplay(plain: string): string {
  const trimmed = plain.trim()
  if (!trimmed) {
    return plain
  }
  const segments = parseCluePlainSegments(trimmed, { chipTrailing: true })
  if (segments.length === 0) {
    return plain
  }
  return segments
    .map(segment =>
      segment.kind === 'url' ? formatClueUrlDisplayLabel(segment.href) : segment.text
    )
    .join('')
}

/**
 * 书签/库条目标题可见面：整段若是 URL → 缩短 host/path；夹 URL 口语 → 缩短夹缝；否则原样。
 * `fallbackUrl` 仅在标题为空时用于展示回退（契约 title/url 字段不改）。
 */
export function formatSavedTitleForUserDisplay(title: string, fallbackUrl?: string): string {
  const trimmed = title.trim()
  if (!trimmed) {
    const href = fallbackUrl?.trim()
    return href ? formatClueUrlDisplayLabel(href) : ''
  }
  const asUrl = normalizeClueUrl(trimmed)
  if (asUrl) {
    return formatClueUrlDisplayLabel(asUrl)
  }
  return formatCluePlainForUserDisplay(trimmed)
}
