/**
 * Recall TTE 事件本机环形缓冲（chrome.storage.local · P0 不上云）。
 */

import { z } from 'zod'

import {
  RecallTelemetryEventSchema,
  type RecallTelemetryEvent
} from '@/core/recall/recall-telemetry'
import { writeChromeStorageLocal } from '@/infrastructure/storage/chrome-storage-local'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export const RECALL_TELEMETRY_LOCAL_KEY = 'yiveno.recallTelemetry'

const MAX_EVENTS = 500

const StoreSchema = z.object({
  events: z.array(RecallTelemetryEventSchema).max(MAX_EVENTS)
})

const LEGACY_TELEMETRY_EVENT_TYPES: Record<string, RecallTelemetryEvent['type']> = {
  query_submitted: 'clue_submitted',
  query_refined: 'clue_refined'
}

/** 读取时把旧版 `query_*` 事件 type 迁移为 `clue_*`。 */
function migrateTelemetryStorePayload(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('events' in raw)) {
    return raw
  }
  const record = raw as { events?: unknown }
  if (!Array.isArray(record.events)) {
    return raw
  }
  return {
    ...record,
    events: record.events.map(event => {
      if (typeof event !== 'object' || event === null || !('type' in event)) {
        return event
      }
      const typed = event as { type: string }
      const mapped = LEGACY_TELEMETRY_EVENT_TYPES[typed.type]
      return mapped ? { ...event, type: mapped } : event
    })
  }
}

async function readTelemetryStore(): Promise<{ events: RecallTelemetryEvent[] }> {
  const result = await chrome.storage.local.get(RECALL_TELEMETRY_LOCAL_KEY)
  const migrated = migrateTelemetryStorePayload(result[RECALL_TELEMETRY_LOCAL_KEY])
  if (migrated === undefined) {
    return { events: [] }
  }
  const parsed = StoreSchema.safeParse(migrated)
  if (!parsed.success) {
    return { events: [] }
  }
  return parsed.data
}

/** 追加一条 TTE 事件（best-effort；失败不抛）。 */
export async function appendRecallTelemetryEvent(event: RecallTelemetryEvent): Promise<void> {
  const startedAt = flowStart('RecallTelemetry', '追加事件', {
    type: event.type,
    taskId: event.taskId
  })
  try {
    const parsed = RecallTelemetryEventSchema.parse(event)
    const existing = await readTelemetryStore()
    const nextEvents = [...existing.events, parsed].slice(-MAX_EVENTS)
    await writeChromeStorageLocal(RECALL_TELEMETRY_LOCAL_KEY, { events: nextEvents })
    flowOk('RecallTelemetry', '追加事件', startedAt, {
      type: parsed.type,
      count: nextEvents.length
    })
  } catch (error) {
    flowFail('RecallTelemetry', '追加事件', startedAt, error)
  }
}

/** Dev：列出本机缓冲事件。 */
export async function listRecallTelemetryEvents(): Promise<RecallTelemetryEvent[]> {
  const store = await readTelemetryStore()
  return store.events
}
