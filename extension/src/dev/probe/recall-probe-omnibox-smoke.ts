/**
 * DEV：探针种库后 Omnibox 手测冒烟用例（与 `Omnibox-手测步骤.md` §4.1–4.2 对齐）。
 * 线索为 Omnibox 侧文本（不含 `yi` 前缀；Chrome 会剥掉 omnibox.keyword）。
 */

import { recallService } from '@/application/recall/recall-service'
import type { MemoryItem } from '@/core/memory/memory-item'

export type ProbeOmniboxSmokeCase = {
  id: string
  /** Omnibox 线索（无 `yi` 前缀） */
  clue: string
  /** 期望 Top Pick 展示标题含此子串（不区分大小写） */
  expectTitleIncludes: string
  /** 探针语料 `key`，便于对照 `@yiveno/probe` corpus */
  probeKey: string
}

/** 与手测文档 §4.1–4.2「复制即用」块一一对应（不含负例 §4.3）。 */
export const PROBE_OMNIBOX_SMOKE_CASES: readonly ProbeOmniboxSmokeCase[] = [
  {
    id: 'mv3',
    clue: 'chrome extension migration',
    expectTitleIncludes: 'Manifest V3',
    probeKey: 'chrome-mv3'
  },
  {
    id: 'stripe-idempotent',
    clue: 'stripe idempotent',
    expectTitleIncludes: 'Idempotent requests',
    probeKey: 'stripe-idempotency'
  },
  {
    id: 'postgres-explain',
    clue: 'postgres explain',
    expectTitleIncludes: 'Using EXPLAIN',
    probeKey: 'postgres-explain'
  },
  {
    id: 'github-actions-cache',
    clue: 'github actions cache',
    expectTitleIncludes: 'Caching dependencies',
    probeKey: 'github-actions-cache'
  },
  {
    id: 'remote-work',
    clue: 'remote work science',
    expectTitleIncludes: 'remote work',
    probeKey: 'ft-remote-work'
  },
  {
    id: 'font-pairing',
    clue: 'font pairing editorial',
    expectTitleIncludes: 'Font pairing',
    probeKey: 'typewolf-pairing'
  },
  {
    id: 'note-taking',
    clue: 'note taking apps',
    expectTitleIncludes: 'note-taking apps fail',
    probeKey: 'substack-newsletter'
  },
  {
    id: 'reading-list',
    clue: 'reading list useful',
    expectTitleIncludes: 'reading list useful',
    probeKey: 'hn-thread'
  },
  {
    id: 'promise-all-settled',
    clue: 'promise all settled',
    expectTitleIncludes: 'Using promises',
    probeKey: 'ex-promises'
  },
  {
    id: 'payments-incident',
    clue: 'payments incident',
    expectTitleIncludes: 'Idempotent',
    probeKey: 'stripe-idempotency'
  },
  {
    id: 'hug-contents',
    clue: 'hug contents',
    expectTitleIncludes: 'Auto layout',
    probeKey: 'ex-auto-layout'
  }
] as const

/** 手测文档「复制即用」整行（含 `yi ` 前缀）。 */
export const PROBE_OMNIBOX_COPY_PASTE_LINES: readonly string[] = PROBE_OMNIBOX_SMOKE_CASES.map(
  item => `yi ${item.clue}`
)

function topPickDisplayTitle(item: MemoryItem | undefined): string | null {
  if (!item) {
    return null
  }
  if (item.type === 'bookmark') {
    return item.payload.title.trim() || null
  }
  if (item.type === 'text_excerpt') {
    return item.payload.pageTitle.trim() || null
  }
  return null
}

function titleMatchesExpectation(actual: string | null, expectTitleIncludes: string): boolean {
  if (!actual) {
    return false
  }
  return actual.toLowerCase().includes(expectTitleIncludes.toLowerCase())
}

export type ProbeOmniboxSmokeResult = {
  id: string
  clue: string
  passed: boolean
  outcome: string
  actualTitle: string | null
  probeKey: string
}

/** 在已种探针库的 SW 上跑 Omnibox 轨 Recall 冒烟（含倒排 / 全表扫真实路径）。 */
export async function runProbeOmniboxSmoke(): Promise<{
  total: number
  passed: number
  failed: ProbeOmniboxSmokeResult[]
  results: ProbeOmniboxSmokeResult[]
}> {
  const results: ProbeOmniboxSmokeResult[] = []

  for (const spec of PROBE_OMNIBOX_SMOKE_CASES) {
    const recall = await recallService.recallWithClue(spec.clue, { entry: 'omnibox' })
    const actualTitle = topPickDisplayTitle(recall.topPick?.item)
    const passed =
      recall.outcome === 'top_pick' &&
      titleMatchesExpectation(actualTitle, spec.expectTitleIncludes)
    results.push({
      id: spec.id,
      clue: spec.clue,
      passed,
      outcome: recall.outcome,
      actualTitle,
      probeKey: spec.probeKey
    })
  }

  const failed = results.filter(item => !item.passed)
  return {
    total: results.length,
    passed: results.length - failed.length,
    failed,
    results
  }
}
