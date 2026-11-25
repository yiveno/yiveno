/**
 * F7：行为偏好「换一个」空跟进豁免 Gate A+；两轮轮换；F8 抛光守卫。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BehaviorStatsRecord } from '@/infrastructure/indexeddb/behavior-stats-types'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'
import enMessages from '../../../../public/_locales/en/messages.json'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)
const DAY = 86_400_000

const {
  understandRecallClueMock,
  getClueLlmCompleterMock,
  getClueLlmCompleterDetailedMock,
  getBehaviorHistoryImportStatusMock,
  listByOwnerMock,
  getCurrentOwnerIdMock,
  readBrowserOnlineMock
} = vi.hoisted(() => ({
  understandRecallClueMock: vi.fn(),
  getClueLlmCompleterMock: vi.fn(),
  getClueLlmCompleterDetailedMock: vi.fn(),
  getBehaviorHistoryImportStatusMock: vi.fn(),
  listByOwnerMock: vi.fn(),
  getCurrentOwnerIdMock: vi.fn(),
  readBrowserOnlineMock: vi.fn(() => true)
}))

vi.mock('@/core/recall/understand/understand-recall-clue', () => ({
  understandRecallClue: understandRecallClueMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: getClueLlmCompleterMock,
  getClueLlmCompleterDetailed: getClueLlmCompleterDetailedMock
}))

vi.mock('@/infrastructure/browser/browser-online', async importOriginal => {
  const actual = await importOriginal<typeof import('@/infrastructure/browser/browser-online')>()
  return {
    ...actual,
    readBrowserOnline: readBrowserOnlineMock
  }
})

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    listForKeywordRecall: vi.fn(async () => ({ items: [], source: 'scan' as const })),
    list: vi.fn(async () => [])
  }
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => null)
}))

vi.mock('@/application/recall/apply-recall-context', () => ({
  applyPageContextToMatches: vi.fn((matches: unknown[]) => matches),
  applyStoredOutcomePairsToMatches: vi.fn(async (matches: unknown[]) => matches)
}))

vi.mock('@/application/behavior/import-behavior-history-service', () => ({
  getBehaviorHistoryImportStatus: getBehaviorHistoryImportStatusMock
}))

vi.mock('@/infrastructure/indexeddb/behavior-stats-repository', () => ({
  behaviorStatsRepository: {
    listByOwner: listByOwnerMock
  }
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: getCurrentOwnerIdMock
}))

import { HybridRecallBackend } from '@/application/recall/backends/hybrid-recall-backend'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

function statsRow(
  partial: Pick<BehaviorStatsRecord, 'url' | 'domain' | 'visitCount' | 'lastVisitTime'>
): BehaviorStatsRecord {
  return {
    ownerId: OWNER_ID,
    url: partial.url,
    domain: partial.domain,
    visitCount: partial.visitCount,
    lastVisitTime: partial.lastVisitTime,
    totalDwellMs: 0,
    updatedAt: '2026-11-24T00:00:00.000Z'
  }
}

/** 5 个域名，visitCount 递减，保证 most_frequent 排序稳定。 */
function fiveDomainRows(): BehaviorStatsRecord[] {
  return [
    statsRow({
      url: 'https://a.example/',
      domain: 'a.example',
      visitCount: 50,
      lastVisitTime: NOW - DAY
    }),
    statsRow({
      url: 'https://b.example/',
      domain: 'b.example',
      visitCount: 40,
      lastVisitTime: NOW - 2 * DAY
    }),
    statsRow({
      url: 'https://c.example/',
      domain: 'c.example',
      visitCount: 30,
      lastVisitTime: NOW - 3 * DAY
    }),
    statsRow({
      url: 'https://d.example/',
      domain: 'd.example',
      visitCount: 20,
      lastVisitTime: NOW - 4 * DAY
    }),
    statsRow({
      url: 'https://e.example/',
      domain: 'e.example',
      visitCount: 10,
      lastVisitTime: NOW - 5 * DAY
    })
  ]
}

function preferenceParsed(overrides: Partial<ParsedRecallClue> = {}): ParsedRecallClue {
  return {
    raw: '我最常看的网站',
    contentTerms: [],
    confidence: 'high',
    preferenceOperator: 'most_frequent',
    preferenceTarget: 'site',
    intent: 'recall',
    ...overrides
  }
}

function instructionFollowUpParsed(raw: string): ParsedRecallClue {
  return {
    raw,
    contentTerms: [],
    confidence: 'low',
    intent: 'instruction',
    assistantReply: '这个我做不到，我只会帮你找保存过的东西。'
  }
}

function proceedUnderstand(parsed: ParsedRecallClue) {
  return {
    disposition: 'proceed' as const,
    rejectReason: null,
    mode: 'semantic' as const,
    source: 'llm' as const,
    clueTruncated: false,
    parsed,
    filterClue: parsed.contentTerms.join(' ')
  }
}

describe('HybridRecallBackend · 行为偏好空跟进 Gate A+ 豁免', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUiLocaleCatalogForTests('en', enMessages as never)
    readBrowserOnlineMock.mockReturnValue(true)
    getClueLlmCompleterMock.mockReturnValue(null)
    getClueLlmCompleterDetailedMock.mockReturnValue(null)
    getCurrentOwnerIdMock.mockResolvedValue(OWNER_ID)
    getBehaviorHistoryImportStatusMock.mockResolvedValue({
      status: 'completed',
      importedCount: 5,
      skippedCount: 0,
      completedAt: '2026-11-24T00:00:00.000Z'
    })
    listByOwnerMock.mockResolvedValue(fiveDomainRows())
  })

  afterEach(() => {
    setUiLocaleCatalogForTests('en', null)
  })

  it('instruction + 空跟进 + accumulated 有算子 → 不短路，进行为分支', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )

    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })

    expect(result.emptyKind).not.toBe('chitchat')
    expect(result.assistantReply).toBeUndefined()
    expect(result.behaviorPreference).toBeTruthy()
    expect(result.topPick?.item.payload).toMatchObject({ domain: 'd.example' })
  })

  it('chitchat + 空跟进 + 有算子 → 仍短路', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '谢谢',
        contentTerms: [],
        confidence: 'low',
        intent: 'chitchat',
        assistantReply: '不客气——想找点什么再说一声。'
      })
    )

    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('谢谢', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })

    expect(result.emptyKind).toBe('chitchat')
    expect(result.behaviorPreference).toBeUndefined()
    expect(listByOwnerMock).not.toHaveBeenCalled()
  })

  it('instruction + 带 contentTerms → 仍短路', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '换一个关于设计的',
        contentTerms: ['设计'],
        confidence: 'low',
        intent: 'instruction',
        assistantReply: '这个我做不到。'
      })
    )

    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('换一个关于设计的', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })

    expect(result.emptyKind).toBe('chitchat')
    expect(listByOwnerMock).not.toHaveBeenCalled()
  })

  it('无 accumulated 算子时 instruction 空跟进 → 仍短路', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )

    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: [],
        dismissedIds: []
      }
    })

    expect(result.emptyKind).toBe('chitchat')
    expect(listByOwnerMock).not.toHaveBeenCalled()
  })

  it('两轮：首轮 1–3，换一个 → 4–5；再换一个 → 耗尽；变体「下一个」同样前进', async () => {
    const backend = new HybridRecallBackend()

    understandRecallClueMock.mockResolvedValue(proceedUnderstand(preferenceParsed()))
    const round1 = await backend.recallWithClue('我最常看的网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })
    expect(round1.outcome).toBe('top_pick')
    expect(round1.topPick?.item.payload).toMatchObject({ domain: 'a.example' })
    expect(round1.alsoPossible.map(m => m.item.payload.domain)).toEqual(['b.example', 'c.example'])
    expect(round1.behaviorPreference?.shownOffset).toBe(0)

    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )
    const round2 = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: round1.parsed ?? preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(round2.emptyKind).not.toBe('chitchat')
    expect(round2.topPick?.item.payload).toMatchObject({ domain: 'd.example' })
    expect(round2.alsoPossible.map(m => m.item.payload.domain)).toEqual(['e.example'])
    expect(round2.behaviorPreference?.shownOffset).toBe(3)

    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )
    const round3 = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站', '换一个'],
        accumulated: round2.parsed ?? preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 5
      }
    })
    expect(round3.emptyKind).toBe('behavior_exhausted')
    expect(round3.topPick).toBeNull()

    // 变体词面「下一个」——按结构豁免，不是字面匹配「换一个」
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('下一个'))
    )
    const variant = await backend.recallWithClue('下一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(variant.emptyKind).not.toBe('chitchat')
    expect(variant.topPick?.item.payload).toMatchObject({ domain: 'd.example' })
  })

  it('F8：抛光结果丢 top 域名时回退规则基线（含域名与访问次数）', async () => {
    getClueLlmCompleterMock.mockReturnValue(
      vi.fn(async () =>
        JSON.stringify({
          reply: '按你保存内容中的措辞排序。这里看起来是个不错的起点。',
          chips: []
        })
      )
    )

    understandRecallClueMock.mockResolvedValue(proceedUnderstand(preferenceParsed()))
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('我最常看的网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })

    expect(result.outcome).toBe('top_pick')
    expect(result.recallFraming?.source).toBe('rules')
    expect(result.recallFraming?.text).toContain('a.example')
    expect(result.recallFraming?.text).toMatch(/50/)
  })
})

describe('HybridRecallBackend · F5 累积算子让位文档池', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUiLocaleCatalogForTests('en', enMessages as never)
    readBrowserOnlineMock.mockReturnValue(true)
    getClueLlmCompleterMock.mockReturnValue(null)
    getClueLlmCompleterDetailedMock.mockReturnValue(null)
    getCurrentOwnerIdMock.mockResolvedValue(OWNER_ID)
    getBehaviorHistoryImportStatusMock.mockResolvedValue({
      status: 'completed',
      importedCount: 5,
      skippedCount: 0,
      completedAt: '2026-11-24T00:00:00.000Z'
    })
    listByOwnerMock.mockResolvedValue(fiveDomainRows())
  })

  afterEach(() => {
    setUiLocaleCatalogForTests('en', null)
  })

  it('本轮新算子 → 行为分支开火', async () => {
    understandRecallClueMock.mockResolvedValue(proceedUnderstand(preferenceParsed()))
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('我最常看的网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })
    expect(result.behaviorPreference).toBeTruthy()
    expect(listByOwnerMock).toHaveBeenCalled()
  })

  it('裸跟进 → 行为分支开火', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(result.behaviorPreference).toBeTruthy()
    expect(result.topPick?.item.payload).toMatchObject({ domain: 'd.example' })
  })

  it('新内容词无算子 → 让位文档池（merged 算子已清检索、会话 parsed 仍保留）', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '阮一峰的博客',
        contentTerms: ['阮一峰', '博客'],
        confidence: 'high',
        intent: 'recall'
      })
    )
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('阮一峰的博客', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(result.emptyKind).not.toBe('behavior_topic_unsupported')
    expect(result.behaviorPreference).toBeUndefined()
    expect(listByOwnerMock).not.toHaveBeenCalled()
    // 回写会话仍带算子，供后续裸跟进
    expect(result.parsed?.preferenceOperator).toBe('most_frequent')
    // 文档 framing，非行为频次措辞
    expect(result.recallFraming?.text ?? '').not.toMatch(/50/)
  })

  it('仅对象类型无算子 → 让位文档池', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '文章呢',
        contentTerms: [],
        objectTypes: ['article'],
        confidence: 'medium',
        intent: 'recall'
      })
    )
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('文章呢', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(result.behaviorPreference).toBeUndefined()
    expect(listByOwnerMock).not.toHaveBeenCalled()
    expect(result.emptyKind).not.toBe('behavior_topic_unsupported')
    expect(result.parsed?.preferenceOperator).toBe('most_frequent')
  })

  it('仅时间范围无算子 → 让位文档池', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '上周的',
        contentTerms: [],
        timeRange: {
          from: '2026-11-17T00:00:00.000Z',
          to: '2026-11-23T23:59:59.999Z',
          label: 'last_week'
        },
        timeConfidence: 'high',
        confidence: 'medium',
        intent: 'recall'
      })
    )
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('上周的', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(result.behaviorPreference).toBeUndefined()
    expect(listByOwnerMock).not.toHaveBeenCalled()
    expect(result.parsed?.preferenceOperator).toBe('most_frequent')
  })

  it('同轮算子+主题 → 仍 topic_unsupported', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(
        preferenceParsed({
          raw: '我最常看的 AI 网站',
          contentTerms: ['AI']
        })
      )
    )
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('我最常看的 AI 网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })
    expect(result.emptyKind).toBe('behavior_topic_unsupported')
    expect(result.behaviorPreference).toBeUndefined()
  })

  it('让位轮无 behaviorPreference → SidePanel 不推进 behaviorShownCount', async () => {
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '阮一峰的博客',
        contentTerms: ['阮一峰'],
        confidence: 'high',
        intent: 'recall'
      })
    )
    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue('阮一峰的博客', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    // SidePanel 仅在 behaviorPreference / 行为空态时改计数；让位结果两者皆无 → 保留原计数
    expect(result.behaviorPreference).toBeUndefined()
    expect(result.emptyKind?.startsWith('behavior_') ?? false).toBe(false)
  })

  it('两轮：Q1 偏好 → 阮一峰的博客 → 文档结果、无 topic_unsupported', async () => {
    const backend = new HybridRecallBackend()
    understandRecallClueMock.mockResolvedValue(proceedUnderstand(preferenceParsed()))
    const round1 = await backend.recallWithClue('我最常看的网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })
    expect(round1.behaviorPreference).toBeTruthy()

    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '阮一峰的博客',
        contentTerms: ['阮一峰', '博客'],
        confidence: 'high',
        intent: 'recall'
      })
    )
    const round2 = await backend.recallWithClue('阮一峰的博客', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: round1.parsed ?? preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(round2.emptyKind).not.toBe('behavior_topic_unsupported')
    expect(round2.behaviorPreference).toBeUndefined()
    expect(listByOwnerMock).toHaveBeenCalledTimes(1)
  })

  it('两轮：Q1 偏好 → 换一个 → 仍出 #4–5（循环未破）', async () => {
    const backend = new HybridRecallBackend()
    understandRecallClueMock.mockResolvedValue(proceedUnderstand(preferenceParsed()))
    const round1 = await backend.recallWithClue('我最常看的网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })
    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )
    const round2 = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: round1.parsed ?? preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(round2.topPick?.item.payload).toMatchObject({ domain: 'd.example' })
    expect(round2.alsoPossible.map(m => m.item.payload.domain)).toEqual(['e.example'])
  })

  it('已知近似：Q1 → 文档轮 → 换一个 → 仍续偏好循环', async () => {
    const backend = new HybridRecallBackend()
    understandRecallClueMock.mockResolvedValue(proceedUnderstand(preferenceParsed()))
    const round1 = await backend.recallWithClue('我最常看的网站', {
      entry: 'sidepanel',
      context: { priorUserUtterances: [], dismissedIds: [] }
    })

    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand({
        raw: '阮一峰的博客',
        contentTerms: ['阮一峰', '博客'],
        confidence: 'high',
        intent: 'recall'
      })
    )
    const docRound = await backend.recallWithClue('阮一峰的博客', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站'],
        accumulated: round1.parsed ?? preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(docRound.parsed?.preferenceOperator).toBe('most_frequent')
    expect(docRound.behaviorPreference).toBeUndefined()

    understandRecallClueMock.mockResolvedValue(
      proceedUnderstand(instructionFollowUpParsed('换一个'))
    )
    const follow = await backend.recallWithClue('换一个', {
      entry: 'sidepanel',
      context: {
        priorUserUtterances: ['我最常看的网站', '阮一峰的博客'],
        accumulated: docRound.parsed ?? preferenceParsed(),
        dismissedIds: [],
        behaviorShownCount: 3
      }
    })
    expect(follow.behaviorPreference).toBeTruthy()
    expect(follow.topPick?.item.payload).toMatchObject({ domain: 'd.example' })
  })
})
