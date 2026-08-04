/**
 * Cloud MemoryItem 仓储（Supabase service role）。
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseClient } from '../data-access/supabase'
import { MemoryItemSchema, type MemoryItem } from '../schemas/memory-item'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

/** 数据库行形状。 */
export interface MemoryItemRow {
  id: string
  owner_id: string
  source_local_profile_id: string
  type: string
  payload: Record<string, unknown>
  clues: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  rev: number
}

export function memoryItemToRow(item: MemoryItem, rev = 1): MemoryItemRow {
  return {
    id: item.id,
    owner_id: item.ownerId,
    source_local_profile_id: item.sourceLocalProfileId,
    type: item.type,
    payload: item.payload as Record<string, unknown>,
    clues: item.clues as Record<string, unknown>,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt ?? null,
    rev
  }
}

/**
 * Supabase timestamptz 常为 `…15.57+00:00`（偏移 + 非 3 位小数），
 * Zod 默认 `z.string().datetime()` 不认 → pull/恢复会静默丢光。
 * 统一成 UTC ISO（毫秒 + Z）再入 schema。
 */
function toIsoDateTime(value: string): string {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    throw new Error(`invalid_datetime:${value}`)
  }
  return new Date(ms).toISOString()
}

/** 归一化 clues / payload 内可能来自 DB 的时间字段。 */
function normalizeRowJsonTimestamps(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...value }
  for (const key of ['lastOpenedAt', 'lastDismissedAt', 'chromeCreatedAt'] as const) {
    const raw = next[key]
    if (typeof raw === 'string') {
      next[key] = toIsoDateTime(raw)
    }
  }
  return next
}

export function rowToMemoryItem(row: MemoryItemRow): MemoryItem {
  const parsed = MemoryItemSchema.safeParse({
    id: row.id,
    ownerId: row.owner_id,
    sourceLocalProfileId: row.source_local_profile_id,
    type: row.type,
    payload: normalizeRowJsonTimestamps(row.payload),
    clues: normalizeRowJsonTimestamps(row.clues),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    ...(row.deleted_at != null ? { deletedAt: toIsoDateTime(row.deleted_at) } : {})
  })
  if (!parsed.success) {
    throw new Error(`invalid_memory_row:${row.id}`)
  }
  return parsed.data
}

function requireClient(env: Env): SupabaseClient {
  const client = createSupabaseClient(env)
  if (!client) {
    throw new Error('supabase_not_configured')
  }
  return client
}

/** 统计某账号未软删条数与最新 updated_at。 */
export async function getMemorySyncStatus(
  env: Env,
  ownerId: string
): Promise<{ remoteCount: number; latestUpdatedAt: string | null }> {
  const supabase = requireClient(env)

  const { count, error: countError } = await supabase
    .from('memory_items')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .is('deleted_at', null)

  if (countError) {
    logErrorMessage('[MemorySync] status count 失败', { detail: countError.message, ownerId })
    throw new Error('memory_status_failed')
  }

  const { data: latest, error: latestError } = await supabase
    .from('memory_items')
    .select('updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    logErrorMessage('[MemorySync] status latest 失败', { detail: latestError.message, ownerId })
    throw new Error('memory_status_failed')
  }

  return {
    remoteCount: count ?? 0,
    latestUpdatedAt: latest?.updated_at ?? null
  }
}

/** 拉取某账号 Memory（含软删，便于本机对齐）。可按 updated_at 增量。 */
export async function pullMemoryItems(
  env: Env,
  ownerId: string,
  limit: number,
  options: { since?: string } = {}
): Promise<MemoryItem[]> {
  const supabase = requireClient(env)

  let query = supabase
    .from('memory_items')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (options.since) {
    // 严格大于水位，避免边界重复；水位侧已在上轮写入本机
    query = query.gt('updated_at', options.since)
  }

  const { data, error } = await query

  if (error) {
    logErrorMessage('[MemorySync] pull 失败', { detail: error.message, ownerId })
    throw new Error('memory_pull_failed')
  }

  return (
    (data as MemoryItemRow[] | null)
      ?.map(row => {
        try {
          return rowToMemoryItem(row)
        } catch {
          logErrorMessage('[MemorySync] pull 跳过非法行', { id: row.id, ownerId })
          return null
        }
      })
      .filter((item): item is MemoryItem => item != null) ?? []
  )
}

/** Upsert 批量 MemoryItem（调用方已校验 owner）；自动按批切开。 */
export async function upsertMemoryItems(env: Env, items: MemoryItem[]): Promise<number> {
  if (items.length === 0) {
    return 0
  }

  const supabase = requireClient(env)
  const batchSize = 2000
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize)
    const rows = slice.map(item => memoryItemToRow(item))
    const { error } = await supabase.from('memory_items').upsert(rows, { onConflict: 'id' })
    if (error) {
      logErrorMessage('[MemorySync] upsert 失败', {
        detail: error.message,
        count: slice.length,
        offset: i
      })
      throw new Error('memory_upsert_failed')
    }
  }

  info('[MemorySync] upsert 成功', { count: items.length })
  return items.length
}

/** 备份当前 owner 全集后硬删并写入新集合（整侧替换）。 */
export async function replaceMemoryItems(
  env: Env,
  ownerId: string,
  items: MemoryItem[],
  options: {
    /**
     * 允许写入条数少于云端现有条数（例如退出「先同步再清」刻意用较小本机盖云）。
     * 默认 false：防止误把 454 盖成 5。
     */
    allowDestructiveShrink?: boolean
  } = {}
): Promise<{ backupId: string; written: number }> {
  const supabase = requireClient(env)

  const { data: existing, error: readError } = await supabase
    .from('memory_items')
    .select('*')
    .eq('owner_id', ownerId)

  if (readError) {
    logErrorMessage('[MemorySync] replace 读取失败', { detail: readError.message, ownerId })
    throw new Error('memory_replace_failed')
  }

  const snapshot = existing ?? []
  // 服务端防呆：空本机不得整侧替换非空云端（扩展侧亦有门禁；双层）
  if (items.length === 0 && snapshot.length > 0) {
    info('[MemorySync] replace 拒绝空本机盖云', { ownerId, remoteCount: snapshot.length })
    throw new Error('empty_local_replace_denied')
  }

  // 缩量替换默认拒绝（合并 pull 失败时最常见灾难路径）
  if (!options.allowDestructiveShrink && snapshot.length > 0 && items.length < snapshot.length) {
    info('[MemorySync] replace 拒绝缩量盖云', {
      ownerId,
      remoteCount: snapshot.length,
      incomingCount: items.length
    })
    throw new Error('destructive_shrink_denied')
  }

  const { data: backup, error: backupError } = await supabase
    .from('memory_sync_backups')
    .insert({
      owner_id: ownerId,
      item_count: snapshot.length,
      snapshot
    })
    .select('id')
    .single()

  if (backupError || !backup?.id) {
    logErrorMessage('[MemorySync] replace 备份失败', {
      detail: backupError?.message,
      ownerId
    })
    throw new Error('memory_backup_failed')
  }

  const { error: deleteError } = await supabase
    .from('memory_items')
    .delete()
    .eq('owner_id', ownerId)
  if (deleteError) {
    logErrorMessage('[MemorySync] replace 删除失败', { detail: deleteError.message, ownerId })
    throw new Error('memory_replace_failed')
  }

  if (items.length > 0) {
    await upsertMemoryItems(env, items)
  }

  info('[MemorySync] replace 完成', {
    ownerId,
    backupId: backup.id,
    written: items.length
  })

  return { backupId: backup.id, written: items.length }
}

/**
 * 将某次 sync backup 快照写回 memory_items（先再备份当前库）。
 * 用于误盖云后的自救：优先取 **条数最多** 的备份（同条数取最新），
 * 避免「454→5 后再 replace 一次」时 latest=5 反而救不回。
 */
export async function restoreMemoryItemsFromLatestBackup(
  env: Env,
  ownerId: string
): Promise<{ backupId: string; restored: number; safetyBackupId: string }> {
  const supabase = requireClient(env)

  // 先只读元数据选条数最多的备份，再拉单份 snapshot（避免一次拖多份大 JSON）
  const { data: metaRows, error: readMetaError } = await supabase
    .from('memory_sync_backups')
    .select('id, item_count, created_at')
    .eq('owner_id', ownerId)
    .order('item_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (readMetaError) {
    logErrorMessage('[MemorySync] 读取备份元数据失败', {
      detail: readMetaError.message,
      ownerId
    })
    throw new Error('memory_backup_read_failed')
  }

  const chosenMeta = (metaRows ?? []).find(row => row?.id)
  if (!chosenMeta?.id) {
    throw new Error('memory_backup_not_found')
  }

  const { data: latest, error: readBackupError } = await supabase
    .from('memory_sync_backups')
    .select('id, snapshot, item_count')
    .eq('id', chosenMeta.id)
    .maybeSingle()

  if (readBackupError) {
    logErrorMessage('[MemorySync] 读取备份快照失败', {
      detail: readBackupError.message,
      ownerId,
      backupId: chosenMeta.id
    })
    throw new Error('memory_backup_read_failed')
  }
  if (!latest?.id || !Array.isArray(latest.snapshot)) {
    throw new Error('memory_backup_not_found')
  }

  const restoredItems: MemoryItem[] = []
  let dropped = 0
  let firstDropDetail: string | undefined
  for (const raw of latest.snapshot as unknown[]) {
    try {
      // 备份里可能是行形状或 MemoryItem；两种都试
      if (raw && typeof raw === 'object' && 'owner_id' in raw) {
        restoredItems.push(rowToMemoryItem(raw as MemoryItemRow))
      } else if (raw && typeof raw === 'object') {
        // 领域对象也可能带非标准小数时间戳，先过 row 归一化路径时不可行 → 宽松 parse
        const candidate = raw as Record<string, unknown>
        restoredItems.push(
          MemoryItemSchema.parse({
            ...candidate,
            ...(typeof candidate.createdAt === 'string'
              ? { createdAt: toIsoDateTime(candidate.createdAt) }
              : {}),
            ...(typeof candidate.updatedAt === 'string'
              ? { updatedAt: toIsoDateTime(candidate.updatedAt) }
              : {}),
            ...(typeof candidate.deletedAt === 'string'
              ? { deletedAt: toIsoDateTime(candidate.deletedAt) }
              : {})
          })
        )
      } else {
        throw new Error('invalid_backup_entry')
      }
    } catch (err) {
      dropped += 1
      if (firstDropDetail == null) {
        firstDropDetail = err instanceof Error ? err.message : String(err)
      }
    }
  }

  if (dropped > 0) {
    logErrorMessage('[MemorySync] 备份条目部分无法解析', {
      ownerId,
      dropped,
      kept: restoredItems.length,
      firstDropDetail
    })
  }

  if (restoredItems.length === 0 && (latest.item_count ?? 0) > 0) {
    throw new Error('memory_backup_unreadable')
  }

  // 恢复本身允许「变多」；当前库先经 replace 再写入（replace 会再做一次安全备份）
  const safety = await replaceMemoryItems(env, ownerId, restoredItems, {
    allowDestructiveShrink: true
  })

  info('[MemorySync] 已从备份恢复', {
    ownerId,
    backupId: latest.id,
    restored: restoredItems.length,
    safetyBackupId: safety.backupId
  })

  return {
    backupId: String(latest.id),
    restored: restoredItems.length,
    safetyBackupId: safety.backupId
  }
}

/**
 * 删除该账号云端全部 Memory 与 sync 备份（隐私 P0）。
 * 不可恢复（备份一并删除）；本机 IndexedDB 由扩展侧决定是否保留。
 */
export async function deleteAllCloudMemoryForOwner(
  env: Env,
  ownerId: string
): Promise<{ deletedItems: number; deletedBackups: number }> {
  const supabase = requireClient(env)

  const { count: itemCount, error: countError } = await supabase
    .from('memory_items')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)

  if (countError) {
    logErrorMessage('[MemorySync] 删云端前计数失败', {
      detail: countError.message,
      ownerId
    })
    throw new Error('memory_delete_failed')
  }

  const { count: backupCount, error: backupCountError } = await supabase
    .from('memory_sync_backups')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)

  if (backupCountError) {
    logErrorMessage('[MemorySync] 删备份前计数失败', {
      detail: backupCountError.message,
      ownerId
    })
    throw new Error('memory_delete_failed')
  }

  const { error: deleteItemsError } = await supabase
    .from('memory_items')
    .delete()
    .eq('owner_id', ownerId)
  if (deleteItemsError) {
    logErrorMessage('[MemorySync] 删云端条目失败', {
      detail: deleteItemsError.message,
      ownerId
    })
    throw new Error('memory_delete_failed')
  }

  const { error: deleteBackupsError } = await supabase
    .from('memory_sync_backups')
    .delete()
    .eq('owner_id', ownerId)
  if (deleteBackupsError) {
    logErrorMessage('[MemorySync] 删云端备份失败', {
      detail: deleteBackupsError.message,
      ownerId
    })
    throw new Error('memory_delete_failed')
  }

  const deletedItems = itemCount ?? 0
  const deletedBackups = backupCount ?? 0
  info('[MemorySync] 已删除云端记忆', { ownerId, deletedItems, deletedBackups })
  return { deletedItems, deletedBackups }
}
