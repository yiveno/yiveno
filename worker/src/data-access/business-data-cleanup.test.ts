import { describe, expect, test } from 'bun:test'

import { pruneMemorySyncBackups, resolveCleanupRetentionConfig } from './business-data-cleanup'
import type { Env } from '../types/env'

function createBackupQuery(rows: unknown[]) {
  return {
    select() {
      return this
    },
    order() {
      return this
    },
    range() {
      return Promise.resolve({ data: rows, error: null })
    }
  }
}

describe('business-data-cleanup', () => {
  test('resolveCleanupRetentionConfig 使用默认值', () => {
    const config = resolveCleanupRetentionConfig({} as Env)
    expect(config).toEqual({
      backupKeepPerOwner: 5,
      softDeleteRetentionDays: 180
    })
  })

  test('pruneMemorySyncBackups 仅删除超出 owner 保留上限的备份', async () => {
    const deletedBatches: string[][] = []
    const rows = [
      { id: 'a3', owner_id: 'owner-a', created_at: '2026-08-05T03:00:00.000Z' },
      { id: 'a2', owner_id: 'owner-a', created_at: '2026-08-04T03:00:00.000Z' },
      { id: 'a1', owner_id: 'owner-a', created_at: '2026-08-03T03:00:00.000Z' },
      { id: 'b2', owner_id: 'owner-b', created_at: '2026-08-05T02:00:00.000Z' },
      { id: 'b1', owner_id: 'owner-b', created_at: '2026-08-04T02:00:00.000Z' }
    ]

    const client = {
      from(table: string) {
        if (table === 'memory_sync_backups') {
          return {
            ...createBackupQuery(rows),
            delete() {
              return {
                in(_column: string, ids: string[]) {
                  deletedBatches.push(ids)
                  return Promise.resolve({ error: null })
                }
              }
            }
          }
        }
        throw new Error(`unexpected table: ${table}`)
      }
    }

    const deleted = await pruneMemorySyncBackups(client as never, 2)
    expect(deleted).toBe(1)
    expect(deletedBatches).toEqual([['a1']])
  })
})
