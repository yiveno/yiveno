/**
 * 行为层消融：数据集不变式 / 评分 / 四臂构造 / 生成可复现。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assertOffClearsBehaviorAndConditions, buildOffArm, buildOnProdArm } from './arms'
import { pairedBootstrapDeltaCi } from './bootstrap'
import { BEHAVIOR_ABLATION_SEED, BEHAVIOR_ABLATION_SIZES } from './constants'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  datasetToFixtureFiles,
  FIXTURE_FILE_NAMES,
  fixtureCanonicalString,
  fixtureFilesToDataset,
  type BehaviorAblationFixtureFiles
} from './fixtures-io'
import { generateBehaviorAblationDataset } from './generate-dataset'
import { assertClueViewsHaveNoBehaviorFields } from './generate-clues'
import { HYBRID_FAKE_EMBEDDING_DIM, makeFakeEmbedding } from '../hybrid-fake-embedding'
import { computeArmMetrics } from './score'
import { isFalseOpen } from './run-case'
import type { ArmCaseResult } from './types'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { BEHAVIOR_ABLATION_NOW_MS } from './constants'

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
  getWorkerApiAccessToken: vi.fn(async () => 'behavior-ablation-test-token')
}))

describe('behavior-ablation dataset', () => {
  it('规模与冲突子集计数冻结', () => {
    const dataset = generateBehaviorAblationDataset(BEHAVIOR_ABLATION_SEED)
    expect(dataset.corpus).toHaveLength(BEHAVIOR_ABLATION_SIZES.corpusItems)
    expect(dataset.meta.topicClusters).toBe(BEHAVIOR_ABLATION_SIZES.topicClusters)
    expect(dataset.mainTasks).toHaveLength(BEHAVIOR_ABLATION_SIZES.mainTasks)
    expect(dataset.conflictProdTasks).toHaveLength(BEHAVIOR_ABLATION_SIZES.conflictProd)
    expect(dataset.conflictMechTasks).toHaveLength(BEHAVIOR_ABLATION_SIZES.conflictMech)
    expect(dataset.behavior).toHaveLength(BEHAVIOR_ABLATION_SIZES.corpusItems)
  })

  it('clue fixture / views 不含行为字段', () => {
    const dataset = generateBehaviorAblationDataset(BEHAVIOR_ABLATION_SEED)
    assertClueViewsHaveNoBehaviorFields(dataset.clueViews)
    for (const task of [
      ...dataset.mainTasks,
      ...dataset.conflictProdTasks,
      ...dataset.conflictMechTasks
    ]) {
      const record = task as unknown as Record<string, unknown>
      expect(record.openCount).toBeUndefined()
      expect(record.settledCount).toBeUndefined()
      expect(record.dismissCount).toBeUndefined()
      expect(record.lastOpenedAt).toBeUndefined()
    }
  })

  it('同种子生成逐字一致', () => {
    const a = fixtureCanonicalString(datasetToFixtureFiles(generateBehaviorAblationDataset()))
    const b = fixtureCanonicalString(datasetToFixtureFiles(generateBehaviorAblationDataset()))
    expect(a).toBe(b)
  })

  it('入库 fixture 与生成器逐字一致', () => {
    const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures')
    const loaded: BehaviorAblationFixtureFiles = {
      meta: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.meta), 'utf8')),
      corpus: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.corpus), 'utf8')),
      behavior: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.behavior), 'utf8')),
      clueViews: JSON.parse(
        readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.clueViews), 'utf8')
      ),
      mainTasks: JSON.parse(
        readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.mainTasks), 'utf8')
      ),
      conflictProdTasks: JSON.parse(
        readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.conflictProdTasks), 'utf8')
      ),
      conflictMechTasks: JSON.parse(
        readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.conflictMechTasks), 'utf8')
      )
    }
    const regenerated = datasetToFixtureFiles(
      generateBehaviorAblationDataset(BEHAVIOR_ABLATION_SEED)
    )
    // JSON 往返后再比（fixture 落盘会丢掉 undefined 键）
    const roundTrip = (value: unknown) =>
      JSON.parse(JSON.stringify(value)) as BehaviorAblationFixtureFiles
    expect(fixtureCanonicalString(roundTrip(loaded))).toBe(
      fixtureCanonicalString(roundTrip(regenerated))
    )
    // 确保 loader 可还原
    expect(fixtureFilesToDataset(loaded).meta.corpusItems).toBe(BEHAVIOR_ABLATION_SIZES.corpusItems)
  })
})

describe('behavior-ablation scoring', () => {
  it('小样本指标与 bootstrap 已知值', () => {
    const cases: ArmCaseResult[] = [
      {
        taskId: 't1',
        arm: 'OFF',
        targetId: 'g1',
        rankedIds: ['x', 'g1'],
        rank: 2,
        candidateNonEmpty: true,
        falseOpen: true,
        top1Id: 'x'
      },
      {
        taskId: 't1',
        arm: 'ON-prod',
        targetId: 'g1',
        rankedIds: ['g1', 'x'],
        rank: 1,
        candidateNonEmpty: true,
        falseOpen: false,
        top1Id: 'g1'
      },
      {
        taskId: 't2',
        arm: 'OFF',
        targetId: 'g2',
        rankedIds: ['g2'],
        rank: 1,
        candidateNonEmpty: true,
        falseOpen: false,
        top1Id: 'g2'
      },
      {
        taskId: 't2',
        arm: 'ON-prod',
        targetId: 'g2',
        rankedIds: ['g2'],
        rank: 1,
        candidateNonEmpty: true,
        falseOpen: false,
        top1Id: 'g2'
      }
    ]

    const off = computeArmMetrics('OFF', cases)
    const on = computeArmMetrics('ON-prod', cases)
    expect(off.recallAt1).toBe(0.5)
    expect(on.recallAt1).toBe(1)
    // OFF：(1/2 + 1/1) / 2 = 0.75
    expect(off.mrr).toBeCloseTo(0.75, 5)
    expect(on.mrr).toBe(1)
    expect(isFalseOpen(['x', 'g1'], 'g1')).toBe(true)
    expect(isFalseOpen([], 'g1')).toBe(false)

    const ci = pairedBootstrapDeltaCi(
      [
        { a: 0, b: 1 },
        { a: 1, b: 1 }
      ],
      0x12345678,
      200
    )
    expect(ci.delta).toBeCloseTo(0.5, 5)
    expect(ci.ci95Lower).toBeLessThanOrEqual(ci.delta)
    expect(ci.ci95Upper).toBeGreaterThanOrEqual(ci.delta)
  })
})

describe('behavior-ablation arms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OFF 确实清零行为与条件', () => {
    const dataset = generateBehaviorAblationDataset(BEHAVIOR_ABLATION_SEED)
    const off = buildOffArm(dataset.corpus)
    assertOffClearsBehaviorAndConditions(off)
    // 对照：播种语料确有行为
    expect(dataset.corpus.some(item => (item.clues.openCount ?? 0) > 0)).toBe(true)

    const parsed = parseRecallClue(dataset.mainTasks[0]!.clue, { nowMs: BEHAVIOR_ABLATION_NOW_MS })
    const onProd = buildOnProdArm(dataset.corpus, parsed, BEHAVIOR_ABLATION_NOW_MS)
    expect(onProd.corpus.some(item => (item.clues.openCount ?? 0) > 0)).toBe(true)
  })
})
