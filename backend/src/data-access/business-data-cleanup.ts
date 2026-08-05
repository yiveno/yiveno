import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseClient } from './supabase'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

type CleanupClient = Pick<SupabaseClient, 'from'>

export type CleanupRetentionConfig = {
  backupKeepPerOwner: number
  softDeleteRetentionDays: number
}

export type CleanupRunResult = {
  deletedBackupRows: number
  deletedPaymentRecordRows: number
  deletedSubscriptionRows: number
}

type BackupRowMeta = {
  id: string
  owner_id: string
  created_at: string
}

const DEFAULT_BACKUP_KEEP_PER_OWNER = 5
const DEFAULT_SOFT_DELETE_RETENTION_DAYS = 180
const BACKUP_PAGE_SIZE = 1000
const DELETE_BATCH_SIZE = 500

function requireClient(env: Env): CleanupClient {
  const client = createSupabaseClient(env)
  if (!client) {
    throw new Error('supabase_not_configured')
  }
  return client
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallback: number,
  fieldName: string
): number {
  if (!rawValue) {
    return fallback
  }
  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid_cleanup_config:${fieldName}`)
  }
  return parsed
}

/** 从环境变量读取清理保留策略。 */
export function resolveCleanupRetentionConfig(env: Env): CleanupRetentionConfig {
  return {
    backupKeepPerOwner: parsePositiveInteger(
      env.CLEANUP_MEMORY_SYNC_BACKUPS_KEEP,
      DEFAULT_BACKUP_KEEP_PER_OWNER,
      'CLEANUP_MEMORY_SYNC_BACKUPS_KEEP'
    ),
    softDeleteRetentionDays: parsePositiveInteger(
      env.CLEANUP_SOFT_DELETE_RETENTION_DAYS,
      DEFAULT_SOFT_DELETE_RETENTION_DAYS,
      'CLEANUP_SOFT_DELETE_RETENTION_DAYS'
    )
  }
}

async function deleteIdsInBatches(
  table: string,
  ids: string[],
  client: CleanupClient
): Promise<number> {
  let deleted = 0
  for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
    const batch = ids.slice(index, index + DELETE_BATCH_SIZE)
    const { error } = await client.from(table).delete().in('id', batch)
    if (error) {
      logErrorMessage('[Cleanup] 批量删除失败', {
        table,
        detail: error.message,
        batchSize: batch.length,
        offset: index
      })
      throw new Error('business_cleanup_failed')
    }
    deleted += batch.length
  }
  return deleted
}

/** 备份表按 owner 仅保留最近 N 条。 */
export async function pruneMemorySyncBackups(
  client: CleanupClient,
  keepPerOwner: number
): Promise<number> {
  const deleteIds: string[] = []
  const seenPerOwner = new Map<string, number>()
  let page = 0

  while (true) {
    const from = page * BACKUP_PAGE_SIZE
    const to = from + BACKUP_PAGE_SIZE - 1
    const { data, error } = await client
      .from('memory_sync_backups')
      .select('id, owner_id, created_at')
      .order('owner_id', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) {
      logErrorMessage('[Cleanup] 读取备份元数据失败', {
        detail: error.message,
        from,
        to
      })
      throw new Error('business_cleanup_failed')
    }

    const rows = (data ?? []) as BackupRowMeta[]
    if (rows.length === 0) {
      break
    }

    for (const row of rows) {
      const seen = seenPerOwner.get(row.owner_id) ?? 0
      if (seen >= keepPerOwner) {
        deleteIds.push(row.id)
        continue
      }
      seenPerOwner.set(row.owner_id, seen + 1)
    }

    if (rows.length < BACKUP_PAGE_SIZE) {
      break
    }
    page += 1
  }

  if (deleteIds.length === 0) {
    return 0
  }
  return deleteIdsInBatches('memory_sync_backups', deleteIds, client)
}

/** 清理 payment_records 软删历史。 */
export async function pruneSoftDeletedPaymentRecords(
  client: CleanupClient,
  retentionDays: number
): Promise<number> {
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('payment_records')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', threshold)
    .select('id')

  if (error) {
    logErrorMessage('[Cleanup] 清理 payment_records 失败', {
      detail: error.message,
      threshold
    })
    throw new Error('business_cleanup_failed')
  }

  return Array.isArray(data) ? data.length : 0
}

/** 清理 subscriptions 软删历史。 */
export async function pruneSoftDeletedSubscriptions(
  client: CleanupClient,
  retentionDays: number
): Promise<number> {
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('subscriptions')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', threshold)
    .select('id')

  if (error) {
    logErrorMessage('[Cleanup] 清理 subscriptions 失败', {
      detail: error.message,
      threshold
    })
    throw new Error('business_cleanup_failed')
  }

  return Array.isArray(data) ? data.length : 0
}

/** 执行一次业务冗余数据清理。 */
export async function runBusinessDataCleanup(env: Env): Promise<CleanupRunResult> {
  const client = requireClient(env)
  const config = resolveCleanupRetentionConfig(env)

  info('[Cleanup] 业务数据定时清理开始', {
    backupKeepPerOwner: config.backupKeepPerOwner,
    softDeleteRetentionDays: config.softDeleteRetentionDays
  })

  const deletedBackupRows = await pruneMemorySyncBackups(client, config.backupKeepPerOwner)
  const deletedPaymentRecordRows = await pruneSoftDeletedPaymentRecords(
    client,
    config.softDeleteRetentionDays
  )
  const deletedSubscriptionRows = await pruneSoftDeletedSubscriptions(
    client,
    config.softDeleteRetentionDays
  )

  const result = {
    deletedBackupRows,
    deletedPaymentRecordRows,
    deletedSubscriptionRows
  }

  info('[Cleanup] 业务数据定时清理完成', result)
  return result
}
