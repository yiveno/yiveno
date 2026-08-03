/**
 * Worker Cloud Memory 同步 HTTP 客户端（仅 Background 调用）。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

interface SyncStatusData {
  remoteCount: number
  latestUpdatedAt: string | null
}

interface ApiSuccess<T> {
  success: true
  data: T
}

async function memorySyncFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const url = `${getApiBaseUrl()}/api/memory/sync${path}`
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
    throw new Error('invalid_sync_response')
  }

  return (body as ApiSuccess<T>).data
}

/** 查询云端计数。 */
export async function fetchRemoteSyncStatus(accessToken: string): Promise<SyncStatusData> {
  const startedAt = flowStart('MemorySync', '查询云端 status')
  try {
    const data = await memorySyncFetch<SyncStatusData>('/status', accessToken, {
      method: 'GET'
    })
    flowOk('MemorySync', '查询云端 status', startedAt, {
      remoteCount: data.remoteCount
    })
    return data
  } catch (error) {
    flowFail('MemorySync', '查询云端 status', startedAt, error)
    throw error
  }
}

/** 全量拉取。 */
export async function pullRemoteMemoryItems(accessToken: string): Promise<MemoryItem[]> {
  const startedAt = flowStart('MemorySync', 'pull 云端')
  try {
    const data = await memorySyncFetch<{ items: MemoryItem[] }>('/pull', accessToken, {
      method: 'POST',
      body: '{}'
    })
    flowOk('MemorySync', 'pull 云端', startedAt, { count: data.items.length })
    return data.items
  } catch (error) {
    flowFail('MemorySync', 'pull 云端', startedAt, error)
    throw error
  }
}

/** 用本机全集替换云端。 */
export async function replaceRemoteWithLocalItems(
  accessToken: string,
  items: MemoryItem[]
): Promise<{ backupId: string; written: number }> {
  const startedAt = flowStart('MemorySync', 'replace 云端（本机为准）', {
    count: items.length
  })
  try {
    const data = await memorySyncFetch<{ backupId: string; written: number }>(
      '/replace',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ items })
      }
    )
    flowOk('MemorySync', 'replace 云端（本机为准）', startedAt, data)
    return data
  } catch (error) {
    flowFail('MemorySync', 'replace 云端（本机为准）', startedAt, error)
    throw error
  }
}
