/**
 * 暗线研究接收端 HTTP 客户端（仅 Background 调用 · ADR-027）。
 */

import type { DualThreadAggregateSketch } from '@/core/recall/dual-thread/dual-thread-aggregate'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

interface ApiSuccess<T> {
  success: true
  data: T
}

async function researchFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}/api/research${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    }
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

  if (
    typeof body !== 'object' ||
    body === null ||
    !('success' in body) ||
    (body as { success: unknown }).success !== true ||
    !('data' in body)
  ) {
    throw new Error('invalid_research_response')
  }

  return (body as ApiSuccess<T>).data
}

/** POST 匿名草图（当天 upsert）。 */
export async function postDualThreadResearchSketch(
  accessToken: string,
  sketch: DualThreadAggregateSketch
): Promise<{ sketchDate: string }> {
  const startedAt = flowStart('DualThread', '上传匿名汇总草图')
  try {
    const data = await researchFetch<{ sketchDate: string }>('/sketch', accessToken, {
      method: 'POST',
      body: JSON.stringify(sketch)
    })
    flowOk('DualThread', '上传匿名汇总草图', startedAt, { sketchDate: data.sketchDate })
    return data
  } catch (error) {
    flowFail('DualThread', '上传匿名汇总草图', startedAt, error)
    throw error
  }
}

/** DELETE 该用户全部已贡献草图。 */
export async function deleteDualThreadResearchSketches(
  accessToken: string
): Promise<{ deletedCount: number }> {
  const startedAt = flowStart('DualThread', '删除已贡献汇总')
  try {
    const data = await researchFetch<{ deletedCount: number }>('/sketch', accessToken, {
      method: 'DELETE'
    })
    flowOk('DualThread', '删除已贡献汇总', startedAt, { deletedCount: data.deletedCount })
    return data
  } catch (error) {
    flowFail('DualThread', '删除已贡献汇总', startedAt, error)
    throw error
  }
}
