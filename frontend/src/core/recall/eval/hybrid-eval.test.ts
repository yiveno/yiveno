/**
 * Hybrid Recall eval（CI 门禁）。
 *
 * 目标：
 * - 拦截 Hybrid 路径的「悄悄退化」（关键词 must 漏检的语义层退化）。
 * - 守住 R0：Hybrid 不得用语义近邻填空。
 * - 守住词面领先者保护、强语义近邻召回、佐证门抑制、ADR-011 时窗。
 *
 * 依赖替身：
 * - `requestWorkerEmbeddings` → 返回 hash-based deterministic fake vectors（无外网）。
 * - `listRecallOutcomePairs` → 返回 []（避免 chrome.storage 副作用）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HYBRID_EVAL_CASES } from '@/core/recall/eval/hybrid-eval-cases'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding
} from '@/core/recall/eval/hybrid-fake-embedding'
import { HYBRID_EVAL_IDS } from '@/core/recall/eval/hybrid-eval-ids'
import { buildHybridEvalCorpus } from '@/core/recall/eval/hybrid-eval-corpus'
import { runHybridEval } from '@/core/recall/eval/run-hybrid-eval'

// —— 模块级 mock：替换 embed fetch 与 outcome pairs storage ——

vi.mock('@/infrastructure/ai/embed-api-client', () => ({
  // 与生产同形；fake 维度由 HYBRID_FAKE_EMBEDDING_DIM 控制（与 corpus 同步）。
  WORKER_EMBEDDING_MODEL: '@cf/baai/bge-m3',
  requestWorkerEmbeddings: vi.fn(async (_accessToken: string, texts: string[]) => ({
    model: '@cf/baai/bge-m3',
    dim: HYBRID_FAKE_EMBEDDING_DIM,
    embeddings: texts.map(text => makeFakeEmbedding(text, HYBRID_FAKE_EMBEDDING_DIM))
  }))
}))

vi.mock('@/infrastructure/storage/recall-outcome-pairs-storage', () => ({
  listRecallOutcomePairs: vi.fn(async () => [])
}))

// Hybrid 路径会调 `getAuthSession` 走 chrome.storage.local；CI 在 jsdom 下没有 chrome，
// 直接返回有 token 的 session，让语义融合真正跑；Free/Pro 同档命中同一真路径。
const HYBRID_EVAL_AUTH_TOKEN = 'eval-fake-token'

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: vi.fn(async () => ({
    accessToken: HYBRID_EVAL_AUTH_TOKEN,
    ownerId: 'eval-owner-id',
    email: 'eval@yiveno.local',
    provider: 'clerk'
  })),
  setAuthSession: vi.fn(async () => {}),
  clearAuthSession: vi.fn(async () => {})
}))

describe('hybrid-eval', () => {
  beforeEach(() => {
    // 防止某个用例残留的 mock 计数影响下一次断言
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('corpus 使用稳定 ID 且无重复', () => {
    const corpus = buildHybridEvalCorpus()
    const ids = corpus.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(Object.values(HYBRID_EVAL_IDS)))
  })

  it('所有 corpus 项都已预填 fake embedding（让 Hybrid 路径真正跑得到）', () => {
    const corpus = buildHybridEvalCorpus()
    const missing = corpus
      .filter(item => !Array.isArray(item.clues.embedding) || item.clues.embedding.length === 0)
      .map(item => item.id)
    expect(missing).toEqual([])
  })

  it('must 门禁用例全部通过（语义层召回 + R0 + 词面保护 + 佐证门）', async () => {
    const report = await runHybridEval(HYBRID_EVAL_CASES)

    if (report.must.failed.length > 0) {
      const summary = report.must.failed
        .map(item => `- ${item.caseId} clue="${item.clue}": ${item.detail}`)
        .join('\n')
      throw new Error(
        `Hybrid must 用例失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`
      )
    }

    expect(report.must.passed).toBe(report.must.total)
  })

  it('R0 严格保真：Hybrid 不得用语义近邻填空（no_match 必须保持）', async () => {
    const r0Cases = HYBRID_EVAL_CASES.filter(c => c.gate === 'must' && c.id.startsWith('r0-'))
    const report = await runHybridEval(r0Cases)
    expect(report.must.passed).toBe(report.must.total)
    for (const item of report.cases) {
      expect(item.result?.outcome).toBe('no_match')
      expect(item.result?.topPick).toBeNull()
    }
  })

  it('stretch 用例汇报趋势（不挡门禁）', async () => {
    const report = await runHybridEval(HYBRID_EVAL_CASES)
    expect(report.stretch.total).toBeGreaterThan(0)
    expect(report.cases.filter(item => item.gate === 'stretch')).toHaveLength(report.stretch.total)
    const failedSummary = report.stretch.failed
      .map(item => `${item.caseId}: ${item.detail}`)
      .join('; ')
    console.info(
      `[hybrid-eval] stretch ${report.stretch.passed}/${report.stretch.total}` +
        (failedSummary ? ` | fail: ${failedSummary}` : '')
    )
  })
})
