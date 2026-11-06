/**
 * Probe 冻结夹具 → 离线关键词路径评测（M4）。
 * 假时钟；无网络 / 无 LLM / 无 Chrome。
 */

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import {
  judgeProbeNeighborhood,
  rankedIdsFromRecallResult,
  type ProbeVerifyVerdict
} from '@yiveno/probe'
import type { ProbeGeneratedFixture, ProbeGeneratedFixtureBaseline } from '@yiveno/probe'

/** 与 hybrid / recall-eval 同形的固定 owner。 */
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE_LOCAL_PROFILE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 由 probe key 派生稳定 UUID（可复现；仅评测用）。 */
export function stableProbeEvalItemId(key: string): string {
  const a = fnv1a(key).toString(16).padStart(8, '0')
  const b = fnv1a(`${key}#1`).toString(16).padStart(8, '0')
  const c = fnv1a(`${key}#2`).toString(16).padStart(8, '0')
  const d = fnv1a(`${key}#3`).toString(16).padStart(8, '0')
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`
}

function daysAgoIso(daysAgo: number, nowMs: number): string {
  return new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

/** 夹具 items → MemoryItem[]（稳定 id）。 */
export function buildCorpusFromProbeGeneratedFixture(
  fixture: ProbeGeneratedFixture,
  nowMs: number = RECALL_EVAL_NOW_MS
): { corpus: MemoryItem[]; keyToId: Map<string, string> } {
  const keyToId = new Map<string, string>()
  const corpus: MemoryItem[] = []

  for (const row of fixture.items) {
    const id = stableProbeEvalItemId(row.key)
    keyToId.set(row.key, id)
    const at = daysAgoIso(row.daysAgo, nowMs)
    if (row.kind === 'bookmark') {
      const item = createBookmarkMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        captureEntry: 'sync',
        payload: { title: row.title, url: row.url },
        ...(row.note ? { clues: { note: row.note } } : {}),
        now: () => at
      })
      corpus.push({ ...item, id, createdAt: at, updatedAt: at })
    } else {
      const item = createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        captureEntry: 'selection_toolbar',
        payload: {
          pageTitle: row.title,
          sourceUrl: row.url,
          selectedText: row.selectedText ?? ''
        },
        ...(row.note ? { clues: { note: row.note } } : {}),
        now: () => at
      })
      corpus.push({ ...item, id, createdAt: at, updatedAt: at })
    }
  }

  return { corpus, keyToId }
}

export type ProbeGeneratedEvalCaseRow = {
  caseId: string
  clue: string
  expectedKey: string
  verdict: ProbeVerifyVerdict | 'unmapped'
}

export type ProbeGeneratedEvalReport = {
  judged: number
  top1: number
  inTopk: number
  miss: number
  unmapped: number
  top1Rate: number
  inTop3Rate: number
  cases: ProbeGeneratedEvalCaseRow[]
}

/** 对冻结夹具跑关键词路径 + 邻域判定（k=3）。 */
export function runProbeGeneratedEval(
  fixture: ProbeGeneratedFixture,
  nowMs: number = RECALL_EVAL_NOW_MS
): ProbeGeneratedEvalReport {
  const { corpus, keyToId } = buildCorpusFromProbeGeneratedFixture(fixture, nowMs)
  const cases: ProbeGeneratedEvalCaseRow[] = []
  let top1 = 0
  let inTopk = 0
  let miss = 0
  let unmapped = 0

  for (const row of fixture.cases) {
    const expectedId = keyToId.get(row.expectedKey)
    if (!expectedId) {
      unmapped += 1
      cases.push({
        caseId: row.caseId,
        clue: row.clue,
        expectedKey: row.expectedKey,
        verdict: 'unmapped'
      })
      continue
    }
    const parsed = parseRecallClue(row.clue, { nowMs })
    const result = recallByKeywordWithParsedClue(corpus, row.clue, {
      nowMs,
      parsed
    })
    const verdict = judgeProbeNeighborhood(rankedIdsFromRecallResult(result), expectedId, 3)
    if (verdict === 'top1') top1 += 1
    else if (verdict === 'in_topk') inTopk += 1
    else miss += 1
    cases.push({
      caseId: row.caseId,
      clue: row.clue,
      expectedKey: row.expectedKey,
      verdict
    })
  }

  const judged = top1 + inTopk + miss
  return {
    judged,
    top1,
    inTopk,
    miss,
    unmapped,
    top1Rate: judged === 0 ? 0 : top1 / judged,
    inTop3Rate: judged === 0 ? 0 : (top1 + inTopk) / judged,
    cases
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** 对照夹具基线：不得回退（率按四位小数对齐，避免浮点抖动）。 */
export function assertProbeGeneratedBaseline(
  report: ProbeGeneratedEvalReport,
  baseline: ProbeGeneratedFixtureBaseline
): void {
  if (report.judged < baseline.judged) {
    throw new Error(`probe-generated judged 回退：${report.judged} < baseline ${baseline.judged}`)
  }
  if (round4(report.top1Rate) < baseline.top1Rate) {
    throw new Error(
      `probe-generated top1Rate 回退：${round4(report.top1Rate)} < ${baseline.top1Rate}`
    )
  }
  if (round4(report.inTop3Rate) < baseline.inTop3Rate) {
    throw new Error(
      `probe-generated inTop3Rate 回退：${round4(report.inTop3Rate)} < ${baseline.inTop3Rate}`
    )
  }
}
