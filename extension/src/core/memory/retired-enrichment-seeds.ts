/**
 * 已拆除的主题/实体硬编码 seed（曾写入 clues.keywords / clues.entities）。
 * 回填 v4+ 从存量字段剔除这些词面，避免灰名单假能力残留。
 * 比对大小写不敏感；无法区分「规则 seed」与「LLM 碰巧同词」——一律剔除。
 */

/** 主题词典曾写入的 keywords。 */
const RETIRED_TOPIC_KEYWORDS = ['wwii', 'world war ii', 'economy', 'city', 'growth'] as const

/** 主题实体 + 通用实体 allowlist 曾写入的 canonical（亦曾推进 keywords）。 */
const RETIRED_ENTITY_CANONICALS = [
  'Hitler',
  'Changchun',
  'BBC',
  'Li Bai',
  'Du Fu',
  'Su Shi',
  'Wang Wei',
  'Bai Juyi',
  'React',
  'Vue',
  'TypeScript',
  'Cloudflare',
  'Workers',
  'IndexedDB',
  'Manifest V3',
  'RAG'
] as const

/**
 * 曾随域名/类型规则灌入的同义 keywords（2026-10-30 停灌）。
 * 不含各类型 canonical（song/video/article/…），那些仍可由 enrichment 合法写入。
 */
const RETIRED_SYNONYM_KEYWORDS = [
  'music',
  'listen',
  'audio',
  'playlist',
  'track',
  'youtube',
  'watch',
  'clip',
  'reading',
  'story',
  'tutorial',
  'guide',
  'write-up',
  'docs',
  'repo',
  'snippet',
  'development',
  'programming',
  'repository',
  'poetry',
  'terminal',
  'cli',
  'excerpt',
  'highlight',
  'passage',
  'login',
  'credentials',
  'bookmarked',
  'saved',
  'auth',
  'authentication',
  'deploy',
  'deployment',
  'readme'
] as const

const RETIRED_SEED_KEY_SET: ReadonlySet<string> = new Set(
  [...RETIRED_TOPIC_KEYWORDS, ...RETIRED_ENTITY_CANONICALS, ...RETIRED_SYNONYM_KEYWORDS].map(
    token => token.toLowerCase()
  )
)

/** 是否为已退役 enrichment seed 词面。 */
export function isRetiredEnrichmentSeedToken(value: string): boolean {
  const key = value.trim().toLowerCase()
  return Boolean(key) && RETIRED_SEED_KEY_SET.has(key)
}

/** 从列表剔除退役 seed（保序）。 */
export function scrubRetiredEnrichmentSeedTokens(values: readonly string[]): string[] {
  return values.filter(value => !isRetiredEnrichmentSeedToken(value))
}
