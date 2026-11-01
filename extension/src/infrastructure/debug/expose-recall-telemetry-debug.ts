/**
 * DEV：Service Worker 全局挂载 TTE / 可见进展遥测读取，便于 DevTools / MCP 自检。
 * 仅 import.meta.env.DEV。
 *
 * 用法（SW 控制台或经消息桥）：
 *   await yiveno.listRecallTelemetryEvents()
 *   await yiveno.summarizeVisibleProgressTelemetry()
 *
 * 总索引：docs/engineering/DEV-调试API.md
 */

import type { RecallTelemetryEvent } from '@/core/recall/recall-telemetry'
import {
  summarizeVisibleProgressTelemetry,
  type VisibleProgressTelemetrySummary
} from '@/core/recall/summarize-visible-progress-telemetry'
import { listRecallTelemetryEvents } from '@/infrastructure/analytics/recall-telemetry-store'

type TelemetryDebugHost = {
  yiveno?: {
    listRecallTelemetryEvents?: () => Promise<RecallTelemetryEvent[]>
    summarizeVisibleProgressTelemetry?: () => Promise<VisibleProgressTelemetrySummary>
  }
}

/** 仅开发构建：挂到 Service Worker globalThis。 */
export function exposeRecallTelemetryDebug(): void {
  if (!import.meta.env.DEV) {
    return
  }

  const host = globalThis as typeof globalThis & TelemetryDebugHost
  host.yiveno = {
    ...(host.yiveno ?? {}),
    listRecallTelemetryEvents,
    summarizeVisibleProgressTelemetry: async () => {
      const events = await listRecallTelemetryEvents()
      return summarizeVisibleProgressTelemetry(events)
    }
  }
  console.info(
    '[yiveno] DEV：SW 可用 yiveno.listRecallTelemetryEvents() / yiveno.summarizeVisibleProgressTelemetry()'
  )
}
