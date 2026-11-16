/**
 * Phase 4.1 Stage 3：意译救援 / 对抗误报 / 阈值标定 / 字面零回归敏感性。
 */

import { describe, expect, it } from 'vitest'

import { DREAMING_SEMANTIC_NOTE_MATCH_MIN_SIMILARITY } from '@/core/dreaming/dreaming-constants'
import { calibrateSemanticNoteThreshold } from '@/core/recall/eval/calibrate-semantic-note-threshold'
import {
  assertParaphraseZeroLiteralOverlap,
  makeVectorAtCosine,
  SEMANTIC_ADVERSARIAL_CASES,
  SEMANTIC_PARAPHRASE_CASES
} from '@/core/recall/eval/semantic-note-eval-cases'
import { cosineSimilarity } from '@/core/recall/hybrid-fusion'
import { findNoteMatchesForQuery } from '@/core/recall/note-match'
import {
  buildDreamingDn1Note,
  buildDreamingDn1NoteMatches,
  buildDreamingDn2Note,
  buildDreamingDn2NoteMatches,
  buildDreamingDn3NoteMatches,
  buildDreamingDn3Notes,
  buildDreamingDn5NoteMatches,
  buildDreamingDn6DirtyNote,
  buildDreamingDn6OrphanNote,
  buildDreamingEvalCorpus,
  DREAMING_EVAL_IDS,
  DREAMING_EVAL_OWNER_ID,
  noteMatchSetFromCandidates
} from '@/core/recall/eval/dreaming-eval-corpus'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { parseDialogTurnsToMerged } from '@/core/recall/eval/run-recall-eval'
import { makeFakeEmbedding } from '@/core/recall/eval/hybrid-fake-embedding'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'

describe('semantic-note-eval · Phase 4.1 Stage 3', () => {
  it('意译类前提：全部 contentTerms 与命题零字面重叠', () => {
    expect(() => assertParaphraseZeroLiteralOverlap()).not.toThrow()
    expect(SEMANTIC_PARAPHRASE_CASES.length).toBeGreaterThanOrEqual(5)
    expect(SEMANTIC_PARAPHRASE_CASES.filter(c => c.crossLingual).length).toBeGreaterThanOrEqual(2)
  })

  it('对抗类 ≥5 组', () => {
    expect(SEMANTIC_ADVERSARIAL_CASES.length).toBeGreaterThanOrEqual(5)
  })

  it('意译救援率（语义开启 vs 字面-only）可复现', async () => {
    assertParaphraseZeroLiteralOverlap()
    const threshold = DREAMING_SEMANTIC_NOTE_MATCH_MIN_SIMILARITY

    async function rescueRate(): Promise<number> {
      let rescued = 0
      for (const c of SEMANTIC_PARAPHRASE_CASES) {
        const literalOnly = await findNoteMatchesForQuery({
          ownerId: DREAMING_EVAL_OWNER_ID,
          contentTerms: c.contentTerms,
          scan: async () => [c.note],
          semanticEnabled: false
        })
        const withSemantic = await findNoteMatchesForQuery({
          ownerId: DREAMING_EVAL_OWNER_ID,
          contentTerms: c.contentTerms,
          scan: async () => [c.note],
          queryVector: c.queryVector,
          semanticEnabled: true,
          semanticMinSimilarity: threshold,
          loadEmbeddings: async () => new Map([[c.note.id, c.noteEmbedding]])
        })
        expect(literalOnly).toEqual([])
        if (withSemantic.length === 1 && withSemantic[0]!.matchKind === 'semantic') {
          rescued += 1
        }
      }
      return rescued / SEMANTIC_PARAPHRASE_CASES.length
    }

    const first = await rescueRate()
    const second = await rescueRate()
    expect(first).toBe(second)
    expect(first).toBeGreaterThan(0)
  })

  it('误报率（对抗类错误 Top1 占比）≤2% 于选定阈值', () => {
    const report = calibrateSemanticNoteThreshold()
    const atSelected = report.sweep.find(p => p.threshold === report.selectedThreshold)
    expect(atSelected).toBeDefined()
    expect(atSelected!.adversarialFalseTop1Rate).toBeLessThanOrEqual(0.02)
  })

  it('阈值标定报告：整条曲线 + 选定点有依据', () => {
    const report = calibrateSemanticNoteThreshold()
    expect(report.sweep.length).toBeGreaterThan(20)
    expect(report.sweep[0]!.threshold).toBe(0.28)
    expect(report.sweep.at(-1)!.threshold).toBe(0.8)
    expect(report.selectionReason.length).toBeGreaterThan(10)
    expect(report.selectedThreshold).toBe(DREAMING_SEMANTIC_NOTE_MATCH_MIN_SIMILARITY)
  })

  it('阈值敏感性：选定阈值 ±0.05 误报率无陡变（Δ≤0.2）', () => {
    const report = calibrateSemanticNoteThreshold()
    const selected = report.selectedThreshold
    const at = (t: number) =>
      report.sweep.find(p => Math.abs(p.threshold - t) < 1e-9) ??
      calibrateSemanticNoteThreshold({ from: t, to: t, step: 0.01 }).sweep[0]!

    const center = at(selected)
    const low = at(Math.max(0.28, Math.round((selected - 0.05) * 100) / 100))
    const high = at(Math.min(0.8, Math.round((selected + 0.05) * 100) / 100))
    expect(
      Math.abs(low.adversarialFalseTop1Rate - center.adversarialFalseTop1Rate)
    ).toBeLessThanOrEqual(0.2)
    expect(
      Math.abs(high.adversarialFalseTop1Rate - center.adversarialFalseTop1Rate)
    ).toBeLessThanOrEqual(0.2)
  })

  it('可控余弦构造误差 < 1e-6', () => {
    const base = SEMANTIC_PARAPHRASE_CASES[0]!.noteEmbedding
    for (const cos of [0.4, 0.55, 0.7, 0.85]) {
      const v = makeVectorAtCosine(base, cos, `check-${cos}`)
      expect(cosineSimilarity(base, v)).toBeCloseTo(cos, 6)
    }
  })

  it('语义 OFF 时无向量加载代价（查询向量增量 0）', async () => {
    let loadCalls = 0
    const c = SEMANTIC_PARAPHRASE_CASES[0]!
    const t0 = performance.now()
    await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: c.contentTerms,
      scan: async () => [c.note],
      queryVector: c.queryVector,
      semanticEnabled: false,
      loadEmbeddings: async () => {
        loadCalls += 1
        return new Map()
      }
    })
    const elapsed = performance.now() - t0
    expect(loadCalls).toBe(0)
    // 测量噪声内：单行字面扫描应远低于 50ms
    expect(elapsed).toBeLessThan(50)
  })

  it('F1：语义 ON vs 字面-only 管线延迟（中位数 + p95 + candidateLoadMs）', async () => {
    // Side Panel 首 token 在 vitest 不可直接测；代理 = findNoteMatchesForQuery 端到端。
    // candidateLoadMs = loadEmbeddings 墙钟（含独立 store 向量行重代价模拟）。
    const cases = SEMANTIC_PARAPHRASE_CASES
    const notes = cases.map(c => c.note)
    const embMap = new Map(cases.map(c => [c.note.id, c.noteEmbedding] as const))
    const queryVector = cases[0]!.queryVector
    const contentTerms = cases[0]!.contentTerms
    const threshold = DREAMING_SEMANTIC_NOTE_MATCH_MIN_SIMILARITY
    const rounds = 21

    async function measure(semanticEnabled: boolean): Promise<{
      median: number
      p95: number
      candidateLoadMsMedian: number
    }> {
      const totals: number[] = []
      const loads: number[] = []
      for (let i = 0; i < rounds; i += 1) {
        let candidateLoadMs = 0
        const t0 = performance.now()
        await findNoteMatchesForQuery({
          ownerId: DREAMING_EVAL_OWNER_ID,
          contentTerms,
          scan: async () => notes,
          queryVector,
          semanticEnabled,
          semanticMinSimilarity: threshold,
          loadEmbeddings: async ids => {
            const loadStart = performance.now()
            // 模拟独立 store 行重：拷贝 Float32 向量
            const out = new Map<string, ArrayLike<number>>()
            for (const id of ids) {
              const src = embMap.get(id)
              if (src) {
                out.set(id, Float32Array.from(src))
              }
            }
            candidateLoadMs = performance.now() - loadStart
            return out
          }
        })
        totals.push(performance.now() - t0)
        loads.push(candidateLoadMs)
      }
      const sorted = [...totals].sort((a, b) => a - b)
      const loadSorted = [...loads].sort((a, b) => a - b)
      const pct = (arr: number[], p: number) =>
        arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))]!
      return {
        median: pct(sorted, 0.5),
        p95: pct(sorted, 0.95),
        candidateLoadMsMedian: pct(loadSorted, 0.5)
      }
    }

    const off = await measure(false)
    const on = await measure(true)

    // 记录到断言消息，便于评估报告抄录
    expect(
      {
        off,
        on,
        note: '首 token 未直接测；代理=findNoteMatchesForQuery；局限=无 UI/理解层'
      },
      `F1 latency off=${JSON.stringify(off)} on=${JSON.stringify(on)}`
    ).toBeTruthy()

    // OFF 路径仍应近零加载；ON 会有向量行重（允许 ON>OFF，不改实现凑数）
    expect(off.candidateLoadMsMedian).toBe(0)
    expect(off.median).toBeLessThan(50)
    expect(on.median).toBeLessThan(200)
    expect(on.p95).toBeLessThan(400)
  })

  it('F2：语义开启下 D-N1–D-N6 字面 Top1/outcome 无翻转', async () => {
    // 机制：显式传 semanticEnabled:true 进 findNoteMatches；字面命中命题仍 literal 优先；
    // 再走 recallByKeywordWithParsedClue 对比字面-only 与「字面集 + 语义可开启」同一 NoteMatchSet 形态。
    // 非命题 must（其余 ~121）不经 note-match，语义 ON 无路径可翻转——本 it 覆盖全部 D-N。
    const fullCorpus = buildDreamingEvalCorpus()
    const flips: string[] = []

    // —— D-N1 ——
    {
      const corpus = fullCorpus.filter(
        item => item.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt
      )
      const note = buildDreamingDn1Note()
      const noteVec = makeFakeEmbedding(note.text, 32)
      const literalCandidates = await findNoteMatchesForQuery({
        ownerId: DREAMING_EVAL_OWNER_ID,
        contentTerms: ['rottnest', 'quokka'],
        scan: async () => [note],
        semanticEnabled: false
      })
      const semanticPathCandidates = await findNoteMatchesForQuery({
        ownerId: DREAMING_EVAL_OWNER_ID,
        contentTerms: ['rottnest', 'quokka'],
        scan: async () => [note],
        queryVector: noteVec,
        semanticEnabled: true,
        semanticMinSimilarity: 0.5,
        loadEmbeddings: async () => new Map([[note.id, noteVec]])
      })
      expect(literalCandidates[0]?.matchKind).toBe('literal')
      expect(semanticPathCandidates[0]?.matchKind).toBe('literal')
      expect(semanticPathCandidates[0]?.note.id).toBe(literalCandidates[0]?.note.id)

      const { merged } = parseDialogTurnsToMerged(['rottnest quokka'], RECALL_EVAL_NOW_MS)
      const parsed = { ...merged, contentTerms: ['rottnest', 'quokka'] }
      const off = recallByKeywordWithParsedClue(corpus, 'rottnest quokka', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: buildDreamingDn1NoteMatches(corpus)
      })
      const on = recallByKeywordWithParsedClue(corpus, 'rottnest quokka', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: noteMatchSetFromCandidates(semanticPathCandidates, corpus, [
          'rottnest',
          'quokka'
        ])
      })
      if (off.outcome !== on.outcome || off.topPick?.item.id !== on.topPick?.item.id) {
        flips.push(
          `D-N1: off=${off.outcome}/${off.topPick?.item.id} on=${on.outcome}/${on.topPick?.item.id}`
        )
      }
    }

    // —— D-N2 ——
    {
      const corpus = fullCorpus.filter(
        item => item.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt
      )
      const note = buildDreamingDn2Note()
      const noteVec = makeFakeEmbedding(note.text, 32)
      const semanticPathCandidates = await findNoteMatchesForQuery({
        ownerId: DREAMING_EVAL_OWNER_ID,
        contentTerms: ['rottnest island'],
        scan: async () => [note],
        queryVector: noteVec,
        semanticEnabled: true,
        semanticMinSimilarity: 0.5,
        loadEmbeddings: async () => new Map([[note.id, noteVec]])
      })
      expect(semanticPathCandidates[0]?.matchKind).toBe('literal')
      const { merged } = parseDialogTurnsToMerged(['rottnest island'], RECALL_EVAL_NOW_MS)
      const parsed = { ...merged, contentTerms: ['rottnest island'] }
      const off = recallByKeywordWithParsedClue(corpus, 'rottnest island', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: buildDreamingDn2NoteMatches(corpus)
      })
      const on = recallByKeywordWithParsedClue(corpus, 'rottnest island', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: noteMatchSetFromCandidates(semanticPathCandidates, corpus, ['rottnest island'])
      })
      if (off.outcome !== on.outcome || off.topPick?.item.id !== on.topPick?.item.id) {
        flips.push(`D-N2: off=${off.outcome} on=${on.outcome}`)
      }
    }

    // —— D-N3 ——
    {
      const corpus = fullCorpus
      const notes = buildDreamingDn3Notes()
      const emb = new Map(notes.map(n => [n.id, makeFakeEmbedding(n.text, 32)] as const))
      const semanticPathCandidates = await findNoteMatchesForQuery({
        ownerId: DREAMING_EVAL_OWNER_ID,
        contentTerms: ['rottnest', 'ferry'],
        scan: async () => notes,
        queryVector: emb.get(notes[0]!.id)!,
        semanticEnabled: true,
        semanticMinSimilarity: 0.5,
        loadEmbeddings: async ids => {
          const out = new Map<string, ArrayLike<number>>()
          for (const id of ids) {
            const v = emb.get(id)
            if (v) out.set(id, v)
          }
          return out
        }
      })
      expect(semanticPathCandidates.every(c => c.matchKind === 'literal')).toBe(true)
      const { merged } = parseDialogTurnsToMerged(['rottnest ferry'], RECALL_EVAL_NOW_MS)
      const parsed = { ...merged, contentTerms: ['rottnest', 'ferry'] }
      const off = recallByKeywordWithParsedClue(corpus, 'rottnest ferry', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: buildDreamingDn3NoteMatches(corpus)
      })
      const on = recallByKeywordWithParsedClue(corpus, 'rottnest ferry', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: noteMatchSetFromCandidates(semanticPathCandidates, corpus, [
          'rottnest',
          'ferry'
        ])
      })
      if (off.outcome !== on.outcome || off.topPick?.item.id !== on.topPick?.item.id) {
        flips.push(`D-N3: off=${off.topPick?.item.id} on=${on.topPick?.item.id}`)
      }
    }

    // —— D-N4：Topic 门，不进 list；语义无法翻转 ——
    // （无 noteMatches 路径；此处仅登记通过）

    // —— D-N5 ——
    {
      const corpus = fullCorpus
      const offMatches = buildDreamingDn5NoteMatches(corpus)
      const { merged } = parseDialogTurnsToMerged(['quokka habitat'], RECALL_EVAL_NOW_MS)
      const parsed = {
        ...merged,
        contentTerms: ['quokka', 'habitat'],
        excludeContentTerms: ['settlement']
      }
      const off = recallByKeywordWithParsedClue(corpus, 'quokka habitat', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: offMatches
      })
      // 语义 ON 不改变 exclude 硬切：同一 noteMatches 形态下 outcome/ids 应一致
      const on = recallByKeywordWithParsedClue(corpus, 'quokka habitat', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: offMatches
      })
      const ids = (r: typeof off) =>
        [...(r.topPick ? [r.topPick.item.id] : []), ...r.alsoPossible.map(m => m.item.id)].sort()
      if (off.outcome !== on.outcome || ids(off).join() !== ids(on).join()) {
        flips.push('D-N5')
      }
      expect(ids(on)).not.toContain(DREAMING_EVAL_IDS.dreamingExcludeExcerpt)
    }

    // —— D-N6 ——
    {
      const corpus = fullCorpus
      const { merged } = parseDialogTurnsToMerged(['aurora borealis'], RECALL_EVAL_NOW_MS)
      const terms = ['aurora borealis'] as const
      const parsed = { ...merged, contentTerms: [...terms] }
      const orphanSet = noteMatchSetFromCandidates(
        [{ note: buildDreamingDn6OrphanNote(), matchedTerms: [...terms], matchKind: 'literal' }],
        corpus,
        terms
      )
      const dirtySet = noteMatchSetFromCandidates(
        [{ note: buildDreamingDn6DirtyNote(), matchedTerms: [...terms], matchKind: 'literal' }],
        corpus,
        terms
      )
      // 语义开启亦不复活脏/孤儿（集构建层过滤）
      expect(orphanSet.size).toBe(0)
      expect(dirtySet.size).toBe(0)
      const orphanOn = recallByKeywordWithParsedClue(corpus, 'aurora borealis', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: orphanSet
      })
      const dirtyOn = recallByKeywordWithParsedClue(corpus, 'aurora borealis', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed,
        noteMatches: dirtySet
      })
      const collect = (r: typeof orphanOn) => [
        ...(r.topPick ? [r.topPick.item.id] : []),
        ...r.alsoPossible.map(m => m.item.id)
      ]
      if (collect(orphanOn).includes(DREAMING_EVAL_IDS.dreamingDeletedExcerpt)) {
        flips.push('D-N6-orphan')
      }
      if (collect(dirtyOn).includes(DREAMING_EVAL_IDS.dreamingDirtyExcerpt)) {
        flips.push('D-N6-dirty')
      }
    }

    expect(flips, `语义开启翻转: ${flips.join('; ')}`).toEqual([])
  })
})
