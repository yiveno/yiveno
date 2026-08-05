/**
 * Memory 云同步路由（Phase C 铺路）。
 * 鉴权：Supabase access token；数据面经 service role。
 * 写/拉路径另需有效 Pro；status / delete-all（隐私删云）仅需登录。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import {
  getMemorySyncStatus,
  pullMemoryItems,
  replaceMemoryItems,
  restoreMemoryItemsFromLatestBackup,
  deleteAllCloudMemoryForOwner,
  upsertMemoryItems
} from '../data-access/memory-items'
import { supabaseAuth } from '../middleware/supabase-auth'
import {
  MEMORY_SYNC_BATCH_MAX,
  MEMORY_SYNC_PULL_MAX,
  MemoryItemSchema,
  type MemoryItem
} from '../schemas/memory-item'
import { denyUnlessActivePro } from '../services/memory/require-pro-for-sync'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

type SyncVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
  }
}

export const memorySyncRouter = new Hono<SyncVars>()

memorySyncRouter.use('*', supabaseAuth())

/** pull / push / replace / restore 须有效 Pro。 */
async function requireProForSync(c: {
  env: Env
  get: (key: 'supabaseUserId') => string
  json: (body: unknown, status?: number) => Response
}): Promise<Response | null> {
  const userId = c.get('supabaseUserId')
  const denied = await denyUnlessActivePro(c.env, userId)
  if (denied) {
    info('[MemorySync] 拒绝非 Pro', { userId })
    return c.json(denied, 403)
  }
  return null
}

const PushBodySchema = z.object({
  items: z.array(MemoryItemSchema).max(MEMORY_SYNC_BATCH_MAX)
})

const ReplaceBodySchema = z.object({
  items: z.array(MemoryItemSchema).max(MEMORY_SYNC_PULL_MAX),
  /** 允许写入条数少于云端现有（仅显式危险路径） */
  allowDestructiveShrink: z.boolean().optional()
})

/** 拒绝非本人 ownerId 的条目。 */
function assertOwnerItems(userId: string, items: MemoryItem[]): MemoryItem[] | null {
  for (const item of items) {
    if (item.ownerId !== userId) {
      return null
    }
  }
  return items
}

/** GET /api/memory/sync/status */
memorySyncRouter.get('/status', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const status = await getMemorySyncStatus(c.env, userId)
    info('[MemorySync] status', { userId, remoteCount: status.remoteCount })
    return c.json({ success: true, data: status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[MemorySync] status 异常', { detail: msg, userId })
    return c.json({ error: msg === 'supabase_not_configured' ? msg : 'memory_status_failed' }, 500)
  }
})

/** POST /api/memory/sync/pull — MVP 全量或按 updated_at 增量拉取 */
memorySyncRouter.post('/pull', async c => {
  const denied = await requireProForSync(c)
  if (denied) return denied

  const userId = c.get('supabaseUserId')
  let body: unknown = {}
  try {
    const raw = await c.req.json()
    body = raw
  } catch {
    body = {}
  }

  const PullBodySchema = z.object({
    /** 仅拉取 updated_at 严格大于该 ISO 时间的条目（含软删翻新） */
    since: z.string().datetime().optional()
  })
  const parsed = PullBodySchema.safeParse(body ?? {})
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400)
  }

  try {
    const items = await pullMemoryItems(c.env, userId, MEMORY_SYNC_PULL_MAX, {
      ...(parsed.data.since ? { since: parsed.data.since } : {})
    })
    info('[MemorySync] pull', {
      userId,
      count: items.length,
      since: parsed.data.since ?? null
    })
    return c.json({ success: true, data: { items } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[MemorySync] pull 异常', { detail: msg, userId })
    return c.json({ error: msg === 'supabase_not_configured' ? msg : 'memory_pull_failed' }, 500)
  }
})

/** POST /api/memory/sync/push — 批量 upsert */
memorySyncRouter.post('/push', async c => {
  const denied = await requireProForSync(c)
  if (denied) return denied

  const userId = c.get('supabaseUserId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const parsed = PushBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400)
  }

  const items = assertOwnerItems(userId, parsed.data.items)
  if (!items) {
    return c.json({ error: 'owner_mismatch' }, 403)
  }

  try {
    const written = await upsertMemoryItems(c.env, items)
    return c.json({ success: true, data: { written } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[MemorySync] push 异常', { detail: msg, userId })
    return c.json({ error: msg === 'supabase_not_configured' ? msg : 'memory_upsert_failed' }, 500)
  }
})

/**
 * POST /api/memory/sync/replace
 * 备份后用请求体全集替换云端（支撑本机覆盖云端）。
 */
memorySyncRouter.post('/replace', async c => {
  const denied = await requireProForSync(c)
  if (denied) return denied

  const userId = c.get('supabaseUserId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const parsed = ReplaceBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400)
  }

  const items = assertOwnerItems(userId, parsed.data.items)
  if (!items) {
    return c.json({ error: 'owner_mismatch' }, 403)
  }

  try {
    const result = await replaceMemoryItems(c.env, userId, items, {
      ...(parsed.data.allowDestructiveShrink === true ? { allowDestructiveShrink: true } : {})
    })
    return c.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'empty_local_replace_denied' || msg === 'destructive_shrink_denied') {
      return c.json({ error: msg }, 409)
    }
    logErrorMessage('[MemorySync] replace 异常', { detail: msg, userId })
    const code =
      msg === 'supabase_not_configured' || msg === 'memory_backup_failed'
        ? msg
        : 'memory_replace_failed'
    return c.json({ error: code }, 500)
  }
})

/**
 * POST /api/memory/sync/restore-latest-backup
 * 用该账号最近一次 replace 前备份覆盖云端（误盖云自救）。
 */
memorySyncRouter.post('/restore-latest-backup', async c => {
  const denied = await requireProForSync(c)
  if (denied) return denied

  const userId = c.get('supabaseUserId')
  try {
    const result = await restoreMemoryItemsFromLatestBackup(c.env, userId)
    return c.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg === 'memory_backup_not_found' ||
      msg === 'memory_backup_unreadable' ||
      msg === 'memory_backup_read_failed'
    ) {
      return c.json({ error: msg }, 404)
    }
    logErrorMessage('[MemorySync] restore backup 异常', { detail: msg, userId })
    return c.json({ error: msg === 'supabase_not_configured' ? msg : 'memory_restore_failed' }, 500)
  }
})

/**
 * POST /api/memory/sync/delete-all
 * 删除该账号云端 Memory 与 sync 备份（隐私 P0；不可恢复）。
 */
memorySyncRouter.post('/delete-all', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const result = await deleteAllCloudMemoryForOwner(c.env, userId)
    return c.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[MemorySync] delete-all 异常', { detail: msg, userId })
    return c.json({ error: msg === 'supabase_not_configured' ? msg : 'memory_delete_failed' }, 500)
  }
})
