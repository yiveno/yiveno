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
import type {
  ClueChainFieldScore,
  ClueChainParseRunCase
} from '@/core/recall/eval/clue-chain/types'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

function expectFieldPassed(field: ClueChainFieldScore, passed: boolean): void {
  expect(field.scored).toBe(true)
  if (field.scored) {
    expect(field.passed).toBe(passed)
  }
}

function stubRun(
  patch: Partial<ClueChainParseRunCase> & Pick<ClueChainParseRunCase, 'id'>
): ClueChainParseRunCase {
  const parsedOverride =
    patch.parsed === null
      ? null
      : ({
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
          ...(patch.parsed ?? {})
        } as ParsedRecallClue)

  const base: ClueChainParseRunCase = {
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
    parsed: parsedOverride,
    source: 'llm',
    intentActual: parsedOverride?.intent ?? 'recall',
    topicTermsActual: parsedOverride?.topic?.terms ?? [],
    timeLabelActual: parsedOverride?.timeRange?.label ?? null,
    timeConfidenceActual: parsedOverride?.timeConfidence ?? null,
    objectTypesActual: parsedOverride?.objectTypes ?? [],
    objectTypeOtherActual: null,
    contentTermsActual: parsedOverride?.contentTerms ?? [],
    excludeContentTermsActual: [],
    confidenceActual: parsedOverride?.confidence ?? null,
    durationMs: 10,
    attempts: 1,
    error: null,
    timedOut: false,
    skipped: false
  }

  const { id: _id, parsed: _parsed, ...restPatch } = patch
  return { ...base, ...restPatch, id: patch.id, parsed: parsedOverride }
}

describe('clue-chain score-case', () => {
  it('intent：recall / non_recall', () => {
    expectFieldPassed(scoreIntent('recall', 'recall'), true)
    expectFieldPassed(scoreIntent('recall', undefined), true)
    expectFieldPassed(scoreIntent('non_recall', 'question'), true)
    expectFieldPassed(scoreIntent('non_recall', 'recall'), false)
  })

  it('time：之前 → any_past；null ↔ 无 label', () => {
    expect(expandExpectedTimeCandidates('之前').kind).toBe('any_past')
    expectFieldPassed(scoreTime('之前', 'a_while_ago'), true)
    expectFieldPassed(scoreTime('之前', 'today'), false)
    expectFieldPassed(scoreTime(null, null), true)
    expectFieldPassed(scoreTime(null, 'recent'), false)
    expectFieldPassed(scoreTime('前几天', 'recent'), true)
  })

  it('type：null 实际宽松过；候选集约束', () => {
    expect([...expandExpectedTypeCandidates('视频或文章')].sort()).toEqual(['article', 'video'])
    expectFieldPassed(scoreType('视频', []), true)
    expectFieldPassed(scoreType('视频', ['video']), true)
    expectFieldPassed(scoreType('视频', ['song']), false)
    expectFieldPassed(scoreType('商品', ['page']), false)
    expectFieldPassed(scoreType('商品', []), true)
  })

  it('entities：子串命中 content/topic', () => {
    expectFieldPassed(scoreEntities(['AI Agent'], ['agent', 'AI Agent tools']), true)
    expectFieldPassed(scoreEntities(['周杰伦'], ['jay']), false)
    expectFieldPassed(scoreEntities([], ['x']), true)
  })

  it('entities：原 clue 有实体但解析 terms 为空 → 失败（禁止 clue 兜底）', () => {
    expectFieldPassed(scoreEntities(['BBC'], []), false)
    expectFieldPassed(scoreEntities(['Apple'], []), false)
    const run = stubRun({
      id: 'ent-clue-only',
      clue: '可能是BBC拍的纪录片',
      expected: {
        intent: 'recall',
        topic: '迁徙',
        time: '之前',
        time_certainty: 'low',
        type: '视频',
        entities: ['BBC'],
        behavior: null,
        certainty: 'low'
      },
      contentTermsActual: [],
      topicTermsActual: [],
      excludeContentTermsActual: [],
      objectTypeOtherActual: null,
      parsed: {
        raw: '可能是BBC拍的纪录片',
        contentTerms: [],
        confidence: 'low',
        intent: 'recall'
      }
    })
    const score = scoreClueChainCase(run, { match: true, reason: 'ok' })
    expectFieldPassed(
      score.fields.find(f => f.field === 'entities')!,
      false
    )
  })

  it('entities：解析 terms 命中 → 通过；别名互认', () => {
    expectFieldPassed(scoreEntities(['BBC'], ['bbc', 'migration']), true)
    expectFieldPassed(scoreEntities(['Apple'], ['苹果', '功能']), true)
    expectFieldPassed(scoreEntities(['微信公众号'], ['公众号']), true)
    expectFieldPassed(scoreEntities(['公众号'], ['微信公众号']), true)
    expectFieldPassed(scoreEntities(['Apple'], ['banana']), false)
    expectFieldPassed(scoreEntities(['微信公众号'], ['抖音']), false)
  })

  it('entities：scoreClueChainCase 不把 clue 拼进 haystack', () => {
    const run = stubRun({
      id: 'ent-parsed-ok',
      clue: '苹果自带的功能',
      expected: {
        intent: 'recall',
        topic: '抠图',
        time: null,
        time_certainty: null,
        type: '功能',
        entities: ['Apple'],
        behavior: null,
        certainty: 'low'
      },
      contentTermsActual: ['苹果', '抠图'],
      topicTermsActual: ['抠图'],
      objectTypeOtherActual: '功能',
      parsed: {
        raw: '苹果自带的功能',
        contentTerms: ['苹果', '抠图'],
        confidence: 'low',
        intent: 'recall',
        objectTypeOther: '功能'
      }
    })
    const score = scoreClueChainCase(run, { match: true, reason: 'ok' })
    expectFieldPassed(
      score.fields.find(f => f.field === 'entities')!,
      true
    )
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
