/**
 * Worker Cloud Memory 同步 HTTP 客户端（仅 Background 调用）。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

/**
 * v1：embedding 仅本机；上云前剥离，避免大向量同步与跨端模型不一致。
 * pull 回来的条目若无向量，由本机 Pro 异步回填。
 */
export function stripLocalOnlyClueFieldsForCloud(item: MemoryItem): MemoryItem {
  const {
    embedding: _embedding,
    embeddingModel: _model,
    embeddingDim: _dim,
    ...restClues
  } = item.clues
  return {
    ...item,
    clues: restClues
  }
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

/** 拉取云端（可带 since 做增量）。 */
export async function pullRemoteMemoryItems(
  accessToken: string,
  options: { since?: string } = {}
): Promise<MemoryItem[]> {
  const startedAt = flowStart('MemorySync', 'pull 云端', {
    since: options.since ?? null
  })
  try {
    const data = await memorySyncFetch<{ items: MemoryItem[] }>('/pull', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        ...(options.since ? { since: options.since } : {})
      })
    })
    flowOk('MemorySync', 'pull 云端', startedAt, { count: data.items.length })
    return data.items
  } catch (error) {
    flowFail('MemorySync', 'pull 云端', startedAt, error)
    throw error
  }
}

/** 批量 upsert 到云端（增量上云，非整侧 replace）；自动按 2000 批切开。 */
export async function pushRemoteMemoryItems(
  accessToken: string,
  items: MemoryItem[]
): Promise<{ written: number }> {
  const startedAt = flowStart('MemorySync', 'push 云端', { count: items.length })
  try {
    if (items.length === 0) {
      flowOk('MemorySync', 'push 云端', startedAt, { written: 0 })
      return { written: 0 }
    }

    const batchSize = 2000
    let written = 0
    for (let i = 0; i < items.length; i += batchSize) {
      const slice = items.slice(i, i + batchSize).map(stripLocalOnlyClueFieldsForCloud)
      const data = await memorySyncFetch<{ written: number }>('/push', accessToken, {
        method: 'POST',
        body: JSON.stringify({ items: slice })
      })
      written += data.written
    }
    flowOk('MemorySync', 'push 云端', startedAt, { written })
    return { written }
  } catch (error) {
    flowFail('MemorySync', 'push 云端', startedAt, error)
    throw error
  }
}

/** 用本机全集替换云端。 */
export async function replaceRemoteWithLocalItems(
  accessToken: string,
  items: MemoryItem[],
  options: { allowDestructiveShrink?: boolean } = {}
): Promise<{ backupId: string; written: number }> {
  const startedAt = flowStart('MemorySync', 'replace 云端（本机为准）', {
    count: items.length,
    allowDestructiveShrink: options.allowDestructiveShrink === true
  })
  try {
    const cloudItems = items.map(stripLocalOnlyClueFieldsForCloud)
    const data = await memorySyncFetch<{ backupId: string; written: number }>(
      '/replace',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          items: cloudItems,
          ...(options.allowDestructiveShrink === true ? { allowDestructiveShrink: true } : {})
        })
      }
    )
    flowOk('MemorySync', 'replace 云端（本机为准）', startedAt, data)
    return data
  } catch (error) {
    flowFail('MemorySync', 'replace 云端（本机为准）', startedAt, error)
    throw error
  }
}

export async function deleteRemoteCloudMemory(
  accessToken: string
): Promise<{ deletedItems: number; deletedBackups: number }> {
  const startedAt = flowStart('MemorySync', 'delete-all 云端')
  try {
    const data = await memorySyncFetch<{ deletedItems: number; deletedBackups: number }>(
      '/delete-all',
      accessToken,
      {
        method: 'POST',
        body: '{}'
      }
    )
    flowOk('MemorySync', 'delete-all 云端', startedAt, data)
    return data
  } catch (error) {
    flowFail('MemorySync', 'delete-all 云端', startedAt, error)
    throw error
  }
}

/**
 * 删除账号：Worker 清云端 Memory 并注销 Auth。
 * 响应 shape 与 memory sync 一致（success + data）。
 */
export async function deleteRemoteAccount(
  accessToken: string
): Promise<{ deletedItems: number; deletedBackups: number }> {
  const startedAt = flowStart('Account', 'delete 账号')
  try {
    const url = `${getApiBaseUrl()}/api/account/delete`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`
      },
      body: '{}'
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
      throw new Error('invalid_account_delete_response')
    }

    const data = (body as ApiSuccess<{ deletedItems: number; deletedBackups: number }>).data
    flowOk('Account', 'delete 账号', startedAt, data)
    return data
  } catch (error) {
    flowFail('Account', 'delete 账号', startedAt, error)
    throw error
  }
}

/** 用该账号最近一次 replace 前备份恢复云端。 */
export async function restoreRemoteFromLatestBackup(
  accessToken: string
): Promise<{ backupId: string; restored: number; safetyBackupId: string }> {
  const startedAt = flowStart('MemorySync', 'restore 最近备份')
  try {
    const data = await memorySyncFetch<{
      backupId: string
      restored: number
      safetyBackupId: string
    }>('/restore-latest-backup', accessToken, {
      method: 'POST',
      body: '{}'
    })
    flowOk('MemorySync', 'restore 最近备份', startedAt, data)
    return data
  } catch (error) {
    flowFail('MemorySync', 'restore 最近备份', startedAt, error)
    throw error
  }
}
