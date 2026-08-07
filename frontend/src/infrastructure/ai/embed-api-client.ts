/**
 * Worker embedding API 客户端（仅 Background；须登录 Bearer；Worker 日配额分档）。
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

/**
 * POST /api/ai/embed — 批量向量；须登录（Free/Pro 日配额分档）。
 */
export async function requestWorkerEmbeddings(
  accessToken: string,
  texts: string[]
): Promise<EmbedApiResult> {
  const startedAt = flowStart('Embed', 'Worker embed 请求', { count: texts.length })
  try {
    const url = `${getApiBaseUrl()}/api/ai/embed`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ texts })
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
    flowOk('Embed', 'Worker embed 请求', startedAt, {
      count: body.data.embeddings.length,
      dim: body.data.dim
    })
    return body.data
  } catch (error) {
    flowFail('Embed', 'Worker embed 请求', startedAt, error)
    throw error
  }
}
