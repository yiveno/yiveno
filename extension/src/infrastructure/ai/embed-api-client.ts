/**
 * Worker embedding API 客户端（仅 Background；须登录 Bearer；Worker 日配额分档）。
 *
 * **A2 缓存（2026-10-07 · ADR-007 权衡）：**
 * - 同 accessToken + 同文本指纹在 5min 内复用结果，省一次 Worker embed 网络 IO。
 * - 容量：64 条 LRU；键 = (accessToken 末 16 字符, 文本归一化)。
 * - 内存上限：64 × 1024 floats × 4B ≈ 256KB；可忽略。
 * - 主要受益：Omnibox 每键触发；Side Panel 多轮 + 改 clue 也受益。
 * - 不缓存失败；超时剔除避免雪崩。
 */

import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** 与 Worker `EMBEDDING_MODEL` 对齐。 */
export const WORKER_EMBEDDING_MODEL = '@cf/baai/bge-m3'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

export interface EmbedApiResult {
  model: string
  dim: number
  embeddings: number[][]
}

type EmbedApiEnvelope = {
  success: true
  data: EmbedApiResult
}

function isEmbedApiEnvelope(body: unknown): body is EmbedApiEnvelope {
  if (typeof body !== 'object' || body === null) {
    return false
  }
  if (!('success' in body) || (body as { success: unknown }).success !== true) {
    return false
  }
  if (!('data' in body)) {
    return false
  }
  const data = (body as { data: unknown }).data
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const record = data as Record<string, unknown>
  return (
    typeof record.model === 'string' &&
    typeof record.dim === 'number' &&
    Array.isArray(record.embeddings)
  )
}

/** A2：缓存 TTL（5min）。超出后视同失效。 */
const EMBED_CACHE_TTL_MS = 5 * 60 * 1000

/** A2：缓存容量上限（LRU 简单实现）。 */
const EMBED_CACHE_MAX_ENTRIES = 64

/** A2：单条缓存 = { 文本指纹 → { vector, expiresAt, lastAccessAt } } */
interface EmbedCacheEntry {
  vector: number[]
  expiresAt: number
  lastAccessAt: number
}

/** A2：按 accessToken 后 16 字符隔离缓存。token 切换时自动失效。 */
const embedCacheByToken = new Map<string, Map<string, EmbedCacheEntry>>()

/** A2：取 token 后 16 字符的快速 fingerprint（避免长期持有 token 字符串）。 */
function tokenKey(token: string): string {
  return token.length > 16 ? token.slice(-16) : token
}

/** A2：缓存命中则更新 LRU 顺序。 */
function getCachedEmbedding(tokenFingerprint: string, normalizedText: string): number[] | null {
  const tokenMap = embedCacheByToken.get(tokenFingerprint)
  if (!tokenMap) {
    return null
  }
  const entry = tokenMap.get(normalizedText)
  if (!entry) {
    return null
  }
  if (entry.expiresAt < Date.now()) {
    tokenMap.delete(normalizedText)
    return null
  }
  entry.lastAccessAt = Date.now()
  // LRU：删除后重插，让 Map 顺序反映最近使用
  tokenMap.delete(normalizedText)
  tokenMap.set(normalizedText, entry)
  return entry.vector
}

/** A2：写入缓存；超过容量上限时按 LRU 淘汰最久未访问条目。 */
function setCachedEmbedding(
  tokenFingerprint: string,
  normalizedText: string,
  vector: number[]
): void {
  let tokenMap = embedCacheByToken.get(tokenFingerprint)
  if (!tokenMap) {
    tokenMap = new Map()
    embedCacheByToken.set(tokenFingerprint, tokenMap)
  }
  // 容量控制：先删旧条目再写新条目
  if (tokenMap.size >= EMBED_CACHE_MAX_ENTRIES) {
    const oldest = tokenMap.keys().next().value
    if (oldest !== undefined) {
      tokenMap.delete(oldest)
    }
  }
  tokenMap.set(normalizedText, {
    vector,
    expiresAt: Date.now() + EMBED_CACHE_TTL_MS,
    lastAccessAt: Date.now()
  })
}

/** A2：测试用：清空缓存。 */
export function clearEmbedCacheForTests(): void {
  embedCacheByToken.clear()
}

/**
 * POST /api/ai/embed — 批量向量；须登录（Free/Pro 日配额分档）。
 *
 * **A2 行为：**
 * - 全缓存命中：直接返回，零网络 IO。
 * - 部分命中：仅 fetch 未命中条目；结果按原始顺序与缓存合并。
 * - 全 miss：发起网络请求，逐条写入缓存。
 * - 缓存失败：抛错给调用方决定（失败响应不写入）。
 */
export async function requestWorkerEmbeddings(
  accessToken: string,
  texts: string[]
): Promise<EmbedApiResult> {
  const tokenFingerprint = tokenKey(accessToken)
  // A2：分项查缓存，构建 miss 列表
  const cachedVectors: (number[] | null)[] = texts.map(text =>
    getCachedEmbedding(tokenFingerprint, text.trim().toLowerCase())
  )
  const cacheHitCount = cachedVectors.filter(v => v !== null).length
  const allCached = cacheHitCount === texts.length

  if (allCached) {
    flowOk('Embed', 'Worker embed 请求（cache hit）', Date.now(), {
      count: texts.length,
      cacheHit: cacheHitCount
    })
    return {
      model: WORKER_EMBEDDING_MODEL,
      dim: cachedVectors[0]!.length,
      embeddings: cachedVectors as number[][]
    }
  }

  // A2：部分命中或全 miss → 仅 fetch 未命中条目
  const missIndexes: number[] = []
  const missTexts: string[] = []
  texts.forEach((text, index) => {
    if (cachedVectors[index] === null) {
      missIndexes.push(index)
      missTexts.push(text)
    }
  })

  const startedAt = flowStart('Embed', 'Worker embed 请求', {
    count: texts.length,
    cacheHit: cacheHitCount,
    fetchCount: missTexts.length
  })
  try {
    const url = `${getApiBaseUrl()}/api/ai/embed`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ texts: missTexts })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const errorCode =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `http_${response.status}`
      throw new Error(errorCode)
    }
    if (!isEmbedApiEnvelope(body)) {
      throw new Error('invalid_embed_response')
    }

    // A2：写入缓存 + 按原顺序填回结果
    const merged: number[][] = cachedVectors.map(v => v ?? [])
    body.data.embeddings.forEach((vector, missIndex) => {
      const originalIndex = missIndexes[missIndex]
      const originalText = missTexts[missIndex]
      if (
        originalIndex !== undefined &&
        originalText &&
        Array.isArray(vector) &&
        vector.length > 0
      ) {
        setCachedEmbedding(tokenFingerprint, originalText.trim().toLowerCase(), vector)
        merged[originalIndex] = vector
      }
    })

    // 校验：合并结果维度一致
    const dim = merged[0]?.length ?? body.data.dim
    flowOk('Embed', 'Worker embed 请求', startedAt, {
      count: merged.length,
      dim,
      cacheHit: cacheHitCount,
      fetchCount: missTexts.length
    })
    return {
      model: body.data.model,
      dim,
      embeddings: merged
    }
  } catch (error) {
    flowFail('Embed', 'Worker embed 请求', startedAt, error)
    throw error
  }
}
