/**
 * Recall TTE 事件本机环形缓冲（chrome.storage.local · P0 不上云）。
 */

import { z } from 'zod'

import {
  RecallTelemetryEventSchema,
  type RecallTelemetryEvent
} from '@/core/recall/recall-telemetry'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export const RECALL_TELEMETRY_LOCAL_KEY = 'yiveno.recallTelemetry'

const MAX_EVENTS = 500

const StoreSchema = z.object({
  events: z.array(RecallTelemetryEventSchema).max(MAX_EVENTS)
})

/** 追加一条 TTE 事件（best-effort；失败不抛）。 */
export async function appendRecallTelemetryEvent(event: RecallTelemetryEvent): Promise<void> {
  const startedAt = flowStart('RecallTelemetry', '追加事件', {
    type: event.type,
    taskId: event.taskId
  })
  try {
    const parsed = RecallTelemetryEventSchema.parse(event)
    const existing = (await readChromeStorageLocal(RECALL_TELEMETRY_LOCAL_KEY, StoreSchema)) ?? {
      events: []
    }
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
