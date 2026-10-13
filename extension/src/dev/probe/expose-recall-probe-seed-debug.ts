/**
 * DEV：Service Worker 全局挂载召回探针 seeder，便于 MCP / SW console 调用。
 * 仅 import.meta.env.DEV。
 *
 * 用法（Side Panel evaluate 发消息，或 SW 控制台）：
 *   await yiveno.seedRecallProbe({ replace: true, personas: ['researcher','creator','developer'] })
 *   await yiveno.cleanupProbe({ noiseOrDiversity: true, removeProbeFolder: true })
 *
 * 总索引：docs/engineering/DEV-调试API.md
 */

import {
  parseProbeCleanupPayload,
  parseSeedRecallProbePayload,
  type ProbeCleanupPayload,
  type SeedRecallProbePayload
} from '@/core/messaging/debug-messages'
import { cleanupProbeLibrary } from '@/dev/probe/recall-probe-cleanup-service'
import {
  PROBE_OMNIBOX_COPY_PASTE_LINES,
  runProbeOmniboxSmoke
} from '@/dev/probe/recall-probe-omnibox-smoke'
import { purgeProbeNoiseFromLibrary } from '@/dev/probe/recall-probe-purge-service'
import { seedRecallProbeCorpus } from '@/dev/probe/recall-probe-seed-service'
import {
  inspectMemoryByUrlOrTitle,
  listMemoryIndexStatus,
  recallProbe
} from '@/dev/probe/inspect-memory-debug'

type ProbeDebugHost = {
  yiveno?: {
    seedRecallProbe?: (
      payload?: Partial<SeedRecallProbePayload>
    ) => Promise<Awaited<ReturnType<typeof seedRecallProbeCorpus>>>
    purgeProbeNoise?: () => Promise<Awaited<ReturnType<typeof purgeProbeNoiseFromLibrary>>>
    cleanupProbe?: (
      payload?: Partial<ProbeCleanupPayload>
    ) => Promise<Awaited<ReturnType<typeof cleanupProbeLibrary>>>
    runProbeOmniboxSmoke?: () => Promise<Awaited<ReturnType<typeof runProbeOmniboxSmoke>>>
    /** 手测文档 §4 复制块（含 `yi ` 前缀） */
    probeOmniboxCopyPaste?: readonly string[]
    /**
     * 真机 Recall 探针（2026-10-07）：SW 端直接调 recallService。
     * 用法：`await yiveno.recallProbe({ clue: 'unit', entry: 'omnibox' })`
     *  返回与 Side Panel 相同的 RecallResult 完整结构。
     */
    recallProbe?: (input: { clue: string; entry?: 'omnibox' | 'sidepanel' }) => Promise<unknown>
    /**
     * 真机 Memory 探针（2026-10-07）：按 url 片段 / title 片段查可搜索字段全量。
     * 用法：`await yiveno.inspectMemory({ needle: 'yivenoProbe' })`
     */
    inspectMemory?: (input: { needle: string }) => Promise<unknown>
    /** 列出倒排索引状态（owner × posting 数量），验证索引是否齐全。 */
    listMemoryIndexStatus?: () => Promise<unknown>
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
    cleanupProbe: async (payload?: Partial<ProbeCleanupPayload>) => {
      const parsed = parseProbeCleanupPayload(payload ?? {})
      const result = await cleanupProbeLibrary(parsed)
      console.info('[yiveno] 探针清理完成', result)
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
    probeOmniboxCopyPaste: PROBE_OMNIBOX_COPY_PASTE_LINES,
    recallProbe: async input => recallProbe(input),
    inspectMemory: async input => inspectMemoryByUrlOrTitle(input),
    listMemoryIndexStatus: async () => listMemoryIndexStatus()
  }
  console.info(
    '[yiveno] DEV：优先打开 Probe Console；SW 可用 yiveno.seedRecallProbe · cleanupProbe · purgeProbeNoise · runProbeOmniboxSmoke() · recallProbe({clue,entry}) · inspectMemory({needle}) · listMemoryIndexStatus()'
  )
}
