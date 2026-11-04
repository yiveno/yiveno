/**
 * diversity / cluster 线索生成（与内容生成分离；独立 rng 流）。
 * 禁止从 note / snippet 原文截取拼装；associative/temporal 须零内容词重叠。
 */

import { rngForFillerItem, type SeededRng } from './prng'
import type { ProbeClueType, ProbeTypedClue, RecallProbePersonaId } from './types'

/**
 * 英文小停用词 + 线索脚手架词（时间/指代模板用词不计入内容重叠）。
 * 脚手架词故意偏宽：避免 temporal 模板的 last/week/month 与附注偶然撞车。
 */
const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'ahead',
  'also',
  'annotated',
  'around',
  'been',
  'before',
  'being',
  'between',
  'both',
  'bookmark',
  'clip',
  'couple',
  'could',
  'days',
  'does',
  'doing',
  'down',
  'each',
  'early',
  'follow',
  'from',
  'have',
  'having',
  'held',
  'here',
  'into',
  'item',
  'just',
  'kept',
  'last',
  'late',
  'later',
  'left',
  'like',
  'link',
  'marked',
  'month',
  'months',
  'more',
  'most',
  'much',
  'note',
  'noted',
  'only',
  'other',
  'over',
  'own',
  'page',
  'parked',
  'personal',
  'piece',
  'private',
  'reading',
  'recently',
  'reminder',
  'same',
  'saved',
  'short',
  'should',
  'site',
  'some',
  'such',
  'tagged',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'thing',
  'this',
  'those',
  'through',
  'under',
  'very',
  'week',
  'weeks',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'write',
  'your'
])

/** 小写 alphabetic token、长度 ≥ 4、去停用词。 */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>()
  const matches = text.toLowerCase().match(/[a-z]{4,}/g) ?? []
  for (const token of matches) {
    if (!STOPWORDS.has(token)) {
      out.add(token)
    }
  }
  return out
}

export function contentWordIntersection(a: string, b: string): string[] {
  const left = contentWords(a)
  const right = contentWords(b)
  const hit: string[] = []
  for (const word of left) {
    if (right.has(word)) {
      hit.push(word)
    }
  }
  return hit
}

export type ClueGenItemMeta = {
  persona: RecallProbePersonaId
  kind: 'bookmark' | 'excerpt'
  index: number
  seed: number
  title: string
  subject: string
  note?: string | undefined
  daysAgo: number
  host?: string | undefined
  sceneFragments: readonly string[]
}

const TEMPORAL_PHRASES = [
  'from a few days ago',
  'I saved last week',
  'around early this month',
  'from late last month',
  'I parked recently',
  'from a couple weeks back'
] as const

const NOTE_REWRITES = [
  'the page I annotated for later follow-up',
  'bookmark where I left a private reminder',
  'clip I tagged with my own follow-up note',
  'item I marked with a short personal cue'
] as const

function hostLabel(host: string | undefined): string {
  if (!host) {
    return 'that site'
  }
  try {
    const hostname = new URL(host).hostname.replace(/^www\./, '')
    return hostname.split('.')[0] || 'that site'
  } catch {
    return 'that site'
  }
}

function daysPhrase(daysAgo: number): string {
  if (daysAgo <= 3) {
    return 'from a couple days ago'
  }
  if (daysAgo <= 14) {
    return 'from last week'
  }
  if (daysAgo <= 45) {
    return 'from last month'
  }
  return 'from a while back'
}

/** 兜底场景（与各画像 PACKS 主题词刻意错开）。 */
const SAFE_SCENE_FALLBACK = 'during that quiet evening at home'

/**
 * 挑选与条目内容词零重叠的场景片段；耗尽则用兜底句。
 * 仍消耗 rng（确定性）。
 */
function pickScene(rng: SeededRng, scenes: readonly string[], corpus: string): string {
  if (scenes.length === 0) {
    return SAFE_SCENE_FALLBACK
  }
  const order = scenes.map((_, i) => i)
  // 打乱索引顺序（Fisher–Yates，确定性）
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1)
    const tmp = order[i]!
    order[i] = order[j]!
    order[j] = tmp
  }
  for (const idx of order) {
    const scene = scenes[idx]!
    if (contentWordIntersection(scene, corpus).length === 0) {
      return scene
    }
  }
  return SAFE_SCENE_FALLBACK
}

function buildAssociative(rng: SeededRng, meta: ClueGenItemMeta): string {
  const corpus = `${meta.title} ${meta.subject} ${meta.note ?? ''}`
  const scene = pickScene(rng, meta.sceneFragments, corpus)
  const templates = [
    `thing I saved ${scene}`,
    `bookmark kept ${scene}`,
    `clip parked ${scene}`,
    `page I held onto ${scene}`
  ] as const
  return rng.pick(templates)
}

function buildTemporal(rng: SeededRng, meta: ClueGenItemMeta): string {
  const corpus = `${meta.title} ${meta.subject} ${meta.note ?? ''}`
  const scene = pickScene(rng, meta.sceneFragments, corpus)
  const when = rng.next() < 0.5 ? daysPhrase(meta.daysAgo) : rng.pick(TEMPORAL_PHRASES)
  return `item ${when} ${scene}`
}

function buildParaphrase(rng: SeededRng, meta: ClueGenItemMeta): string {
  const corpus = `${meta.title} ${meta.subject} ${meta.note ?? ''}`
  const scene = pickScene(rng, meta.sceneFragments, corpus)
  const host = hostLabel(meta.host)
  const templates = [
    `write-up from ${host} I kept ${scene}`,
    `reading from ${host} parked ${scene}`,
    `${host} link I held ${scene}`
  ] as const
  return rng.pick(templates)
}

function buildNoteClue(rng: SeededRng, meta: ClueGenItemMeta): string {
  const corpus = `${meta.title} ${meta.subject} ${meta.note ?? ''}`
  const scene = pickScene(rng, meta.sceneFragments, corpus)
  // 场景化改写：指向 note 语义，不整段复制 note 原文
  const base = rng.pick(NOTE_REWRITES)
  return `${base} ${scene}`
}

function buildVerbatim(meta: ClueGenItemMeta): string {
  const subject = meta.subject.trim()
  if (subject.length > 0) {
    return `page about ${subject}`
  }
  return `bookmark titled ${meta.title.slice(0, 48)}`
}

function assertOverlapRules(clue: ProbeTypedClue, meta: ClueGenItemMeta): void {
  const corpus = `${meta.title} ${meta.subject} ${meta.note ?? ''}`
  if (clue.type === 'associative' || clue.type === 'temporal') {
    const hit = contentWordIntersection(clue.text, corpus)
    if (hit.length > 0) {
      // 生成侧兜底：不应发生；单测会直接失败
      throw new Error(`clue-gen ${clue.type} 与条目内容词重叠：${hit.join(',')} · ${clue.text}`)
    }
  }
  if (clue.type === 'paraphrase') {
    const subject = meta.subject.trim().toLowerCase()
    if (subject.length >= 4 && clue.text.toLowerCase().includes(subject)) {
      throw new Error(`clue-gen paraphrase 含完整 subject：${meta.subject}`)
    }
    if (meta.note && clue.text.includes(meta.note)) {
      throw new Error('clue-gen paraphrase 含 note 原文子串')
    }
  }
}

/**
 * 为 diversity 条目生成类型化线索。
 * rng 流键：`clue`（与内容流 div-bm / div-ex 隔离）。
 */
export function generateDiversityClues(meta: ClueGenItemMeta): ProbeTypedClue[] {
  const rng = rngForFillerItem(meta.seed, 'clue', meta.index, meta.persona)
  const out: ProbeTypedClue[] = []

  if (meta.note) {
    const noteClue: ProbeTypedClue = { text: buildNoteClue(rng, meta), type: 'note' }
    out.push(noteClue)
  }

  const sceneTypes: Array<'paraphrase' | 'associative' | 'temporal'> = [
    'paraphrase',
    'associative',
    'temporal'
  ]
  const sceneType = rng.pick(sceneTypes)
  let sceneText: string
  if (sceneType === 'associative') {
    sceneText = buildAssociative(rng, meta)
  } else if (sceneType === 'temporal') {
    sceneText = buildTemporal(rng, meta)
  } else {
    sceneText = buildParaphrase(rng, meta)
  }
  const sceneClue: ProbeTypedClue = { text: sceneText, type: sceneType }
  assertOverlapRules(sceneClue, meta)
  out.push(sceneClue)

  // 可选 verbatim ≈ 1/3
  if (rng.next() < 1 / 3) {
    const verbatim: ProbeTypedClue = { text: buildVerbatim(meta), type: 'verbatim' }
    out.push(verbatim)
  }

  // 无 note 时至少已有 1 条场景型；有 note 时至少 2 条
  return out
}

/** 供单测：指定类型强制生成一条（仍走 clue rng 流）。 */
export function generateForcedClue(
  meta: ClueGenItemMeta,
  type: Extract<ProbeClueType, 'associative' | 'temporal' | 'paraphrase'>
): ProbeTypedClue {
  const rng = rngForFillerItem(meta.seed, 'clue', meta.index, meta.persona)
  let text: string
  if (type === 'associative') {
    text = buildAssociative(rng, meta)
  } else if (type === 'temporal') {
    text = buildTemporal(rng, meta)
  } else {
    text = buildParaphrase(rng, meta)
  }
  const clue: ProbeTypedClue = { text, type }
  assertOverlapRules(clue, meta)
  return clue
}
