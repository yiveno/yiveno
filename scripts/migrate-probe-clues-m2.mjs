/**
 * 一次性：精选语料 suggestedClues → clues: ProbeTypedClue[]（保守启发式标注）。
 * 运行：bun scripts/migrate-probe-clues-m2.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'packages/yiveno-probe/src/corpus')
const FILES = [
  'researcher.ts',
  'creator.ts',
  'developer.ts',
  'student.ts',
  'knowledge-worker.ts'
]

const TIME_RE =
  /\b(last\s+(week|month|year)|yesterday|today|\bago\b|couple\s+days|few\s+days|from\s+last|this\s+morning|earlier|recently|weeks?\s+ago|months?\s+ago|days?\s+ago)\b/i
const NOTE_HINT_RE =
  /\b(noted|annotated|annotation|clip\s+I\s+marked|where\s+I\s+noted|I\s+noted|I\s+marked|I\s+bookmarked\s+for|I\s+saved\s+to|after\s+the\s+\w+\s+incident|for\s+onboarding|for\s+the\s+junior|to\s+teach|for\s+my\s+portfolio|for\s+the\s+client|for\s+checkout|from\s+brand\s+sheet)\b/i
const AMBIGUOUS_RE =
  /\b(that\s+(one|page|article|bookmark|thread|clip|doc|preprint|old)|whatever\s+that\s+was)\b/i
const SCENE_ONLY_RE =
  /\b(for\s+(the|my|our)\s+\w+|onboarding|workshop|portfolio|checkout|client\s+deck|junior\s+FAQ|postmortem|teach\s+in|brand\s+sheet)\b/i

function tokens(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 4)
  )
}

function overlapCount(a, b) {
  let n = 0
  for (const t of a) if (b.has(t)) n += 1
  return n
}

/**
 * 标注口径（Brief）：verbatim / note / temporal / associative / paraphrase / ambiguous
 */
function inferType(clue, ctx) {
  const titleTok = tokens(ctx.title)
  const noteTok = tokens(ctx.note)
  const clueTok = tokens(clue)
  const titleOverlap = overlapCount(titleTok, clueTok)
  const noteOverlap = ctx.note ? overlapCount(noteTok, clueTok) : 0

  // note：指向附注
  if (ctx.note && (NOTE_HINT_RE.test(clue) || noteOverlap >= 1)) {
    return 'note'
  }
  // temporal：时间为主区分
  if (TIME_RE.test(clue)) {
    return 'temporal'
  }
  // associative：只给场景/用途、几乎无标题词
  if (SCENE_ONLY_RE.test(clue) && titleOverlap === 0) {
    return 'associative'
  }
  // ambiguous：模糊指代且标题重叠很少
  if (AMBIGUOUS_RE.test(clue) && titleOverlap <= 1) {
    return 'ambiguous'
  }
  // verbatim：直接引用标题/主题词
  if (titleOverlap >= 2) return 'verbatim'
  if (titleOverlap >= 1 && /\b(docs?|page|article|blog|guide|bookmark|rfc|mdn|excerpt|clip|paper)\b/i.test(clue)) {
    return 'verbatim'
  }
  return 'paraphrase'
}

function migrateSource(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const idx = src.indexOf('suggestedClues:', i)
    if (idx < 0) {
      out += src.slice(i)
      break
    }
    out += src.slice(i, idx)
    const lookback = src.slice(Math.max(0, idx - 600), idx)
    const titleMatch = [...lookback.matchAll(/title:\s*'((?:\\'|[^'])*)'/g)].at(-1)
    const pageTitleMatch = [...lookback.matchAll(/pageTitle:\s*'((?:\\'|[^'])*)'/g)].at(-1)
    const noteMatch = [...lookback.matchAll(/note:\s*'((?:\\'|[^'])*)'/g)].at(-1)
    const title = (titleMatch?.[1] ?? pageTitleMatch?.[1] ?? '').replace(/\\'/g, "'")
    const note = noteMatch?.[1]?.replace(/\\'/g, "'")

    const bracketStart = src.indexOf('[', idx)
    let depth = 0
    let j = bracketStart
    for (; j < src.length; j += 1) {
      if (src[j] === '[') depth += 1
      else if (src[j] === ']') {
        depth -= 1
        if (depth === 0) {
          j += 1
          break
        }
      }
    }
    const arrBody = src.slice(bracketStart + 1, j - 1)
    const clues = []
    const strRe = /'((?:\\'|[^'])*)'/g
    let m
    while ((m = strRe.exec(arrBody))) {
      const text = m[1].replace(/\\'/g, "'")
      const type = inferType(text, { title, note })
      clues.push(`{ text: '${m[1]}', type: '${type}' }`)
    }
    const indent = '      '
    const inner = clues.map(c => `${indent}  ${c}`).join(',\n')
    out += clues.length === 0 ? 'clues: []' : `clues: [\n${inner}\n${indent}]`
    i = j
  }
  return out
    .replace(
      /每条带 suggestedClues（英语母语口语）/g,
      '每条带 clues（英语母语口语 + ProbeClueType）'
    )
    .replace(/\bsuggestedClues\b/g, 'clues')
}

for (const file of FILES) {
  const path = join(ROOT, file)
  writeFileSync(path, migrateSource(readFileSync(path, 'utf8')))
  console.log('migrated', file)
}
