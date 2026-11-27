/**
 * LLM 解析缓存（同 clue 复用 proposal，避免重复烧配额）。
 *
 * 设计要点：
 * - 缓存对象：LlmParsedClueProposal（不含时间戳）。ParsedRecallClue 的 timeRange 每次调用方
 *   nowMs 重算；同 clue 不同时间调用拿到不同 timeRange 但其他槽位稳定。
 * - 缓存键：`{promptVersion}:{归一化 clue}`。promptVersion = parse system 的稳定哈希；
 *   system 文案变化 → 键不命中 → 旧条目自然失效（无迁移）。
 * - 归一化 clue：trim + lowercase。同 clue 不同大小写/前后空格 → 命中。
 * - 失效策略：TTL 5min + LRU 100 entries。短时间同 clue 复用；跨会话不会命中。
 * - 不缓存：rules_fallback / rejected_noise（不走 LLM）。
 * - 单测可调 `LLM_PARSE_CACHE_TTL_MS` 缩短 TTL；可注入 `promptVersion` 覆盖。
 *
 * 适用边界（模型隔离）：
 * - 条目打写入模型标记；读取只采信与最近一次写入模型（`lastWrittenModel`）一致的条目。
 * - 服务端换模型后：最多一次陈旧命中（同一 clue 在 TTL 内、切换后的第一次重复查询），
 *   随后该次写入会更新 `lastWrittenModel`，旧模条目自愈失效。
 * - 离线换模对比仍建议 `useCache: false`（或先 `clearLlmParseCache()`），避开陈旧命中窗口。
 * - 生产路径：`clue-llm-completer-registry` 装配时机稳定；紧急复位可手动清缓存。
 */

import { hashPromptSystemMaterial } from '@/core/ai/prompt-system-hash'
import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'
import type { LlmParsedClueProposal } from '@/core/recall/understand/llm-parsed-clue-proposal'

/** 默认 TTL：5 分钟。短到跨会话必失效，长到能覆盖连续 Enter + 多轮对话。 */
export const LLM_PARSE_CACHE_TTL_MS = 5 * 60 * 1000

/** 默认最大 entries。100 条 ≈ 数十 KB；LRU 满即丢最旧。 */
export const LLM_PARSE_CACHE_MAX_ENTRIES = 100

interface CacheEntry {
  /** 完整缓存键（含 prompt 版本）。 */
  cacheKey: string
  /** 已归一化 clue（trim + lowercase）；用于二次校验。 */
  normalizedClue: string
  /** 缓存的 LLM 提议（不含时间戳）。 */
  proposal: LlmParsedClueProposal
  /** 写入时间（epoch ms）。 */
  insertedAt: number
  /** 写入该条目的模型名；未知时为 `'unknown'`。 */
  model: string
}

/** 内部缓存（模块级单例）。所有 remember 调用共享。 */
const cache = new Map<string, CacheEntry>()

/**
 * 最近一次写入所用模型。读取时只采信与此一致的条目。
 * 尚未有任何写入时为 null（缓存必空，不触发模型校验）。
 */
let lastWrittenModel: string | null = null

/** 惰性缓存：当前 parse system 哈希。 */
let memoizedParsePromptVersion: string | null = null

/** 由 parse system 字符串计算版本段（稳定哈希）。 */
export function hashLlmParsePromptVersion(systemPrompt: string): string {
  return hashPromptSystemMaterial(systemPrompt)
}

/** 当前生产 parse system 的版本段（memo；system 文案变则进程内需清 memo / 重启）。 */
export function getLlmParsePromptVersion(): string {
  if (memoizedParsePromptVersion) {
    return memoizedParsePromptVersion
  }
  const system = buildLlmParseClueMessages('').find(m => m.role === 'system')?.content ?? ''
  memoizedParsePromptVersion = hashLlmParsePromptVersion(system)
  return memoizedParsePromptVersion
}

/** 单测：重置 memo，使下次 getLlmParsePromptVersion 重算。 */
export function clearLlmParsePromptVersionMemo(): void {
  memoizedParsePromptVersion = null
}

/**
 * 拼缓存键。空 clue → null。
 * 格式：`{promptVersion}:{normalizedClue}`。
 */
export function buildLlmParseCacheKey(rawClue: string, promptVersion: string): string | null {
  const normalized = rawClue.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  return `${promptVersion}:${normalized}`
}

type CacheLookupOptions = {
  nowMs?: number
  ttlMs?: number
  maxEntries?: number
  /** 覆盖默认 parse system 版本（单测注入）。 */
  promptVersion?: string
}

type CacheWriteOptions = {
  nowMs?: number
  maxEntries?: number
  model?: string
  /** 覆盖默认 parse system 版本（单测注入）。 */
  promptVersion?: string
}

/**
 * 查询缓存。命中返回 proposal；过期 / 模型不一致 / 未命中返回 null。
 * 顺手清理过期与超容量项（lazy eviction）。
 */
export function getCachedLlmParse(
  rawClue: string,
  options: CacheLookupOptions = {}
): LlmParsedClueProposal | null {
  const promptVersion = options.promptVersion ?? getLlmParsePromptVersion()
  const cacheKey = buildLlmParseCacheKey(rawClue, promptVersion)
  if (!cacheKey) {
    return null
  }
  const normalized = rawClue.trim().toLowerCase()
  const now = options.nowMs ?? Date.now()
  const ttl = options.ttlMs ?? LLM_PARSE_CACHE_TTL_MS
  const maxEntries = options.maxEntries ?? LLM_PARSE_CACHE_MAX_ENTRIES

  const entry = cache.get(cacheKey)
  if (!entry) {
    return null
  }
  if (entry.cacheKey !== cacheKey || entry.normalizedClue !== normalized) {
    cache.delete(cacheKey)
    return null
  }
  if (now - entry.insertedAt > ttl) {
    cache.delete(cacheKey)
    return null
  }
  // 模型校验：与最近一次写入模型不一致 → 作废（换模后自愈）
  if (lastWrittenModel !== null && entry.model !== lastWrittenModel) {
    cache.delete(cacheKey)
    return null
  }

  // LRU 提升：删旧位 + 加新位（Map 保留插入顺序）
  cache.delete(cacheKey)
  cache.set(cacheKey, entry)

  // lazy 清理超容量（只在查询路径顺手做；写入路径也会校验）
  if (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }

  return entry.proposal
}

/**
 * 写入缓存。容量满时丢最旧（LRU）。
 * 同 clue 命中后会刷新 insertedAt（视为复用）；同步更新 lastWrittenModel。
 */
export function setCachedLlmParse(
  rawClue: string,
  proposal: LlmParsedClueProposal,
  options: CacheWriteOptions = {}
): void {
  const promptVersion = options.promptVersion ?? getLlmParsePromptVersion()
  const cacheKey = buildLlmParseCacheKey(rawClue, promptVersion)
  if (!cacheKey) {
    return
  }
  const normalized = rawClue.trim().toLowerCase()
  const now = options.nowMs ?? Date.now()
  const maxEntries = options.maxEntries ?? LLM_PARSE_CACHE_MAX_ENTRIES
  const model = options.model ?? 'unknown'

  if (cache.has(cacheKey)) {
    cache.delete(cacheKey)
  } else if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }

  cache.set(cacheKey, {
    cacheKey,
    normalizedClue: normalized,
    proposal,
    insertedAt: now,
    model
  })
  lastWrittenModel = model
}

/** 清空缓存。单测 / 紧急复位使用；同时重置 lastWrittenModel。 */
export function clearLlmParseCache(): void {
  cache.clear()
  lastWrittenModel = null
}

/** 当前缓存大小（仅诊断 / 单测）。 */
export function getLlmParseCacheSize(): number {
  return cache.size
}
