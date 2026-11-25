import { describe, expect, it } from 'vitest'

import {
  expandExpectedTimeCandidates,
  expandExpectedTypeCandidates,
  scoreClueChainCase,
  scoreEntities,
  scoreIntent,
  scoreTime,
  scoreType
} from '@/core/recall/eval/clue-chain/score-case'
import type { ClueChainParseRunCase } from '@/core/recall/eval/clue-chain/types'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

function stubRun(
  patch: Partial<ClueChainParseRunCase> & Pick<ClueChainParseRunCase, 'id'>
): ClueChainParseRunCase {
  const parsed: ParsedRecallClue = {
    raw: 'stub',
    contentTerms: ['chicken'],
    confidence: 'low',
    intent: 'recall',
    topic: { terms: ['chicken', 'fry'], source: 'content', strength: 'strong' },
    timeRange: {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      label: 'a_while_ago'
    },
    timeConfidence: 'low',
    objectTypes: ['video'],
    ...((patch.parsed as Partial<ParsedRecallClue> | null | undefined) ?? {})
  }
  return {
    id: patch.id,
    category: 'A',
    clue: '之前那个鸡胸肉视频',
    note: 'stub',
    difficulty: 'easy',
    expected: {
      intent: 'recall',
      topic: '嫩鸡胸肉做法',
      time: '之前',
      time_certainty: 'low',
      type: '视频',
      entities: [],
      behavior: null,
      certainty: 'low'
    },
    parsed,
    source: 'llm',
    intentActual: parsed.intent ?? 'recall',
    topicTermsActual: parsed.topic?.terms ?? [],
    timeLabelActual: parsed.timeRange?.label ?? null,
    timeConfidenceActual: parsed.timeConfidence ?? null,
    objectTypesActual: parsed.objectTypes ?? [],
    objectTypeOtherActual: null,
    contentTermsActual: parsed.contentTerms,
    excludeContentTermsActual: [],
    confidenceActual: parsed.confidence,
    durationMs: 10,
    attempts: 1,
    error: null,
    timedOut: false,
    skipped: false,
    ...patch
  }
}

describe('clue-chain score-case', () => {
  it('intent：recall / non_recall', () => {
    expect(scoreIntent('recall', 'recall').passed).toBe(true)
    expect(scoreIntent('recall', undefined).passed).toBe(true)
    expect(scoreIntent('non_recall', 'question').passed).toBe(true)
    expect(scoreIntent('non_recall', 'recall').passed).toBe(false)
  })

  it('time：之前 → any_past；null ↔ 无 label', () => {
    expect(expandExpectedTimeCandidates('之前').kind).toBe('any_past')
    expect(scoreTime('之前', 'a_while_ago').passed).toBe(true)
    expect(scoreTime('之前', 'today').passed).toBe(false)
    expect(scoreTime(null, null).passed).toBe(true)
    expect(scoreTime(null, 'recent').passed).toBe(false)
    expect(scoreTime('前几天', 'recent').passed).toBe(true)
  })

  it('type：null 实际宽松过；候选集约束', () => {
    expect([...expandExpectedTypeCandidates('视频或文章')].sort()).toEqual(['article', 'video'])
    expect(scoreType('视频', []).passed).toBe(true)
    expect(scoreType('视频', ['video']).passed).toBe(true)
    expect(scoreType('视频', ['song']).passed).toBe(false)
    expect(scoreType('商品', ['page']).passed).toBe(false)
    expect(scoreType('商品', []).passed).toBe(true)
  })

  it('entities：子串命中 content/topic', () => {
    expect(scoreEntities(['AI Agent'], ['agent', 'AI Agent tools']).passed).toBe(true)
    expect(scoreEntities(['周杰伦'], ['jay']).passed).toBe(false)
    expect(scoreEntities([], ['x']).passed).toBe(true)
  })

  it('C 类只看 intent；topic 不计分', () => {
    const run = stubRun({
      id: 'C01',
      category: 'C',
      expected: {
        intent: 'non_recall',
        topic: null,
        time: null,
        time_certainty: null,
        type: null,
        entities: [],
        behavior: null,
        certainty: 'high'
      },
      intentActual: 'question',
      parsed: {
        raw: 'q',
        contentTerms: [],
        confidence: 'high',
        intent: 'question'
      }
    })
    const score = scoreClueChainCase(run, { match: false, reason: 'should ignore' })
    expect(score.corePassed).toBe(true)
    expect(score.fields.find(f => f.field === 'topic')?.scored).toBe(false)
  })

  it('A 类 core 需 intent+topic judge', () => {
    const run = stubRun({ id: '01' })
    expect(scoreClueChainCase(run, { match: true, reason: 'ok' }).corePassed).toBe(true)
    expect(scoreClueChainCase(run, { match: false, reason: 'no' }).corePassed).toBe(false)
  })

  it('解析失败 → core 不过', () => {
    const run = stubRun({
      id: 'X',
      parsed: null,
      error: 'boom',
      intentActual: null,
      topicTermsActual: [],
      timeLabelActual: null,
      objectTypesActual: [],
      contentTermsActual: [],
      confidenceActual: null
    })
    expect(scoreClueChainCase(run, null).corePassed).toBe(false)
  })
})
