/**
 * Phase 4.1 Stage 3 · 语义命题评估集（合成；不进 must）。
 * (e) 意译：零字面重叠 + 可控相似度；(f) 对抗：错误命题更高相似。
 */

import { makeDreamingEvalNote } from './dreaming-eval-corpus'
import { HYBRID_FAKE_EMBEDDING_DIM } from './hybrid-fake-embedding'
import { noteTextMatchesTerm } from '@/core/recall/note-match'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'

const DIM = HYBRID_FAKE_EMBEDDING_DIM

/** 构造单位向量（确定性）。 */
export function makeSeedUnitVector(seed: string, dim = DIM): number[] {
  const vector = new Array<number>(dim)
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < dim; i += 1) {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    vector[i] = ((h >>> 0) / 0xffffffff) * 2 - 1
  }
  return l2Normalize(vector)
}

/** 相对 target 精确余弦为 `cosine` 的单位向量（Gram–Schmidt）。 */
export function makeVectorAtCosine(
  target: readonly number[],
  cosine: number,
  orthoSeed: string
): number[] {
  const dim = target.length
  const t = l2Normalize(target)
  let ortho = makeSeedUnitVector(orthoSeed, dim)
  // 投影去除
  let dot = 0
  for (let i = 0; i < dim; i += 1) {
    dot += (ortho[i] ?? 0) * (t[i] ?? 0)
  }
  ortho = ortho.map((v, i) => v - dot * (t[i] ?? 0))
  ortho = l2Normalize(ortho)
  const s = Math.sqrt(Math.max(0, 1 - cosine * cosine))
  const mixed = t.map((v, i) => cosine * v + s * (ortho[i] ?? 0))
  return l2Normalize(mixed)
}

function l2Normalize(vector: readonly number[]): number[] {
  let sum = 0
  for (const v of vector) {
    sum += v * v
  }
  const norm = Math.sqrt(sum)
  if (norm === 0) {
    return [...vector]
  }
  return vector.map(v => v / norm)
}

export type SemanticParaphraseCase = {
  id: string
  category: 'paraphrase'
  /** 查询 content terms（须与命题零字面重叠）。 */
  contentTerms: string[]
  clue: string
  note: MemoryNoteRecord
  /** 注记：是否跨语言子集。 */
  crossLingual?: boolean
  /** 查询相对命题向量的标定余弦。 */
  queryCosine: number
  noteEmbedding: number[]
  queryVector: number[]
}

export type SemanticAdversarialCase = {
  id: string
  category: 'adversarial'
  contentTerms: string[]
  clue: string
  correctNote: MemoryNoteRecord
  wrongNote: MemoryNoteRecord
  correctEmbedding: number[]
  wrongEmbedding: number[]
  queryVector: number[]
  /** 错误命题相对查询的标定余弦（应低于意译，高于正确）。 */
  wrongCosine: number
  correctCosine: number
}

const OWNER_SRC_E = {
  e01: '11111111-1111-4111-8111-111111111201',
  e02: '11111111-1111-4111-8111-111111111202',
  e03: '11111111-1111-4111-8111-111111111203',
  e04: '11111111-1111-4111-8111-111111111204',
  e05: '11111111-1111-4111-8111-111111111205',
  e06: '11111111-1111-4111-8111-111111111206'
} as const

const OWNER_SRC_F = {
  f01c: '11111111-1111-4111-8111-111111111211',
  f01w: '11111111-1111-4111-8111-111111111212',
  f02c: '11111111-1111-4111-8111-111111111213',
  f02w: '11111111-1111-4111-8111-111111111214',
  f03c: '11111111-1111-4111-8111-111111111215',
  f03w: '11111111-1111-4111-8111-111111111216',
  f04c: '11111111-1111-4111-8111-111111111217',
  f04w: '11111111-1111-4111-8111-111111111218',
  f05c: '11111111-1111-4111-8111-111111111219',
  f05w: '11111111-1111-4111-8111-111111111220'
} as const

const UPDATED = '2026-08-01T00:00:00.000Z'

function paraphraseCase(input: {
  id: string
  sourceId: string
  noteText: string
  sourceQuote: string
  clue: string
  contentTerms: string[]
  queryCosine: number
  crossLingual?: boolean
}): SemanticParaphraseCase {
  const note = makeDreamingEvalNote({
    sourceId: input.sourceId,
    index: 0,
    text: input.noteText,
    sourceQuote: input.sourceQuote,
    sourceUpdatedAt: UPDATED,
    sourceType: 'text_excerpt'
  })
  const noteEmbedding = makeSeedUnitVector(`note:${input.id}`)
  const queryVector = makeVectorAtCosine(noteEmbedding, input.queryCosine, `query:${input.id}`)
  return {
    id: input.id,
    category: 'paraphrase',
    contentTerms: input.contentTerms,
    clue: input.clue,
    note,
    ...(input.crossLingual ? { crossLingual: true } : {}),
    queryCosine: input.queryCosine,
    noteEmbedding,
    queryVector
  }
}

/** (e) 意译类 ≥5；含跨语言子集。 */
export const SEMANTIC_PARAPHRASE_CASES: SemanticParaphraseCase[] = [
  paraphraseCase({
    id: 'sem-e01-hostel',
    sourceId: OWNER_SRC_E.e01,
    noteText: 'The hostel in Fremantle costs $30 per night.',
    sourceQuote: 'hostel costs $30 per night',
    clue: 'cheap place to stay near the beach',
    contentTerms: ['cheap', 'place', 'stay', 'beach'],
    queryCosine: 0.74
  }),
  paraphraseCase({
    id: 'sem-e02-macbook-zh',
    sourceId: OWNER_SRC_E.e02,
    noteText: 'The MacBook Pro M4 lasts up to 24 hours on a single charge.',
    sourceQuote: 'lasts up to 24 hours on a single charge',
    clue: '那台续航很久的苹果笔记本',
    contentTerms: ['续航', '苹果', '笔记本'],
    queryCosine: 0.78,
    crossLingual: true
  }),
  paraphraseCase({
    id: 'sem-e03-ferry',
    sourceId: OWNER_SRC_E.e03,
    noteText: 'Passenger ferry to the island leaves every hour from the harbor.',
    sourceQuote: 'ferry leaves every hour from the harbor',
    clue: 'boat schedule to get across the water',
    contentTerms: ['boat', 'schedule', 'water'],
    queryCosine: 0.7
  }),
  paraphraseCase({
    id: 'sem-e04-sourdough',
    sourceId: OWNER_SRC_E.e04,
    noteText: 'Sourdough starter needs feeding twice a week with flour and water.',
    sourceQuote: 'starter needs feeding twice a week',
    clue: 'how often to nourish the bread culture',
    contentTerms: ['nourish', 'bread', 'culture'],
    queryCosine: 0.66
  }),
  paraphraseCase({
    id: 'sem-e05-aurora',
    sourceId: OWNER_SRC_E.e05,
    noteText: 'Northern lights often appear after midnight in clear winter skies.',
    sourceQuote: 'appear after midnight in clear winter skies',
    clue: 'glowing sky colors late at night in cold season',
    contentTerms: ['glowing', 'sky', 'colors', 'cold', 'season'],
    queryCosine: 0.72
  }),
  paraphraseCase({
    id: 'sem-e06-battery-zh',
    sourceId: OWNER_SRC_E.e06,
    noteText: 'The camera battery pack lasts about four days of mixed shooting.',
    sourceQuote: 'battery pack lasts about four days',
    clue: '相机电池能撑好几天',
    contentTerms: ['相机', '电池', '几天'],
    queryCosine: 0.8,
    crossLingual: true
  })
]

function adversarialCase(input: {
  id: string
  correctId: string
  wrongId: string
  correctText: string
  wrongText: string
  clue: string
  contentTerms: string[]
  wrongCosine: number
  correctCosine: number
}): SemanticAdversarialCase {
  const correctNote = makeDreamingEvalNote({
    sourceId: input.correctId,
    index: 0,
    text: input.correctText,
    sourceQuote: input.correctText.slice(0, 80),
    sourceUpdatedAt: UPDATED,
    sourceType: 'text_excerpt'
  })
  const wrongNote = makeDreamingEvalNote({
    sourceId: input.wrongId,
    index: 0,
    text: input.wrongText,
    sourceQuote: input.wrongText.slice(0, 80),
    sourceUpdatedAt: UPDATED,
    sourceType: 'text_excerpt'
  })
  const queryVector = makeSeedUnitVector(`adv-query:${input.id}`)
  return {
    id: input.id,
    category: 'adversarial',
    contentTerms: input.contentTerms,
    clue: input.clue,
    correctNote,
    wrongNote,
    queryVector,
    wrongCosine: input.wrongCosine,
    correctCosine: input.correctCosine,
    wrongEmbedding: makeVectorAtCosine(queryVector, input.wrongCosine, `wrong:${input.id}`),
    correctEmbedding: makeVectorAtCosine(queryVector, input.correctCosine, `correct:${input.id}`)
  }
}

/** (f) 对抗类 ≥5：同主题不同实体，错误命题更近。 */
export const SEMANTIC_ADVERSARIAL_CASES: SemanticAdversarialCase[] = [
  adversarialCase({
    id: 'sem-f01-hostel-vs-hotel',
    correctId: OWNER_SRC_F.f01c,
    wrongId: OWNER_SRC_F.f01w,
    correctText: 'The Fremantle backpacker dorm is thirty dollars a night.',
    wrongText: 'The Ritz downtown suite starts at four hundred a night.',
    clue: 'budget lodging by the waterfront',
    contentTerms: ['budget', 'lodging', 'waterfront'],
    wrongCosine: 0.58,
    correctCosine: 0.42
  }),
  adversarialCase({
    id: 'sem-f02-mac-vs-thinkpad',
    correctId: OWNER_SRC_F.f02c,
    wrongId: OWNER_SRC_F.f02w,
    // 故意不含查询词 battery（纯度：对抗正确命题不得与 contentTerms 字面重叠）
    correctText: 'MacBook Pro M4 keeps going through a full workday plus commute.',
    wrongText: 'ThinkPad X1 lasts about nine hours on mixed office use.',
    clue: 'long lasting apple laptop battery',
    contentTerms: ['long', 'apple', 'laptop', 'battery'],
    wrongCosine: 0.55,
    correctCosine: 0.4
  }),
  adversarialCase({
    id: 'sem-f03-ferry-vs-flight',
    correctId: OWNER_SRC_F.f03c,
    wrongId: OWNER_SRC_F.f03w,
    // 故意不含 ticket/tickets（纯度）
    correctText: 'Island ferry passes are sold at the harbor kiosk.',
    wrongText: 'Domestic flight check-in opens two hours before departure.',
    clue: 'boat ticket booth near the docks',
    contentTerms: ['boat', 'ticket', 'docks'],
    wrongCosine: 0.52,
    correctCosine: 0.38
  }),
  adversarialCase({
    id: 'sem-f04-sourdough-vs-yeast',
    correctId: OWNER_SRC_F.f04c,
    wrongId: OWNER_SRC_F.f04w,
    correctText: 'Sourdough culture prefers room temperature and weekly feeds.',
    wrongText: 'Instant yeast packets work best for same-day sandwich loaves.',
    clue: 'natural bread starter care tips',
    contentTerms: ['natural', 'bread', 'starter'],
    wrongCosine: 0.6,
    correctCosine: 0.45
  }),
  adversarialCase({
    id: 'sem-f05-aurora-vs-eclipse',
    correctId: OWNER_SRC_F.f05c,
    wrongId: OWNER_SRC_F.f05w,
    // 正确命题去掉 winter；错误命题去掉 sky（纯度）
    correctText: 'Aurora forecasts peak around the December solstice at high latitude.',
    wrongText: 'Solar eclipse viewing needs certified glasses and clear midday weather.',
    clue: 'night sky green ribbons in winter',
    contentTerms: ['night', 'sky', 'green', 'ribbons', 'winter'],
    wrongCosine: 0.57,
    correctCosine: 0.41
  })
]

/** 断言意译用例零字面重叠（评估前提）。 */
export function assertParaphraseZeroLiteralOverlap(cases = SEMANTIC_PARAPHRASE_CASES): void {
  for (const c of cases) {
    for (const term of c.contentTerms) {
      if (noteTextMatchesTerm(c.note, term)) {
        throw new Error(`${c.id}: term "${term}" 与命题字面重叠，违反意译前提`)
      }
    }
  }
}
