/**
 * Q7：detailed completer 入口 + parse/framing 计量点。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'
import { completeRecallFramingNlgWithLlm } from '@/core/recall/understand/complete-recall-framing-nlg'
import type { ClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import {
  createOpenAiCompatibleCompleterDetailed,
  parseRecallClueWithLlm,
  type LlmChatCompleterDetailed
} from '@/core/recall/understand/parse-recall-clue-with-llm'

const messages = [{ role: 'user' as const, content: 'parse this' }]
const originalFetch = globalThis.fetch
const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

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

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function mockFetchWithUsage(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"contentTerms":["coffee"],"confidence":"high"}' } }],
        usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 }
      }),
      { status: 200 }
    )
  )
  globalThis.fetch = fetchMock as typeof fetch
  return fetchMock
}

describe('createOpenAiCompatibleCompleterDetailed', () => {
  it('返回 text + 拆分 usage', async () => {
    mockFetchWithUsage()
    const detailed = createOpenAiCompatibleCompleterDetailed({
      apiKey: 'test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat'
    })
    const result = await detailed(messages, { taskKind: 'nlu' })
    expect(result.text).toContain('contentTerms')
    expect(result.usage).toEqual({
      promptTokens: 11,
      completionTokens: 22,
      totalTokens: 33
    })
  })
})

describe('parseRecallClueWithLlm usage 计量', () => {
  it('completeDetailed 时 trace 带 prompt/completion/total', async () => {
    const steps: Array<{ step: string; data?: Record<string, unknown> }> = []
    const trace: ClueFlowTrace = (_level, step, data) => {
      steps.push({ step, ...(data ? { data } : {}) })
    }
    const completeDetailed: LlmChatCompleterDetailed = async () => ({
      text: JSON.stringify({
        contentTerms: ['poem'],
        confidence: 'high',
        intent: 'recall'
      }),
      usage: { promptTokens: 9, completionTokens: 4, totalTokens: 13 }
    })
    await parseRecallClueWithLlm('yesterday poem', {
      complete: async () => {
        throw new Error('should use detailed')
      },
      completeDetailed,
      useCache: false,
      trace
    })
    const returned = steps.find(row => row.step === 'LLM 解析：completer 返回')
    expect(returned?.data?.promptTokens).toBe(9)
    expect(returned?.data?.completionTokens).toBe(4)
    expect(returned?.data?.totalTokens).toBe(13)
  })
})

describe('completeRecallFramingNlgWithLlm usage 计量', () => {
  it('completeDetailed 时 trace 带 prompt/completion/total', async () => {
    const steps: Array<{ step: string; data?: Record<string, unknown> }> = []
    const trace: ClueFlowTrace = (_level, step, data) => {
      steps.push({ step, ...(data ? { data } : {}) })
    }
    const parsed = parseRecallClue('that video about design', { nowMs: NOW_MS })
    const completeDetailed: LlmChatCompleterDetailed = async () => ({
      text: JSON.stringify({
        reply: 'These clips are all design-related. Which site or title word rings a bell?',
        chips: [{ label: 'Figma', value: 'Figma' }]
      }),
      usage: { promptTokens: 5, completionTokens: 6, totalTokens: 11 }
    })
    await completeRecallFramingNlgWithLlm({
      clue: parsed.raw,
      parsed,
      outcome: 'need_a_clue',
      facts: baseFacts,
      rulesBaseline: 'Looking for video in your library.',
      complete: async () => {
        throw new Error('should use detailed')
      },
      completeDetailed,
      trace
    })
    const returned = steps.find(row => row.step === 'LLM Framing：completer 返回')
    expect(returned?.data?.promptTokens).toBe(5)
    expect(returned?.data?.completionTokens).toBe(6)
    expect(returned?.data?.totalTokens).toBe(11)
  })
})
