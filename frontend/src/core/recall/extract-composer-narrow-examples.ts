/**
 * 从本轮候选抽取 composer Narrow 举例（grounded，无主题 seed）。
 * P1：按切割力（信息增益）排序——优先能切开邻域的类型/token/host。
 */

import { MEMORY_DOMAIN_ENRICHMENT_RULES } from '@/core/memory/enrich-memory-clues'
import {
  isUsableRecallToken,
  normalizeRecallText,
  RECALL_GENERIC_CLUE_TERMS
} from '@/core/recall/keyword-filter'
import { RECALL_OBJECT_TYPE_CANONICAL_SURFACES } from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/**
 * 单一类型占比达此阈值则不再用类型当举例（无切割力）。
 * P1：略收紧（0.8），避免「几乎全是 video」仍举 video。
 */
export const NARROW_EXAMPLE_TYPE_DOMINANCE_MAX = 0.8

/** 最多返回几个举例（UI 通常只用前 2 个）。 */
export const NARROW_EXAMPLE_MAX = 3

/** 拉丁举例词最短长度（过短无信息）。 */
const LATIN_EXAMPLE_MIN_LEN = 3

/**
 * 候选 ≥ 此数时：token/host 若覆盖全部文档则视为无切割力（降权或丢弃）。
 * 仅 2 条时共现必覆盖全池，仍允许。
 */
export const NARROW_EXAMPLE_FULL_COVER_MIN_DOCS = 3

/**
 * URL/DNS 结构词：可在多 host 副标题共现，但对收窄无切割力。
 * 闭集基建词，不是内容别名表。
 */
const NARROW_EXAMPLE_URL_STRUCTURE_TOKENS = new Set([
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'io',
  'co',
  'uk',
  'us',
  'cn',
  'jp',
  'de',
  'fr',
  'www',
  'http',
  'https',
  'html',
  'htm',
  'php',
  'asp',
  'aspx',
  'index'
])

/**
 * 标题/副标题里常见、但对邻域切割力弱的英文页壳词。
 * 闭集产品启发式（非专名/主题 seed）。
 */
const NARROW_EXAMPLE_LOW_CUT_TOKENS = new Set([
  'guide',
  'guides',
  'tutorial',
  'tutorials',
  'docs',
  'documentation',
  'modern',
  'introduction',
  'overview',
  'chapter',
  'section',
  'edition',
  'volume',
  'readme',
  'home',
  'about',
  'getting',
  'started'
])

/** 抽取输入：与结果卡对齐的字段子集。 */
export type NarrowExampleSource = {
  itemKind: 'bookmark' | 'text_excerpt'
  title: string
  subtitle: string
  url: string
  excerpt?: string
  note?: string
}

export type ExtractComposerNarrowExamplesInput = {
  candidates: readonly NarrowExampleSource[]
  /** 用户已说线索（小写比对，避免重复举）。 */
  clueText?: string
}

function normalizeHost(urlOrHost: string): string | null {
  const raw = urlOrHost.trim()
  if (!raw) {
    return null
  }
  try {
    const host = (raw.includes('://') ? new URL(raw).hostname : raw)
      .toLowerCase()
      .replace(/^www\./, '')
    if (!host) {
      return null
    }
    // 摘录详情常是 chrome-extension://<id>/detail.html——对收窄无意义
    if (raw.startsWith('chrome-extension:') || raw.startsWith('chrome:')) {
      return null
    }
    // 32 位扩展 id 形态
    if (/^[a-p]{32}$/.test(host)) {
      return null
    }
    return host
  } catch {
    return null
  }
}

function matchObjectTypeFromHost(host: string): RecallObjectType | null {
  for (const rule of MEMORY_DOMAIN_ENRICHMENT_RULES) {
    for (const candidate of rule.hosts) {
      if (host === candidate || host.endsWith(`.${candidate}`)) {
        return rule.objectType
      }
    }
  }
  return null
}

/** 展示用 host 短标签（仍须能在 url 中核验）。 */
function hostExampleLabel(host: string): string {
  const parts = host.split('.').filter(Boolean)
  for (const part of parts) {
    const head = part.toLowerCase()
    if (
      head.length >= LATIN_EXAMPLE_MIN_LEN &&
      /^[a-z0-9-]+$/i.test(head) &&
      !NARROW_EXAMPLE_URL_STRUCTURE_TOKENS.has(head) &&
      !NARROW_EXAMPLE_LOW_CUT_TOKENS.has(head)
    ) {
      return head
    }
  }
  return host
}

function isLatinExampleToken(token: string): boolean {
  return /^[a-z][a-z0-9-]{2,31}$/i.test(token)
}

function isBlockedExampleToken(token: string): boolean {
  return (
    NARROW_EXAMPLE_URL_STRUCTURE_TOKENS.has(token) ||
    NARROW_EXAMPLE_LOW_CUT_TOKENS.has(token) ||
    RECALL_GENERIC_CLUE_TERMS.has(token) ||
    /^[a-p]{32}$/.test(token)
  )
}

function collectLatinTokens(text: string, sink: Set<string>): void {
  const normalized = normalizeRecallText(text)
  if (!normalized) {
    return
  }
  for (const match of normalized.match(/[a-z][a-z0-9-]*/gi) ?? []) {
    const token = match.toLowerCase()
    if (
      token.length >= LATIN_EXAMPLE_MIN_LEN &&
      isUsableRecallToken(token) &&
      isLatinExampleToken(token) &&
      !isBlockedExampleToken(token)
    ) {
      sink.add(token)
    }
  }
}

function clueTokenSet(clueText: string | undefined): Set<string> {
  const out = new Set<string>()
  if (!clueText?.trim()) {
    return out
  }
  collectLatinTokens(clueText, out)
  return out
}

/**
 * 切割力分：优先「覆盖部分文档」（能切开），其次接近半池共现，再次更长词面。
 * df / nDoc ∈ (0,1)；全覆盖时 cut=0。
 */
export function scoreNarrowExampleDocFreq(df: number, nDoc: number): number {
  if (df < 2 || nDoc <= 0) {
    return -1
  }
  const coverage = df / nDoc
  const cuts = nDoc >= NARROW_EXAMPLE_FULL_COVER_MIN_DOCS && df >= nDoc ? 0 : 1
  // 半池附近信息增益更高；全覆盖罚掉
  const balance = 1 - Math.abs(coverage - 0.5) * 2
  return cuts * 10 + balance * 3
}

type RankedFreq = { key: string; label: string; df: number; score: number }

function rankByCuttingPower(
  freq: Map<string, number>,
  nDoc: number,
  labelOf: (key: string) => string,
  options?: { dropFullCoverWhenDiverse?: boolean }
): RankedFreq[] {
  const ranked: RankedFreq[] = []
  const hasCuttingAlternative =
    nDoc >= NARROW_EXAMPLE_FULL_COVER_MIN_DOCS &&
    ([...freq.values()].some(otherDf => otherDf >= 2 && otherDf < nDoc) ||
      Boolean(options?.dropFullCoverWhenDiverse))
  for (const [key, df] of freq.entries()) {
    if (df < 2) {
      continue
    }
    const score = scoreNarrowExampleDocFreq(df, nDoc)
    if (score < 0) {
      continue
    }
    if (hasCuttingAlternative && df >= nDoc) {
      continue
    }
    ranked.push({ key, label: labelOf(key), df, score })
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.label.length - a.label.length ||
      b.df - a.df ||
      a.label.localeCompare(b.label)
  )
  return ranked
}

/**
 * 从候选抽 0～NARROW_EXAMPLE_MAX 个英文举例词。
 * 每个返回值必须能在某条候选的 title/excerpt/note/url/类型信号中核验。
 */
export function extractComposerNarrowExamples(input: ExtractComposerNarrowExamplesInput): string[] {
  const candidates = input.candidates
  if (candidates.length === 0) {
    return []
  }

  const nDoc = candidates.length
  const blocked = clueTokenSet(input.clueText)
  const picked: string[] = []
  const pickedLower = new Set<string>()

  const push = (raw: string, options?: { allowGenericSurface?: boolean }): void => {
    const value = raw.trim()
    if (!value) {
      return
    }
    const key = value.toLowerCase()
    if (blocked.has(key) || pickedLower.has(key)) {
      return
    }
    if (!options?.allowGenericSurface && isBlockedExampleToken(key)) {
      return
    }
    if (
      options?.allowGenericSurface &&
      (NARROW_EXAMPLE_URL_STRUCTURE_TOKENS.has(key) || NARROW_EXAMPLE_LOW_CUT_TOKENS.has(key))
    ) {
      return
    }
    pickedLower.add(key)
    picked.push(value)
  }

  // 先扫 host 多样性：有多 host 时，全覆盖 token 无切割力可丢
  const hostCountsEarly = new Map<string, number>()
  for (const card of candidates) {
    const host = normalizeHost(card.url)
    if (!host) {
      continue
    }
    hostCountsEarly.set(host, (hostCountsEarly.get(host) ?? 0) + 1)
  }
  const hasHostDiversity = hostCountsEarly.size >= 2

  // A. 对象类型（域名启发式 + bookmark 种类）；须 ≥2 种且无单类统治
  const typeCounts = new Map<RecallObjectType, number>()
  for (const card of candidates) {
    const host = normalizeHost(card.url)
    const fromHost = host ? matchObjectTypeFromHost(host) : null
    const type: RecallObjectType | null =
      fromHost ?? (card.itemKind === 'bookmark' ? 'bookmark' : null)
    if (!type) {
      continue
    }
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
  }
  const typedTotal = [...typeCounts.values()].reduce((sum, n) => sum + n, 0)
  if (typeCounts.size >= 2 && typedTotal > 0) {
    const dominant = Math.max(...typeCounts.values()) / typedTotal
    if (dominant < NARROW_EXAMPLE_TYPE_DOMINANCE_MAX) {
      // 按频次降序，但跳过「几乎统治」的那一类之外的平衡：已用 dominant 门
      const rankedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])
      for (const [type] of rankedTypes) {
        if (picked.length >= NARROW_EXAMPLE_MAX) {
          break
        }
        push(RECALL_OBJECT_TYPE_CANONICAL_SURFACES[type], { allowGenericSurface: true })
      }
    }
  }

  // B. 跨文档拉丁 token：df≥2，优先切开邻域（非全覆盖）
  if (picked.length < NARROW_EXAMPLE_MAX) {
    const docFreq = new Map<string, number>()
    for (const card of candidates) {
      const perDoc = new Set<string>()
      collectLatinTokens(card.title, perDoc)
      collectLatinTokens(card.excerpt ?? '', perDoc)
      collectLatinTokens(card.note ?? '', perDoc)
      // 副标题若是纯 host，host 路径 C 已覆盖；仍收集以免漏 title 外的词
      collectLatinTokens(card.subtitle, perDoc)
      for (const token of perDoc) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1)
      }
    }
    const rankedTokens = rankByCuttingPower(docFreq, nDoc, key => key, {
      dropFullCoverWhenDiverse: hasHostDiversity
    })
    for (const entry of rankedTokens) {
      if (picked.length >= NARROW_EXAMPLE_MAX) {
        break
      }
      push(entry.label)
    }
  }

  // C. 多 host（复用早期扫描）
  if (picked.length < NARROW_EXAMPLE_MAX && hasHostDiversity) {
    const rankedHosts = [...hostCountsEarly.entries()]
      .map(([host, df]) => {
        const label = hostExampleLabel(host)
        const rarity = 1 - df / nDoc
        return {
          label,
          score: rarity * 10 + Math.min(label.length, 24) * 0.05
        }
      })
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    for (const entry of rankedHosts) {
      if (picked.length >= NARROW_EXAMPLE_MAX) {
        break
      }
      push(entry.label)
    }
  }

  return picked.slice(0, NARROW_EXAMPLE_MAX)
}
