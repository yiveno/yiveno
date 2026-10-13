/**
 * DEV：导出暗线匿名汇总草图（双线程观测口子）。
 * 仅 import.meta.env.DEV。
 *
 * 用法：
 *   await yiveno.exportDualThreadAggregateSketch()
 *
 * 总索引：docs/engineering/DEV-调试API.md
 * 权威：docs/engineering/暗线基建-失败归因与受控适应.md
 */

import {
  assessKnownGoldRecallGap,
  buildDualThreadAggregateSketch,
  type DualThreadAggregateSketch,
  type KnownGoldRecallGapInput,
  type KnownGoldRecallGapResult
} from '@/core/recall/dual-thread'
import { listRecallTelemetryEvents } from '@/infrastructure/analytics/recall-telemetry-store'

type DualThreadDebugHost = {
  yiveno?: {
    exportDualThreadAggregateSketch?: () => Promise<DualThreadAggregateSketch>
    assessKnownGoldRecallGap?: (input: KnownGoldRecallGapInput) => KnownGoldRecallGapResult
  }
}

/** 仅开发构建：挂到 Service Worker globalThis。 */
export function exposeDualThreadDebug(): void {
  if (!import.meta.env.DEV) {
    return
  }

  const host = globalThis as typeof globalThis & DualThreadDebugHost
  host.yiveno = {
    ...(host.yiveno ?? {}),
    async exportDualThreadAggregateSketch() {
      const events = await listRecallTelemetryEvents()
      return buildDualThreadAggregateSketch({ events })
    },
    assessKnownGoldRecallGap
  }
  console.info(
    '[yiveno] DEV：SW 可用 yiveno.exportDualThreadAggregateSketch() / yiveno.assessKnownGoldRecallGap()'
  )
}
