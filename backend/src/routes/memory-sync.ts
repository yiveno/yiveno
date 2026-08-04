/**
 * Memory 云同步路由（Phase C 铺路）。
 * 鉴权：Supabase access token；数据面经 service role。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import {
  getMemorySyncStatus,
  pullMemoryItems,
  replaceMemoryItems,
  upsertMemoryItems
} from '../data-access/memory-items'
import { supabaseAuth } from '../middleware/supabase-auth'
import {
  MEMORY_SYNC_BATCH_MAX,
  MEMORY_SYNC_PULL_MAX,
  MemoryItemSchema,
  type MemoryItem
} from '../schemas/memory-item'
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

const PushBodySchema = z.object({
  items: z.array(MemoryItemSchema).max(MEMORY_SYNC_BATCH_MAX)
})

const ReplaceBodySchema = z.object({
  items: z.array(MemoryItemSchema).max(MEMORY_SYNC_PULL_MAX)
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

/** POST /api/memory/sync/pull — MVP 全量拉取 */
memorySyncRouter.post('/pull', async c => {
  const userId = c.get('supabaseUserId')
  try {
    const items = await pullMemoryItems(c.env, userId, MEMORY_SYNC_PULL_MAX)
    info('[MemorySync] pull', { userId, count: items.length })
    return c.json({ success: true, data: { items } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[MemorySync] pull 异常', { detail: msg, userId })
    return c.json({ error: msg === 'supabase_not_configured' ? msg : 'memory_pull_failed' }, 500)
  }
})

/** POST /api/memory/sync/push — 批量 upsert */
memorySyncRouter.post('/push', async c => {
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
    const result = await replaceMemoryItems(c.env, userId, items)
    return c.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'empty_local_replace_denied') {
      return c.json({ error: 'empty_local_replace_denied' }, 409)
    }
    logErrorMessage('[MemorySync] replace 异常', { detail: msg, userId })
    const code =
      msg === 'supabase_not_configured' || msg === 'memory_backup_failed'
        ? msg
        : 'memory_replace_failed'
    return c.json({ error: code }, 500)
  }
})
