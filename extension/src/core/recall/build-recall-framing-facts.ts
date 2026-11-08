/**
 * 从 RecallResult 构建列表级 Framing 事实（确定性；供静态模板或 LLM 润色）。
 */
import { COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED } from '@/core/recall/compute-composer-placeholder'
import { pickPrimaryMatchedField } from '@/core/recall/explain-recall-match'
import { extractDomainFromUrl } from '@/core/memory/payload'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type {
  RecallFramingAmbiguity,
  RecallFramingBucket,
  RecallFramingFacts,
  RecallFramingRetrievalPath,
  RecallFramingUnderstood
} from '@/core/recall/recall-framing-facts'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'

const POOL_SAMPLE_LIMIT = 20
const NEIGHBORHOOD_PATH_RATIO = 0.5
const NEIGHBORHOOD_BUCKET_RATIO = 0.4
const DOMAIN_BUCKET_MIN_COUNT = 2
const DOMAIN_BUCKET_MIN_RATIO = 0.25
const MAX_BUCKETS = 3

function collectPoolMatches(result: RecallResult): RecallMatch[] {
  return [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible]
}

/**
 * 从 parsed 构建「听懂了什么」事实（Framing P1）。
 * topicTerms 来自 parsed.topic（独立于 contentTerms 的根节点语义角色）。
 * Gap 2：Topic 作为独立维度出现，不埋在 contentTerms 里。
 */
function buildUnderstood(parsed: ParsedRecallClue | undefined): RecallFramingUnderstood {
  // Gap 2：topicTerms 独立表述（与 contentTerms 分工不同：Topic=找什么的，contentTerms=基于什么线索）
  const topicTerms = parsed?.topic?.terms ?? []
  return {
    objectTypes: parsed?.objectTypes ?? [],
    ...(parsed?.timeRange?.label ? { timeLabel: parsed.timeRange.label } : {}),
    ...(parsed?.timeConfidence ? { timeConfidence: parsed.timeConfidence } : {}),
    contentTerms: parsed?.contentTerms ?? [],
    behaviorHints: parsed?.behaviorHints ?? [],
    noteHint: parsed?.noteHint === true,
    ...(topicTerms.length > 0 ? { topicTerms } : {})
  }
}

function resolveItemDomain(match: RecallMatch): string {
  if (match.item.type === 'bookmark') {
    return match.item.payload.domain.trim() || extractDomainFromUrl(match.item.payload.url)
  }
  return match.item.payload.domain.trim() || extractDomainFromUrl(match.item.payload.sourceUrl)
}

function inferRetrievalPath(pool: RecallMatch[]): RecallFramingRetrievalPath {
  const sample = pool.slice(0, POOL_SAMPLE_LIMIT)
  if (sample.length === 0) {
    return 'literal'
  }

  let neighborhoodCount = 0
  let hybridCount = 0

  for (const match of sample) {
    const primary = pickPrimaryMatchedField(match.matchedFields)
    if (primary === 'constraint_neighborhood') {
      neighborhoodCount += 1
    } else if (primary === 'embedding' || primary === 'hybridRrf') {
      hybridCount += 1
    }
  }

  const total = sample.length
  const neighborhoodRatio = neighborhoodCount / total
  const hybridRatio = hybridCount / total

  if (neighborhoodRatio >= NEIGHBORHOOD_PATH_RATIO) {
    return 'constraint_neighborhood'
  }
  if (hybridRatio > 0 && neighborhoodRatio > 0.15) {
    return 'mixed'
  }
  if (hybridRatio > 0) {
    return 'hybrid'
  }
  if (neighborhoodRatio > 0.15) {
    return 'mixed'
  }
  return 'literal'
}

function buildBuckets(pool: RecallMatch[]): RecallFramingBucket[] {
  const sample = pool.slice(0, POOL_SAMPLE_LIMIT)
  if (sample.length === 0) {
    return []
  }

  let excerptCount = 0
  let bookmarkCount = 0
  let withNoteCount = 0
  let neighborhoodCount = 0
  const domainCounts = new Map<string, number>()

  for (const match of sample) {
    if (match.item.type === 'text_excerpt') {
      excerptCount += 1
    } else {
      bookmarkCount += 1
    }
    if (match.item.clues.note?.trim()) {
      withNoteCount += 1
    }
    const primary = pickPrimaryMatchedField(match.matchedFields)
    if (primary === 'constraint_neighborhood') {
      neighborhoodCount += 1
    }
    const domain = resolveItemDomain(match)
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1)
    }
  }

  const total = sample.length
  const raw: RecallFramingBucket[] = []

  if (excerptCount > 0) {
    raw.push({ id: 'excerpt', labelKey: 'framing_bucket_excerpt', count: excerptCount })
  }
  if (bookmarkCount > 0) {
    raw.push({ id: 'bookmark', labelKey: 'framing_bucket_bookmark', count: bookmarkCount })
  }
  if (withNoteCount > 0) {
    raw.push({ id: 'with_note', labelKey: 'framing_bucket_with_note', count: withNoteCount })
  }
  if (neighborhoodCount / total >= NEIGHBORHOOD_BUCKET_RATIO) {
    raw.push({
      id: 'constraint_neighborhood',
      labelKey: 'framing_bucket_constraint',
      count: neighborhoodCount
    })
  }

  for (const [domain, count] of domainCounts.entries()) {
    if (count >= DOMAIN_BUCKET_MIN_COUNT || count / total >= DOMAIN_BUCKET_MIN_RATIO) {
      raw.push({
        id: `domain:${domain}`,
        labelKey: 'framing_bucket_domain',
        count,
        domain
      })
    }
  }

  return raw.sort((a, b) => b.count - a.count).slice(0, MAX_BUCKETS)
}

function inferAmbiguity(input: {
  outcome: RecallResult['outcome']
  isWide: boolean
  buckets: RecallFramingBucket[]
  understood: RecallFramingUnderstood
}): RecallFramingAmbiguity | undefined {
  if (input.outcome !== 'need_a_clue' && !input.isWide) {
    return undefined
  }

  const domainBuckets = input.buckets.filter(bucket => bucket.id.startsWith('domain:'))
  if (domainBuckets.length >= 2) {
    return { kind: 'site', promptKey: 'framing_ambiguity_site' }
  }

  const noteBucket = input.buckets.find(bucket => bucket.id === 'with_note')
  if (noteBucket && noteBucket.count >= 2) {
    return { kind: 'note', promptKey: 'framing_ambiguity_note' }
  }

  const objectType = input.understood.objectTypes[0]
  const neighborhoodBucket = input.buckets.find(bucket => bucket.id === 'constraint_neighborhood')
  if (neighborhoodBucket && objectType && input.outcome === 'need_a_clue') {
    return {
      kind: 'type_mix',
      promptKey: 'framing_ambiguity_type_mix',
      objectType
    }
  }

  if (input.outcome === 'need_a_clue') {
    return { kind: 'token', promptKey: 'framing_ambiguity_token' }
  }

  if (input.isWide && domainBuckets.length === 1) {
    return { kind: 'site', promptKey: 'framing_ambiguity_site' }
  }

  return undefined
}

function shouldIncludeBuckets(input: {
  outcome: RecallResult['outcome']
  isWide: boolean
  buckets: RecallFramingBucket[]
}): RecallFramingBucket[] {
  if (input.outcome === 'need_a_clue') {
    return input.buckets.length >= 2 ? input.buckets : []
  }
  if (input.isWide && input.buckets.length >= 2) {
    return input.buckets
  }
  return []
}

/**
 * 构建 Framing 事实；无候选且无 guess 时返回 null。
 */
export function buildRecallFramingFacts(
  result: RecallResult,
  options: { shownCount?: number } = {}
): RecallFramingFacts | null {
  const pool = collectPoolMatches(result)
  const parsed = result.parsed
  const understood = buildUnderstood(parsed)

  if (result.outcome === 'no_match') {
    if (result.emptyKind === 'missing_topic') {
      return { kind: 'missing_topic' }
    }
    // Gate A 噪音拒绝：无 Framing（专属 miss 文案由 UI 消费 emptyKind）
    if (result.emptyKind === 'rejected_noise') {
      return null
    }
    // Gate A+ 闲聊短路：无 Framing（自然回复由 UI 消费 assistantReply）
    if (result.emptyKind === 'chitchat') {
      return null
    }
    if (!result.relatedGuess) {
      return null
    }
    return {
      kind: 'guess',
      understood,
      ...(result.emptyKind !== undefined ? { emptyKind: result.emptyKind } : {})
    }
  }

  if (pool.length === 0) {
    return null
  }

  const total = result.totalRankedCount || pool.length
  const shown = Math.min(options.shownCount ?? RECALL_RESULT_PAGE_SIZE, total)
  const isWide = total >= COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED
  const buckets = buildBuckets(pool)
  const bucketsForRender = shouldIncludeBuckets({
    outcome: result.outcome,
    isWide,
    buckets
  })
  const ambiguity = inferAmbiguity({
    outcome: result.outcome,
    isWide,
    buckets,
    understood
  })

  return {
    kind: 'candidates',
    understood,
    retrievalPath: inferRetrievalPath(pool),
    buckets: bucketsForRender,
    stance: result.outcome === 'top_pick' ? 'confident_neighborhood' : 'weak_candidates',
    ...(ambiguity ? { ambiguity } : {}),
    counts: { total, shown },
    isWideNeighborhood: isWide
  }
}
