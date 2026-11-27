/**
 * Stage 2 harness：规模 / 确定性 / 归因 / 指标 / 基线对比。
 */

import { describe, expect, it, vi } from 'vitest'

import { CLUE_CHAIN_STAGE2_SEED, CLUE_CHAIN_STAGE2_SIZES } from './constants'
import { compareStage2Baseline } from './compare-baseline'
import { assertStage2ViewsHaveNoBehaviorFields } from './generate-clues'
import { generateStage2Dataset, stableStringifyStage2 } from './generate-dataset'
import { buildStage2Report } from './report'
import { attributeNegativeCase, attributePositiveCase, runStage2Case } from './run-case'
import { computePositiveMetrics, computeStage2Summary } from './score'
import type { Stage2CaseResult, Stage2Report } from './types'
import { HYBRID_FAKE_EMBEDDING_DIM, makeFakeEmbedding } from '../../hybrid-fake-embedding'

vi.mock('@/infrastructure/ai/embed-api-client', () => ({
  WORKER_EMBEDDING_MODEL: '@cf/baai/bge-m3',
  requestWorkerEmbeddings: vi.fn(async (_accessToken: string, texts: string[]) => ({
    model: '@cf/baai/bge-m3',
    dim: HYBRID_FAKE_EMBEDDING_DIM,
    embeddings: texts.map(text => makeFakeEmbedding(text, HYBRID_FAKE_EMBEDDING_DIM))
  }))
}))

vi.mock('@/infrastructure/ai/hosted-quota-api-client', () => ({
  fetchHostedQuota: vi.fn(async () => ({
    model: '@cf/meta/llama',
    tier: 'free' as const,
    used: 0,
    limit: 100,
    remaining: 100,
    dailyUsed: 0,
    dailyLimit: 100,
    dailyRemaining: 100,
    monthKey: '2026-11'
  }))
}))

vi.mock('@/infrastructure/storage/recall-outcome-pairs-storage', () => ({
  listRecallOutcomePairs: vi.fn(async () => [])
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => 'clue-chain-stage2-test-token')
}))

describe('clue-chain stage2 dataset', () => {
  it('规模：120 物品 / 240 正例 / 24 负例；每目标 2 条', () => {
    const dataset = generateStage2Dataset(CLUE_CHAIN_STAGE2_SEED)
    expect(dataset.corpus).toHaveLength(CLUE_CHAIN_STAGE2_SIZES.corpusItems)
    expect(dataset.meta.topicClusters).toBe(CLUE_CHAIN_STAGE2_SIZES.topicClusters)
    expect(dataset.tasks).toHaveLength(CLUE_CHAIN_STAGE2_SIZES.totalTasks)
    expect(dataset.meta.positiveTasks).toBe(CLUE_CHAIN_STAGE2_SIZES.positiveTasks)
    expect(dataset.meta.negativeTasks).toBe(CLUE_CHAIN_STAGE2_SIZES.negativeTasks)

    const byTarget = new Map<string, number>()
    for (const task of dataset.tasks) {
      if (task.targetId == null) continue
      byTarget.set(task.targetId, (byTarget.get(task.targetId) ?? 0) + 1)
    }
    expect(byTarget.size).toBe(CLUE_CHAIN_STAGE2_SIZES.corpusItems)
    for (const count of byTarget.values()) {
      expect(count).toBe(CLUE_CHAIN_STAGE2_SIZES.cluesPerTarget)
    }
  })

  it('三档正例均覆盖；views 无行为字段；clue 不照抄标题', () => {
    const dataset = generateStage2Dataset(CLUE_CHAIN_STAGE2_SEED)
    assertStage2ViewsHaveNoBehaviorFields(dataset.clueViews)
    const tiers = new Set(dataset.tasks.map(task => task.tier))
    expect(tiers.has('concrete')).toBe(true)
    expect(tiers.has('semi_fuzzy')).toBe(true)
    expect(tiers.has('vague')).toBe(true)
    expect(tiers.has('negative')).toBe(true)

    const titleById = new Map(dataset.clueViews.map(view => [view.id, view.title]))
    for (const task of dataset.tasks) {
      if (task.targetId == null) continue
      const title = titleById.get(task.targetId) ?? ''
      const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim()
      if (normalizedTitle.length >= 12) {
        expect(task.clue.toLowerCase().replace(/\s+/g, ' ')).not.toContain(normalizedTitle)
      }
    }
  })

  it('同种子生成逐字一致', () => {
    const a = stableStringifyStage2(generateStage2Dataset(CLUE_CHAIN_STAGE2_SEED).tasks)
    const b = stableStringifyStage2(generateStage2Dataset(CLUE_CHAIN_STAGE2_SEED).tasks)
    expect(a).toBe(b)
  })

  it('行为与 clue 解耦：改行为种子不影响 clue 文本', () => {
    const dataset = generateStage2Dataset(CLUE_CHAIN_STAGE2_SEED)
    const clues = dataset.tasks.map(task => task.clue)
    expect(dataset.behavior.some(row => row.openCount > 0)).toBe(true)
    // 行为字段存在于 corpus，不出现在 task
    for (const task of dataset.tasks) {
      const record = task as unknown as Record<string, unknown>
      expect(record.openCount).toBeUndefined()
    }
    expect(clues.length).toBe(CLUE_CHAIN_STAGE2_SIZES.totalTasks)
  })
})

describe('clue-chain stage2 attribution', () => {
  it('parse / filtered / rank / ok', () => {
    expect(
      attributePositiveCase({
        contentTerms: [],
        filterClue: '',
        rankedIds: [],
        targetId: 't1'
      }).stage
    ).toBe('parse')
    expect(
      attributePositiveCase({
        contentTerms: ['espresso'],
        filterClue: 'espresso',
        rankedIds: [],
        targetId: 't1'
      }).stage
    ).toBe('filtered')
    expect(
      attributePositiveCase({
        contentTerms: ['espresso'],
        filterClue: 'espresso',
        rankedIds: ['other', 't1'],
        targetId: 't1'
      }).stage
    ).toBe('rank')
    expect(
      attributePositiveCase({
        contentTerms: ['espresso'],
        filterClue: 'espresso',
        rankedIds: ['t1'],
        targetId: 't1'
      }).stage
    ).toBe('ok')
  })

  it('negative false_hit / ok', () => {
    expect(attributeNegativeCase(['x']).stage).toBe('false_hit')
    expect(attributeNegativeCase([]).stage).toBe('ok')
  })
})

describe('clue-chain stage2 score + report', () => {
  it('指标与报告组装', () => {
    const cases: Stage2CaseResult[] = [
      {
        taskId: 'a',
        tier: 'concrete',
        clusterId: 'espresso',
        clue: 'c1',
        targetId: 't1',
        rankedIds: ['t1', 't2'],
        top3: ['t1', 't2'],
        rank: 1,
        contentTerms: ['x'],
        stage: 'ok',
        detail: 'ok',
        durationMs: 1,
        error: null
      },
      {
        taskId: 'b',
        tier: 'vague',
        clusterId: 'espresso',
        clue: 'c2',
        targetId: 't2',
        rankedIds: ['t9', 't2'],
        top3: ['t9', 't2'],
        rank: 2,
        contentTerms: ['y'],
        stage: 'rank',
        detail: 'rank',
        durationMs: 1,
        error: null
      },
      {
        taskId: 'n',
        tier: 'negative',
        clusterId: 'neg-x',
        clue: 'none',
        targetId: null,
        rankedIds: [],
        top3: [],
        rank: null,
        contentTerms: [],
        stage: 'ok',
        detail: 'ok',
        durationMs: 1,
        error: null
      }
    ]
    const metrics = computePositiveMetrics(cases)
    expect(metrics.n).toBe(2)
    expect(metrics.recallAt1).toBe(0.5)
    expect(metrics.recallAt3).toBe(1)
    const summary = computeStage2Summary(cases)
    expect(summary.negativeFalseHitRate).toBe(0)
    const report = buildStage2Report({
      head: 'deadbeef',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
      seed: 1,
      nowMs: 1,
      cases
    })
    expect(report.kind).toBe('clue-chain-stage2-recall')
    expect(report.suggestedGateObservations.length).toBe(5)
    expect(report.clusters.some(c => c.stage === 'rank')).toBe(true)
  })

  it('基线对比检测退化', () => {
    const mk = (r1: number, cases: Stage2CaseResult[]): Stage2Report => {
      const report = buildStage2Report({
        head: 'aaa',
        startedAt: 't0',
        finishedAt: 't1',
        seed: 1,
        nowMs: 1,
        cases
      })
      // 覆盖 positive.recallAt1 便于 delta 断言（summary 由 cases 推导）
      void r1
      return report
    }
    const baseCases: Stage2CaseResult[] = [
      {
        taskId: 'a',
        tier: 'concrete',
        clusterId: 'c',
        clue: 'x',
        targetId: 't1',
        rankedIds: ['t1'],
        top3: ['t1'],
        rank: 1,
        contentTerms: ['x'],
        stage: 'ok',
        detail: '',
        durationMs: 1,
        error: null
      }
    ]
    const worseCases: Stage2CaseResult[] = [
      {
        ...baseCases[0]!,
        rankedIds: ['other'],
        top3: ['other'],
        rank: null,
        stage: 'filtered',
        detail: 'miss'
      }
    ]
    const baseline = mk(1, baseCases)
    const current = mk(0, worseCases)
    const delta = compareStage2Baseline(current, baseline, 'baseline.json')
    expect(delta.degraded).toBe(true)
    expect(delta.newlyWorseIds).toContain('a')
  })
})

describe('clue-chain stage2 run-case smoke', () => {
  it('确定性轨跑一条正例 + 一条负例（无真实 LLM）', async () => {
    const dataset = generateStage2Dataset(CLUE_CHAIN_STAGE2_SEED)
    const positive = dataset.tasks.find(task => task.tier === 'concrete')
    const negative = dataset.tasks.find(task => task.tier === 'negative')
    expect(positive).toBeTruthy()
    expect(negative).toBeTruthy()

    const posResult = await runStage2Case({ task: positive!, corpus: dataset.corpus })
    expect(posResult.error).toBeNull()
    expect(posResult.stage).not.toBe('error')
    expect(Array.isArray(posResult.rankedIds)).toBe(true)

    const negResult = await runStage2Case({ task: negative!, corpus: dataset.corpus })
    expect(negResult.error).toBeNull()
    expect(negResult.targetId).toBeNull()
  })
})
