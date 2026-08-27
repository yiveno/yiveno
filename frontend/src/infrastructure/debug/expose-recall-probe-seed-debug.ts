/**
 * DEV：Service Worker 全局挂载召回探针 seeder，便于 MCP / SW console 调用。
 * 仅 import.meta.env.DEV。
 *
 * 用法（Side Panel evaluate 发消息，或 SW 控制台）：
 *   await yiveno.seedRecallProbe({ replace: true, personas: ['researcher','creator','developer'] })
 */

import {
  parseSeedRecallProbePayload,
  type SeedRecallProbePayload
} from '@/core/messaging/debug-messages'
import { seedRecallProbeCorpus } from '@/infrastructure/debug/recall-probe-seed-service'

type ProbeDebugHost = {
  yiveno?: {
    seedRecallProbe?: (
      payload?: Partial<SeedRecallProbePayload>
    ) => Promise<Awaited<ReturnType<typeof seedRecallProbeCorpus>>>
  }
}

/** 仅开发构建：挂到 Service Worker globalThis。 */
export function exposeRecallProbeSeedDebug(): void {
  if (!import.meta.env.DEV) {
    return
  }

  const host = globalThis as typeof globalThis & ProbeDebugHost
  host.yiveno = {
    ...(host.yiveno ?? {}),
    seedRecallProbe: async (payload?: Partial<SeedRecallProbePayload>) => {
      const parsed = parseSeedRecallProbePayload(payload ?? {})
      return seedRecallProbeCorpus(parsed)
    }
  }
  console.info('[yiveno] DEV：SW 可用 yiveno.seedRecallProbe({ replace: true }) 种召回探针语料')
}
