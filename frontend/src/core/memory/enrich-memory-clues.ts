/**
 * Capture-time 规则 enrichment：从标题/正文/域名推断 tags / keywords。
 * 无 LLM；与 parse-recall-clue 对象类型 slug 对齐。
 * **禁止**内容/专名硬编码别名表（主题·实体 seed）；实体留给 LLM enrichment / 用户备注 / 字面线索。
 * 见产品文档 §0.1.1「市场语言与 Recall Language Strategy」与 AGENTS「全量用户能力」。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { scrubRetiredEnrichmentSeedTokens } from '@/core/memory/retired-enrichment-seeds'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  RECALL_OBJECT_TYPE_CANONICAL_SURFACES,
  RECALL_OBJECT_TYPE_LEXICON
} from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/** enrichment 产物（写入 clues 扩展位）。 */
export type MemoryClueEnrichment = {
  tags: string[]
  keywords: string[]
  entities: string[]
}

export type EnrichMemoryCluesInput = {
  title?: string
  text?: string
  note?: string
  url?: string
  domain?: string
}

/** 高频站域名 → 对象类型 + 用途关键词（host 小写，可无 www）。 */
export type DomainEnrichmentRule = {
  /** 精确 host，或以 `.` 开头的后缀匹配（如 `.github.com` 不采用；用 endsWith）。 */
  hosts: string[]
  objectType: RecallObjectType
  keywords: string[]
}

/**
 * P0 高频站映射。host 比较前会去 www. 并小写。
 */
export const MEMORY_DOMAIN_ENRICHMENT_RULES: DomainEnrichmentRule[] = [
  {
    hosts: [
      'music.163.com',
      'y.qq.com',
      'open.spotify.com',
      'music.apple.com',
      'soundcloud.com',
      'kugou.com',
      'kuwo.cn'
    ],
    objectType: 'song',
    keywords: ['music', 'listen', 'audio', 'song', 'playlist', 'track']
  },
  {
    hosts: ['youtube.com', 'youtu.be', 'bilibili.com', 'b23.tv', 'vimeo.com'],
    objectType: 'video',
    keywords: ['video', 'youtube', 'watch', 'clip']
  },
  {
    hosts: [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'gitee.com',
      'stackoverflow.com',
      'npmjs.com',
      'crates.io'
    ],
    objectType: 'code',
    keywords: ['code', 'repo', 'snippet', 'development', 'programming', 'repository']
  },
  {
    hosts: [
      'zhihu.com',
      'juejin.cn',
      'zhuanlan.zhihu.com',
      'mp.weixin.qq.com',
      'medium.com',
      'substack.com',
      'reddit.com',
      'sspai.com',
      'infoq.cn'
    ],
    objectType: 'article',
    keywords: ['article', 'reading', 'story', 'tutorial', 'write-up']
  },
  {
    hosts: [
      'developer.mozilla.org',
      'docs.github.com',
      'developers.cloudflare.com',
      'readthedocs.io'
    ],
    objectType: 'article',
    keywords: ['docs', 'tutorial', 'guide', 'reference']
  }
]

/**
 * 按对象类型补充 recall 导向关键词（与 parser 口语槽位对齐）。
 * 域名规则未覆盖时，文本识别出类型也会写入。
 */
export const MEMORY_OBJECT_TYPE_RECALL_KEYWORDS: Partial<Record<RecallObjectType, string[]>> = {
  song: ['song', 'music', 'listen', 'audio', 'playlist', 'track'],
  video: ['video', 'youtube', 'watch', 'clip'],
  article: ['article', 'reading', 'story', 'tutorial', 'guide', 'write-up', 'docs'],
  code: ['code', 'repo', 'snippet', 'development', 'programming', 'repository'],
  poem: ['poem', 'poetry'],
  command: ['command', 'terminal', 'cli'],
  quote: ['quote', 'excerpt', 'highlight', 'passage'],
  password: ['password', 'login', 'credentials'],
  bookmark: ['bookmark', 'bookmarked', 'saved']
}

/** 正文/标题命中特定词面时追加 recall 关键词（English canonical）。 */
export type TextRecallKeywordRule = {
  surfaces: string[]
  keywords: string[]
}

/**
 * 正文词面 → recall 导向关键词（闭合产品启发式，非开放同义词典）。
 * 仅通用英文槽位词面；禁止专名/主题 seed。
 */
export const MEMORY_TEXT_RECALL_KEYWORD_RULES: TextRecallKeywordRule[] = [
  { surfaces: ['tutorial', 'how-to', 'how to'], keywords: ['tutorial', 'guide'] },
  { surfaces: ['readme'], keywords: ['readme', 'docs'] },
  { surfaces: ['playlist'], keywords: ['playlist', 'listen'] },
  { surfaces: ['authentication', 'authorize'], keywords: ['auth', 'authentication'] },
  { surfaces: ['deployment', 'deploy'], keywords: ['deploy', 'deployment'] }
]

/** 合并去重（保序）。 */
export function mergeUniqueStrings(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const raw of list ?? []) {
      const value = raw.trim()
      if (!value) {
        continue
      }
      const key = value.toLowerCase()
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

function normalizeHost(domainOrUrl: string | undefined): string | null {
  if (!domainOrUrl?.trim()) {
    return null
  }
  let host = domainOrUrl.trim().toLowerCase()
  try {
    if (host.includes('://')) {
      host = new URL(host).hostname.toLowerCase()
    }
  } catch {
    // 非 URL 时按域名片段处理
  }
  host = host.replace(/^www\./, '')
  return host || null
}

function matchDomainRule(host: string): DomainEnrichmentRule | null {
  for (const rule of MEMORY_DOMAIN_ENRICHMENT_RULES) {
    for (const candidate of rule.hosts) {
      if (host === candidate || host.endsWith(`.${candidate}`)) {
        return rule
      }
    }
  }
  return null
}

function detectObjectTypesFromText(blob: string): RecallObjectType[] {
  const normalized = normalizeRecallText(blob)
  if (!normalized) {
    return []
  }

  const ordered = [...RECALL_OBJECT_TYPE_LEXICON].sort(
    (left, right) => right.surface.length - left.surface.length
  )
  const occupied = new Array<boolean>(normalized.length).fill(false)
  const types: RecallObjectType[] = []

  for (const entry of ordered) {
    // 过泛的「页面/网页」不从正文自动打标，避免几乎全库都是 page
    // bookmark 由 MemoryItem.type 在召回侧对齐，勿因标题含 bookmark 误打
    // clueOnly（如 clip→video）仅线索解析，正文打标会假阳性（diversity「clip 1201」）
    if (entry.value === 'page' || entry.value === 'bookmark' || entry.clueOnly) {
      continue
    }
    const needle = normalizeRecallText(entry.surface)
    if (needle.length < 1) {
      continue
    }
    let from = 0
    while (from < normalized.length) {
      const index = normalized.indexOf(needle, from)
      if (index < 0) {
        break
      }
      const end = index + needle.length
      if (!occupied.slice(index, end).some(Boolean)) {
        for (let i = index; i < end; i += 1) {
          occupied[i] = true
        }
        if (!types.includes(entry.value)) {
          types.push(entry.value)
        }
        break
      }
      from = index + 1
    }
  }

  return types
}

/** 从正文词面推断 recall 导向关键词。 */
function detectRecallKeywordsFromText(blob: string): string[] {
  const normalized = normalizeRecallText(blob)
  if (!normalized) {
    return []
  }

  const hits: string[] = []
  for (const rule of MEMORY_TEXT_RECALL_KEYWORD_RULES) {
    for (const surface of rule.surfaces) {
      const needle = normalizeRecallText(surface)
      if (needle && normalized.includes(needle)) {
        hits.push(...rule.keywords)
        break
      }
    }
  }
  return hits
}

function appendRecallKeywordsForTypes(keywords: string[], objectTypes: RecallObjectType[]): void {
  for (const type of objectTypes) {
    const recallKeywords = MEMORY_OBJECT_TYPE_RECALL_KEYWORDS[type]
    if (recallKeywords) {
      keywords.push(...recallKeywords)
    }
    const surface = RECALL_OBJECT_TYPE_CANONICAL_SURFACES[type]
    if (surface) {
      keywords.push(surface)
    }
  }
}

/**
 * 根据原始字段推断 enrichment。
 * 调用方负责与已有 clues 合并。
 */
export function enrichMemoryClues(input: EnrichMemoryCluesInput): MemoryClueEnrichment {
  const host = normalizeHost(input.domain) ?? normalizeHost(input.url)
  const textBlob = [input.title, input.text, input.note].filter(Boolean).join('\n')

  const tags: string[] = []
  const keywords: string[] = []
  const objectTypes: RecallObjectType[] = []

  if (host) {
    const rule = matchDomainRule(host)
    if (rule) {
      objectTypes.push(rule.objectType)
      tags.push(rule.objectType)
      keywords.push(...rule.keywords)
    }
  }

  const textTypes = detectObjectTypesFromText(textBlob)
  tags.push(...textTypes)
  objectTypes.push(...textTypes)

  appendRecallKeywordsForTypes(keywords, [...new Set(objectTypes)])

  keywords.push(...detectRecallKeywordsFromText(textBlob))

  // 规则层不写 entities：禁止专名 allowlist；实体由 LLM enrichment / 用户备注承接
  return {
    tags: mergeUniqueStrings(tags),
    keywords: mergeUniqueStrings(keywords),
    entities: []
  }
}

/** 从 MemoryItem 抽出 enrichment 输入字段。 */
export function enrichInputFromMemoryItem(item: MemoryItem): EnrichMemoryCluesInput {
  if (item.type === 'bookmark') {
    return {
      title: item.payload.title,
      url: item.payload.url,
      domain: item.payload.domain,
      ...(item.clues.note?.trim() ? { note: item.clues.note } : {})
    }
  }

  return {
    title: item.payload.pageTitle,
    text: item.payload.selectedText,
    url: item.payload.sourceUrl,
    domain: item.payload.domain,
    ...(item.clues.note?.trim() ? { note: item.clues.note } : {})
  }
}

function sameStringListIgnoreCase(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const normalize = (list: string[]): string[] =>
    list.map(entry => entry.trim().toLowerCase()).sort()
  const a = normalize(left)
  const b = normalize(right)
  return a.every((value, index) => value === b[index])
}

const VIDEO_RECALL_KEYWORD_SET = new Set(
  (MEMORY_OBJECT_TYPE_RECALL_KEYWORDS.video ?? []).map(token => token.toLowerCase())
)

/**
 * 去掉「仅因旧版 clip 正文打标」留下的 video tag/keywords。
 * 当前 enrichment 已不再主张 video、且非视频站时 scrub。
 */
function scrubStaleVideoEnrichment(input: {
  tags: string[]
  keywords: string[]
  enrichmentTags: string[]
  domain?: string
  url?: string
}): { tags: string[]; keywords: string[] } {
  const enrichmentHasVideo = input.enrichmentTags.some(tag => tag.trim().toLowerCase() === 'video')
  if (enrichmentHasVideo) {
    return { tags: input.tags, keywords: input.keywords }
  }

  const host = normalizeHost(input.domain) ?? normalizeHost(input.url)
  const videoHost = Boolean(host && matchDomainRule(host)?.objectType === 'video')
  if (videoHost) {
    return { tags: input.tags, keywords: input.keywords }
  }

  const tags = input.tags.filter(tag => tag.trim().toLowerCase() !== 'video')
  const keywords = input.keywords.filter(
    token => !VIDEO_RECALL_KEYWORD_SET.has(token.trim().toLowerCase())
  )
  return { tags, keywords }
}

/**
 * 将规则 enrichment 合并进已有 MemoryItem（不改 createdAt/updatedAt）。
 * 合并后剔除已退役主题/实体 seed（存量 scrub）；并 scrub 旧版 clip→video 误标。
 * LLM 提议请用 mergeMemoryClueEnrichment 后再写回。
 */
export function mergeEnrichmentIntoMemoryItem(item: MemoryItem): {
  item: MemoryItem
  changed: boolean
} {
  const enrichInput = enrichInputFromMemoryItem(item)
  const enrichment = enrichMemoryClues(enrichInput)
  const mergedTags = mergeUniqueStrings(
    item.clues.tags,
    enrichment.tags,
    // 书签语料始终带 bookmark tag，便于类型词面路径与约束邻域一致
    item.type === 'bookmark' ? ['bookmark'] : []
  )
  const mergedKeywords = scrubRetiredEnrichmentSeedTokens(
    mergeUniqueStrings(item.clues.keywords, enrichment.keywords)
  )
  const scrubbed = scrubStaleVideoEnrichment({
    tags: mergedTags,
    keywords: mergedKeywords,
    enrichmentTags: enrichment.tags,
    ...(enrichInput.domain !== undefined ? { domain: enrichInput.domain } : {}),
    ...(enrichInput.url !== undefined ? { url: enrichInput.url } : {})
  })
  const tags = scrubbed.tags
  const keywords = scrubbed.keywords
  const entities = scrubRetiredEnrichmentSeedTokens(
    mergeUniqueStrings(item.clues.entities, enrichment.entities)
  )

  const changed =
    !sameStringListIgnoreCase(tags, item.clues.tags) ||
    !sameStringListIgnoreCase(keywords, item.clues.keywords) ||
    !sameStringListIgnoreCase(entities, item.clues.entities)

  if (!changed) {
    return { item, changed: false }
  }

  return {
    changed: true,
    item: {
      ...item,
      clues: {
        ...item.clues,
        tags,
        keywords,
        entities
      }
    }
  }
}
