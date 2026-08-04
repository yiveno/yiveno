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

export function rowToMemoryItem(row: MemoryItemRow): MemoryItem {
  const parsed = MemoryItemSchema.safeParse({
    id: row.id,
    ownerId: row.owner_id,
    sourceLocalProfileId: row.source_local_profile_id,
    type: row.type,
    payload: row.payload,
    clues: row.clues,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.deleted_at != null ? { deletedAt: row.deleted_at } : {})
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

/** 拉取某账号全部 Memory（含软删，便于本机对齐）。 */
export async function pullMemoryItems(
  env: Env,
  ownerId: string,
  limit: number
): Promise<MemoryItem[]> {
  const supabase = requireClient(env)

  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(limit)

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
  items: MemoryItem[]
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
