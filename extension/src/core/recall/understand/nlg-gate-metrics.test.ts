/**
 * NLG 门禁度量：累加、分桶过期、落盘失败不抛、五处接入各一例。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generatePortraitClusters } from '@/application/portrait/generate-portrait-clusters'
import { generatePortraitNarrative } from '@/application/portrait/generate-portrait-narrative'
import type { PortraitSummaryViewModel } from '@/core/portrait/render-portrait-summary'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'
import { clearLlmParseCache } from '@/core/recall/understand/llm-parse-cache'
import { completeComposerNarrowExamplePolishWithLlm } from '@/core/recall/understand/complete-composer-narrow-example-polish'
import { completeRecallFollowUpWithLlm } from '@/core/recall/understand/complete-recall-follow-up'
import { completeRecallFramingNlgWithLlm } from '@/core/recall/understand/complete-recall-framing-nlg'
import {
  configureNlgGateMetricsPersist,
  pruneNlgGateMetricsDays,
  readNlgGateMetrics,
  recordNlgGateOutcome,
  resetNlgGateMetricsForTests,
  utcDayKey
} from '@/core/recall/understand/nlg-gate-metrics'
import { parseRecallClueWithLlm } from '@/core/recall/understand/parse-recall-clue-with-llm'

vi.mock('@/infrastructure/storage/portrait-narrative-cache-storage', () => ({
  readPortraitNarrativeCache: vi.fn(async () => null),
  writePortraitNarrativeCache: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/storage/portrait-cluster-cache-storage', () => ({
  readPortraitClusterCache: vi.fn(async () => null),
  writePortraitClusterCache: vi.fn(async () => undefined)
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: vi.fn(() => null)
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: vi.fn(async () => ({ aiFeaturesEnabled: true }))
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => null)
}))

vi.mock('@/infrastructure/ai/hosted-clue-understand-api-client', () => ({
  createHostedClueUnderstandApiCompleter: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

describe('nlg-gate-metrics 核心', () => {
  beforeEach(() => {
    resetNlgGateMetricsForTests()
    configureNlgGateMetricsPersist(null)
  })

  afterEach(() => {
    resetNlgGateMetricsForTests()
    configureNlgGateMetricsPersist(null)
  })

  it('计数累加', async () => {
    recordNlgGateOutcome('framing_nlg', 'accepted', NOW_MS)
    recordNlgGateOutcome('framing_nlg', 'accepted', NOW_MS)
    recordNlgGateOutcome('framing_nlg', 'rejected:map', NOW_MS)
    const store = await readNlgGateMetrics()
    const day = store.days.find(row => row.day === utcDayKey(NOW_MS))
    expect(day?.counts.framing_nlg?.accepted).toBe(2)
    expect(day?.counts.framing_nlg?.['rejected:map']).toBe(1)
  })

  it('分桶过期清理', () => {
    const now = Date.parse('2026-11-27T00:00:00.000Z')
    const pruned = pruneNlgGateMetricsDays(
      [
        { day: '2026-10-01', counts: { framing_nlg: { accepted: 1 } } },
        { day: '2026-11-20', counts: { framing_nlg: { accepted: 2 } } },
        { day: '2026-11-27', counts: { framing_nlg: { accepted: 3 } } }
      ],
      now,
      14
    )
    expect(pruned.map(row => row.day)).toEqual(['2026-11-20', '2026-11-27'])
  })

  it('落盘失败不抛且内存仍可读', async () => {
    vi.useFakeTimers()
    configureNlgGateMetricsPersist({
      read: async () => null,
      write: async () => {
        throw new Error('disk_full')
      }
    })
    expect(() => recordNlgGateOutcome('narrow_polish', 'fallback', NOW_MS)).not.toThrow()
    await vi.advanceTimersByTimeAsync(2500)
    expect(await readNlgGateMetrics()).toMatchObject({
      days: [{ counts: { narrow_polish: { fallback: 1 } } }]
    })
    vi.useRealTimers()
  })
})

describe('nlg-gate-metrics 五处接入', () => {
  beforeEach(() => {
    resetNlgGateMetricsForTests()
    configureNlgGateMetricsPersist(null)
    clearLlmParseCache()
  })

  afterEach(() => {
    resetNlgGateMetricsForTests()
    configureNlgGateMetricsPersist(null)
  })

  const baseFacts: RecallFramingCandidateFacts = {
    kind: 'candidates',
    understood: {
      objectTypes: ['video'],
      contentTerms: [],
      behaviorHints: [],
      noteHint: false
    },
    retrievalPath: 'constraint_neighborhood',
    buckets: [],
    stance: 'weak_candidates',
    counts: { total: 8, shown: 5 },
    isWideNeighborhood: true
  }

  it('framing map 拒收 → rejected:map', async () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    await expect(
      completeRecallFramingNlgWithLlm({
        clue: parsed.raw,
        parsed,
        outcome: 'need_a_clue',
        facts: baseFacts,
        rulesBaseline: 'baseline',
        complete: async () =>
          JSON.stringify({
            reply: 'Was it an article, poem, code, or a song?',
            chips: []
          })
      })
    ).rejects.toThrow('framing_nlg_gate_rejected')
    const store = await readNlgGateMetrics()
    expect(store.days[0]?.counts.framing_nlg?.['rejected:map']).toBe(1)
  })

  it('follow_up 成功 → accepted', async () => {
    const parsed = parseRecallClue('that video about design', { nowMs: NOW_MS })
    await completeRecallFollowUpWithLlm({
      clue: parsed.raw,
      parsed,
      outcome: 'need_a_clue',
      weakCandidateTitles: ['Design systems talk', 'Figma tips'],
      complete: async () =>
        JSON.stringify({
          reply: 'Which title word rings a bell?',
          chips: [{ label: 'Figma', value: 'Figma' }]
        })
    })
    const store = await readNlgGateMetrics()
    expect(store.days[0]?.counts.follow_up_nlg?.accepted).toBe(1)
  })

  it('narrow 整表回退 → fallback', async () => {
    await completeComposerNarrowExamplePolishWithLlm({
      selectedExamples: ['figma', 'design'],
      candidateTextPreviews: ['figma design systems'],
      complete: async () => JSON.stringify({ examples: ['only-one'] })
    })
    const store = await readNlgGateMetrics()
    expect(store.days[0]?.counts.narrow_polish?.fallback).toBe(1)
  })

  it('chitchat 语言不匹配 → rejected:language_mismatch', async () => {
    const original = '天气不错哦，想找点什么吗？'
    let n = 0
    await parseRecallClueWithLlm('今天天气不错', {
      useCache: false,
      complete: async () => {
        n += 1
        if (n === 1) {
          return JSON.stringify({
            timeLabel: null,
            objectTypes: [],
            behaviorHints: [],
            noteHint: false,
            contentTerms: [],
            intent: 'chitchat',
            assistantReply: original,
            confidence: 'low'
          })
        }
        return 'Nice day — looking for something saved?'
      }
    })
    const store = await readNlgGateMetrics()
    expect(store.days[0]?.counts.chitchat?.['rejected:language_mismatch']).toBe(1)
  })

  it('portrait_narrative 回退 → fallback；portrait_cluster 成功 → accepted', async () => {
    const view: PortraitSummaryViewModel = {
      empty: false,
      emptyText: '',
      introText: 'intro',
      summaryText: '比较确定的是，你喜欢 github.com。',
      groups: [
        {
          key: 'verified',
          title: '已核实',
          narrative: '你喜欢 github.com。',
          items: [
            {
              factId: 'f1',
              line: '你喜欢 github.com。',
              inPortrait: true,
              pendingInference: false,
              value: 'github.com',
              credibility: 0.9,
              state: 'verified'
            }
          ]
        }
      ],
      pendingNarrative: '',
      clusters: [],
      hiddenPendingItems: [],
      hiddenPendingCount: 0,
      factSignature: 'sig-metrics'
    }

    await generatePortraitNarrative({
      view,
      locale: 'zh_CN',
      complete: async () => {
        throw new Error('quota')
      }
    })

    await generatePortraitClusters({
      items: [
        {
          factId: 'f-apple',
          value: '苹果',
          credibility: 0.4,
          state: 'unconfirmed',
          sourceNoteRefs: ['note:fruit']
        },
        {
          factId: 'f-pear',
          value: '梨',
          credibility: 0.4,
          state: 'unconfirmed',
          sourceNoteRefs: ['note:fruit']
        }
      ],
      locale: 'zh_CN',
      complete: async () =>
        JSON.stringify({
          clusters: [{ label: '水果', items: ['苹果', '梨'] }]
        })
    })

    const store = await readNlgGateMetrics()
    expect(store.days[0]?.counts.portrait_narrative?.fallback).toBe(1)
    expect(store.days[0]?.counts.portrait_cluster?.accepted).toBe(1)
  })
})
