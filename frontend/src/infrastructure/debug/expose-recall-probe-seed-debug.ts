/**
 * DEV：Service Worker 全局挂载召回探针 seeder，便于 MCP / SW console 调用。
 * 仅 import.meta.env.DEV。
 *
 * 用法（Side Panel evaluate 发消息，或 SW 控制台）：
 *   await yiveno.seedRecallProbe({ replace: true, personas: ['researcher','creator','developer'] })
 *
 * 总索引：docs/engineering/DEV-调试API.md
 */

import {
  parseSeedRecallProbePayload,
  type SeedRecallProbePayload
} from '@/core/messaging/debug-messages'
import {
  PROBE_OMNIBOX_COPY_PASTE_LINES,
  runProbeOmniboxSmoke
} from '@/infrastructure/debug/recall-probe-omnibox-smoke'
import { purgeProbeNoiseFromLibrary } from '@/infrastructure/debug/recall-probe-purge-service'
import { seedRecallProbeCorpus } from '@/infrastructure/debug/recall-probe-seed-service'

type ProbeDebugHost = {
  yiveno?: {
    seedRecallProbe?: (
      payload?: Partial<SeedRecallProbePayload>
    ) => Promise<Awaited<ReturnType<typeof seedRecallProbeCorpus>>>
    purgeProbeNoise?: () => Promise<Awaited<ReturnType<typeof purgeProbeNoiseFromLibrary>>>
    runProbeOmniboxSmoke?: () => Promise<Awaited<ReturnType<typeof runProbeOmniboxSmoke>>>
    /** 手测文档 §4 复制块（含 `yi ` 前缀） */
    probeOmniboxCopyPaste?: readonly string[]
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
      const result = await seedRecallProbeCorpus(parsed)
      console.info('[yiveno] 探针种库完成', result)
      console.info(
        '[yiveno] Omnibox 手测复制块（逐行粘贴到地址栏）：\n' +
          PROBE_OMNIBOX_COPY_PASTE_LINES.join('\n')
      )
      console.info('[yiveno] 种库后验冒烟：await yiveno.runProbeOmniboxSmoke()')
      return result
    },
    purgeProbeNoise: async () => {
      const result = await purgeProbeNoiseFromLibrary()
      console.info('[yiveno] 探针噪声层已清除', result)
      return result
    },
    runProbeOmniboxSmoke: async () => {
      const report = await runProbeOmniboxSmoke()
      if (report.failed.length === 0) {
        console.info('[yiveno] Omnibox 探针冒烟通过', {
          passed: report.passed,
          total: report.total
        })
      } else {
        console.warn('[yiveno] Omnibox 探针冒烟失败', report.failed)
      }
      return report
    },
    probeOmniboxCopyPaste: PROBE_OMNIBOX_COPY_PASTE_LINES
  }
  console.info(
    '[yiveno] DEV：SW 可用 yiveno.seedRecallProbe · yiveno.purgeProbeNoise · yiveno.backdateMemorySavedAt · yiveno.runProbeOmniboxSmoke()'
  )
}
