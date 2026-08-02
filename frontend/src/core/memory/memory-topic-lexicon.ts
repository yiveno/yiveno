/**
 * Capture / Recall 共用主题词典：标题别名 → English canonical keywords（+ 可选实体）。
 * 写入 IndexedDB 的仍是英文；其它语言 surface 仅用于识别与查询扩展。
 * 不做开放推荐，只服务库内可问。
 */

import { normalizeRecallText } from '@/core/recall/keyword-filter'

/** 主题规则：命中任一 surface → 写入 keywords，并可附带实体。 */
export type MemoryTopicLexiconEntry = {
  /** 调试 / 日志用稳定 id */
  id: string
  /** 标题/备注/线索中的识别词面（可含中文 alias） */
  surfaces: string[]
  /** 写入 clues.keywords 的 English canonical */
  keywords: string[]
  /** 同时写入 clues.entities 的 English canonical（可选） */
  entities?: string[]
}

/**
 * P0 主题规则（宁缺毋滥：宁可不标，也不广撒误标）。
 * surface 按长度优先匹配，避免短词误伤。
 */
export const MEMORY_TOPIC_LEXICON: MemoryTopicLexiconEntry[] = [
  {
    id: 'wwii',
    surfaces: [
      'world war ii',
      'world war 2',
      'second world war',
      'wwii',
      'ww2',
      '希特勒',
      '纳粹',
      '闪击波兰',
      '诺曼底',
      '二战',
      'hitler',
      'nazi',
      'nazism'
    ],
    // 实体（Hitler 等）由 MEMORY_TOPIC_ENTITY_LEXICON 按标题实词写入，避免「仅二战」误挂人名
    keywords: ['wwii', 'world war ii']
  },
  {
    id: 'city-economy',
    surfaces: [
      '破产省会',
      '失去增长',
      '增长能力',
      '省会破产',
      '城市经济',
      'economic growth',
      'bankrupt capital'
    ],
    keywords: ['economy', 'city', 'growth']
  }
]

/** 实体词典补充：主题未覆盖、但标题常出现的专名。 */
export type MemoryTopicEntityEntry = {
  canonical: string
  aliases: string[]
}

export const MEMORY_TOPIC_ENTITY_LEXICON: MemoryTopicEntityEntry[] = [
  { canonical: 'Hitler', aliases: ['希特勒', 'hitler'] },
  { canonical: 'Changchun', aliases: ['长春', 'changchun'] },
  { canonical: 'BBC', aliases: ['bbc news', 'bbc'] }
]

function surfaceHitsBlob(blobNormalized: string, surface: string): boolean {
  const needle = normalizeRecallText(surface)
  return Boolean(needle) && blobNormalized.includes(needle)
}

/** 从正文/标题推断主题 keywords + entities。 */
export function detectTopicsFromText(blob: string): {
  keywords: string[]
  entities: string[]
} {
  const normalized = normalizeRecallText(blob)
  if (!normalized) {
    return { keywords: [], entities: [] }
  }

  const keywords: string[] = []
  const entities: string[] = []

  const orderedTopics = [...MEMORY_TOPIC_LEXICON].sort((left, right) => {
    const leftMax = Math.max(...left.surfaces.map(s => s.length))
    const rightMax = Math.max(...right.surfaces.map(s => s.length))
    return rightMax - leftMax
  })

  for (const topic of orderedTopics) {
    const hit = topic.surfaces.some(surface => surfaceHitsBlob(normalized, surface))
    if (!hit) {
      continue
    }
    keywords.push(...topic.keywords)
  }

  const orderedEntities = [...MEMORY_TOPIC_ENTITY_LEXICON].sort((left, right) => {
    const leftMax = Math.max(left.canonical.length, ...left.aliases.map(a => a.length))
    const rightMax = Math.max(right.canonical.length, ...right.aliases.map(a => a.length))
    return rightMax - leftMax
  })

  for (const entry of orderedEntities) {
    const surfaces = [entry.canonical, ...entry.aliases]
    if (surfaces.some(surface => surfaceHitsBlob(normalized, surface))) {
      entities.push(entry.canonical)
    }
  }

  return { keywords, entities }
}

/**
 * 查询侧：把 contentTerms / 原始片段里的主题 alias 扩成 English canonical 检索词。
 * 保序去重；原词保留，便于标题里仍有中文时直中。
 */
export function expandRecallContentTerms(terms: string[]): string[] {
  if (terms.length === 0) {
    return []
  }

  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    out.push(trimmed)
  }

  for (const term of terms) {
    push(term)
    const normalizedTerm = normalizeRecallText(term)
    if (!normalizedTerm) {
      continue
    }

    for (const topic of MEMORY_TOPIC_LEXICON) {
      if (topic.surfaces.some(surface => surfaceHitsBlob(normalizedTerm, surface))) {
        for (const keyword of topic.keywords) {
          push(keyword)
        }
      }
    }

    for (const entry of MEMORY_TOPIC_ENTITY_LEXICON) {
      const surfaces = [entry.canonical, ...entry.aliases]
      if (surfaces.some(surface => surfaceHitsBlob(normalizedTerm, surface))) {
        push(entry.canonical)
      }
    }
  }

  return out
}
