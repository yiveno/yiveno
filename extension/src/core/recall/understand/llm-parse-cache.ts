/**
 * LLM 解析缓存（同 clue 复用 proposal，避免重复烧配额）。
 *
 * 设计要点：
 * - 缓存对象：LlmParsedClueProposal（不含时间戳）。ParsedRecallClue 的 timeRange 每次调用方
 *   nowMs 重算；同 clue 不同时间调用拿到不同 timeRange 但其他槽位稳定。
 * - 缓存键：归一化 clue（trim + lowercase）。同 clue 不同大小写/前后空格 → 命中。
 * - 失效策略：TTL 5min + LRU 100 entries。短时间同 clue 复用；跨会话不会命中。
 * - 不缓存：rules_fallback / rejected_noise（不走 LLM）。
 * - 单测可调 `LLM_PARSE_CACHE_TTL_MS` 缩短 TTL。
 *
 * 适用边界：
 * - 缓存键**不含** model；切换 completer / 换模型时**不**自动失效。
 *   调用方须 `clearLlmParseCache()`，或 `parseRecallClueWithLlm({ useCache: false })`。
 * - 离线换模 / 评测注入 completer 时须 `useCache: false` 或先 `clearLlmParseCache()`，避免串提案。
 * - 生产路径：`clue-llm-completer-registry` 装配时机稳定；换配置时 registry 侧应清缓存。
 */

import type { LlmParsedClueProposal } from '@/core/recall/understand/llm-parsed-clue-proposal'

/** 默认 TTL：5 分钟。短到跨会话必失效，长到能覆盖连续 Enter + 多轮对话。 */
export const LLM_PARSE_CACHE_TTL_MS = 5 * 60 * 1000

/** 默认最大 entries。100 条 ≈ 数十 KB；LRU 满即丢最旧。 */
export const LLM_PARSE_CACHE_MAX_ENTRIES = 100

interface CacheEntry {
  /** 已归一化 clue（trim + lowercase）；用于二次校验。 */
  normalizedClue: string
  /** 缓存的 LLM 提议（不含时间戳）。 */
  proposal: LlmParsedClueProposal
  /** 写入时间（epoch ms）。 */
  insertedAt: number
}

/** 内部缓存（模块级单例）。所有 remember 调用共享。 */
const cache = new Map<string, CacheEntry>()

/**
 * 查询缓存。命中返回 proposal；过期 / 未命中返回 null。
 * 顺手清理过期与超容量项（lazy eviction）。
 */
export function getCachedLlmParse(
  rawClue: string,
  options: { nowMs?: number; ttlMs?: number; maxEntries?: number } = {}
): LlmParsedClueProposal | null {
  const normalized = rawClue.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  const now = options.nowMs ?? Date.now()
  const ttl = options.ttlMs ?? LLM_PARSE_CACHE_TTL_MS
  const maxEntries = options.maxEntries ?? LLM_PARSE_CACHE_MAX_ENTRIES

  const entry = cache.get(normalized)
  if (!entry) {
    return null
  }
  if (entry.normalizedClue !== normalized) {
    cache.delete(normalized)
    return null
  }
  if (now - entry.insertedAt > ttl) {
    cache.delete(normalized)
    return null
  }

  // LRU 提升：删旧位 + 加新位（Map 保留插入顺序）
  cache.delete(normalized)
  cache.set(normalized, entry)

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
 * 同 clue 命中后会刷新 insertedAt（视为复用）。
 */
export function setCachedLlmParse(
  rawClue: string,
  proposal: LlmParsedClueProposal,
  options: { nowMs?: number; maxEntries?: number } = {}
): void {
  const normalized = rawClue.trim().toLowerCase()
  if (!normalized) {
    return
  }
  const now = options.nowMs ?? Date.now()
  const maxEntries = options.maxEntries ?? LLM_PARSE_CACHE_MAX_ENTRIES

  if (cache.has(normalized)) {
    cache.delete(normalized)
  } else if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }

  cache.set(normalized, {
    normalizedClue: normalized,
    proposal,
    insertedAt: now
  })
}

/** 清空缓存。单测 / 切换 completer / 紧急复位使用。 */
export function clearLlmParseCache(): void {
  cache.clear()
}

/** 当前缓存大小（仅诊断 / 单测）。 */
export function getLlmParseCacheSize(): number {
  return cache.size
}
