/**
 * 画像叙事生成：回退 / 重试 / 校验门。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const readCacheMock = vi.hoisted(() => vi.fn())
const writeCacheMock = vi.hoisted(() => vi.fn())
const getCompleterMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const getTokenMock = vi.hoisted(() => vi.fn())

vi.mock('@/infrastructure/storage/portrait-narrative-cache-storage', () => ({
  readPortraitNarrativeCache: readCacheMock,
  writePortraitNarrativeCache: writeCacheMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: getCompleterMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getSettingsMock
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getTokenMock
}))

vi.mock('@/infrastructure/ai/hosted-clue-understand-api-client', () => ({
  createHostedClueUnderstandApiCompleter: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { generatePortraitNarrative } from '@/application/portrait/generate-portrait-narrative'
import type { PortraitSummaryViewModel } from '@/core/portrait/render-portrait-summary'

function makeView(overrides: Partial<PortraitSummaryViewModel> = {}): PortraitSummaryViewModel {
  return {
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
    hiddenPendingCount: 0,
    factSignature: 'sig-abc',
    ...overrides
  }
}

describe('generatePortraitNarrative', () => {
  beforeEach(() => {
    readCacheMock.mockReset()
    writeCacheMock.mockReset()
    getCompleterMock.mockReset()
    getSettingsMock.mockReset()
    getTokenMock.mockReset()
    readCacheMock.mockResolvedValue(null)
    writeCacheMock.mockResolvedValue(undefined)
    getCompleterMock.mockReturnValue(null)
    getSettingsMock.mockResolvedValue({ aiFeaturesEnabled: true })
    getTokenMock.mockResolvedValue(null)
  })

  it('completer 失败 → 确定性文案', async () => {
    const complete = vi.fn(async () => {
      throw new Error('quota')
    })
    const result = await generatePortraitNarrative({
      view: makeView(),
      locale: 'zh_CN',
      complete
    })
    expect(result.source).toBe('deterministic')
    expect(result.text).toBe('比较确定的是，你喜欢 github.com。')
    expect(writeCacheMock).not.toHaveBeenCalled()
  })

  it('超长输出 → 回退确定性文案', async () => {
    const complete = vi.fn(async () => `你喜欢 github.com。${'啊'.repeat(400)}`)
    const result = await generatePortraitNarrative({
      view: makeView(),
      locale: 'zh_CN',
      complete
    })
    expect(result.source).toBe('deterministic')
    expect(writeCacheMock).not.toHaveBeenCalled()
  })

  it('首次不过 → 重试通过 → 展示重试文案并缓存', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce('你喜欢 github.com，也喜欢 evil.example。')
      .mockResolvedValueOnce('比较确定的是，你喜欢 github.com。')
    const result = await generatePortraitNarrative({
      view: makeView(),
      locale: 'zh_CN',
      complete
    })
    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.source).toBe('llm')
    expect(result.text).toBe('比较确定的是，你喜欢 github.com。')
    expect(writeCacheMock).toHaveBeenCalledWith(
      'sig-abc',
      'zh_CN',
      '比较确定的是，你喜欢 github.com。'
    )
  })

  it('两次不过 → 确定性文案且不缓存', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce('# bad markdown github.com')
      .mockResolvedValueOnce('还是 **markdown** github.com')
    const result = await generatePortraitNarrative({
      view: makeView(),
      locale: 'zh_CN',
      complete
    })
    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.source).toBe('deterministic')
    expect(result.text).toBe('比较确定的是，你喜欢 github.com。')
    expect(writeCacheMock).not.toHaveBeenCalled()
  })

  it('缓存命中不调 LLM', async () => {
    readCacheMock.mockResolvedValue('缓存文案：你喜欢 github.com。')
    const complete = vi.fn()
    const result = await generatePortraitNarrative({
      view: makeView(),
      locale: 'zh_CN',
      complete
    })
    expect(result.source).toBe('cache')
    expect(result.text).toBe('缓存文案：你喜欢 github.com。')
    expect(complete).not.toHaveBeenCalled()
  })
})
