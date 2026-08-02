import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  RECALL_BEHAVIOR_LEXICON,
  RECALL_OBJECT_TYPE_LEXICON,
  RECALL_TIME_LEXICON,
  type RecallRelativeTimeLabel
} from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallBehaviorHint, RecallObjectType } from '@/core/recall/parse-recall-clue-types'

/**
 * LLM 侧额外同义词 → canonical 类型（规则词典尚未收录的词面）。
 * 仅用于「线索里出现该词时允许保留对应 objectType」。
 */
const LLM_OBJECT_TYPE_ALIASES: Array<{ surface: string; value: RecallObjectType }> = [
  { surface: 'verse', value: 'poem' },
  { surface: 'verses', value: 'poem' },
  { surface: 'write-up', value: 'article' },
  { surface: 'writeup', value: 'article' },
  { surface: 'youtube', value: 'video' },
  { surface: 'clip', value: 'video' },
  { surface: '视频', value: 'video' }
]

/** 行为别名：规则词典未收录、但 stretch 金标需要的说法。 */
const LLM_BEHAVIOR_ALIASES: Array<{ surface: string; value: RecallBehaviorHint }> = [
  { surface: 'never finished', value: 'half_read' },
  { surface: 'didnt finish', value: 'half_read' },
  { surface: "didn't finish", value: 'half_read' }
]

function clueHasSurface(normalizedClue: string, surface: string): boolean {
  const needle = normalizeRecallText(surface)
  if (!needle) {
    return false
  }
  return normalizedClue.includes(needle)
}

/** 保留有词面支撑的行为；线索命中别名时即使模型漏提也补上。 */
export function groundBehaviorHints(
  clue: string,
  hints: RecallBehaviorHint[] | undefined
): RecallBehaviorHint[] | undefined {
  const normalized = normalizeRecallText(clue)
  const kept = new Set<RecallBehaviorHint>()

  for (const hint of hints ?? []) {
    const lexiconHit = RECALL_BEHAVIOR_LEXICON.some(
      entry => entry.value === hint && clueHasSurface(normalized, entry.surface)
    )
    const aliasHit = LLM_BEHAVIOR_ALIASES.some(
      entry => entry.value === hint && clueHasSurface(normalized, entry.surface)
    )
    if (lexiconHit || aliasHit) {
      kept.add(hint)
    }
  }

  for (const entry of LLM_BEHAVIOR_ALIASES) {
    if (clueHasSurface(normalized, entry.surface)) {
      kept.add(entry.value)
    }
  }

  return kept.size > 0 ? [...kept] : undefined
}

/**
 * 时间标签：若线索命中词典词面，优先用最长 surface 对应 label（纠偏 LLM 的 recent/a_while_ago 混淆）。
 * 无线索词面时才回退模型提议。
 */
export function groundTimeLabel(
  clue: string,
  proposed: RecallRelativeTimeLabel | null | undefined
): RecallRelativeTimeLabel | undefined {
  const normalized = normalizeRecallText(clue)
  const hits = RECALL_TIME_LEXICON.filter(entry => clueHasSurface(normalized, entry.surface)).sort(
    (a, b) => b.surface.length - a.surface.length
  )
  if (hits[0]) {
    return hits[0].value
  }
  return proposed ?? undefined
}

/**
 * 只保留线索中确有词面（或 LLM 别名）支撑的对象类型；别名命中时可补全模型漏提的类型。
 */
export function groundObjectTypes(
  clue: string,
  types: RecallObjectType[] | undefined
): RecallObjectType[] | undefined {
  const normalized = normalizeRecallText(clue)
  const kept = new Set<RecallObjectType>()

  for (const type of types ?? []) {
    const lexiconHit = RECALL_OBJECT_TYPE_LEXICON.some(
      entry => entry.value === type && clueHasSurface(normalized, entry.surface)
    )
    const aliasHit = LLM_OBJECT_TYPE_ALIASES.some(
      entry => entry.value === type && clueHasSurface(normalized, entry.surface)
    )
    if (lexiconHit || aliasHit) {
      kept.add(type)
    }
  }

  for (const entry of LLM_OBJECT_TYPE_ALIASES) {
    if (clueHasSurface(normalized, entry.surface)) {
      kept.add(entry.value)
    }
  }

  return kept.size > 0 ? [...kept] : undefined
}

/** 从 contentTerms 去掉已用于时间/类型/行为的词面 token，减少 verse/from 等泄漏。 */
export function stripGroundedSurfacesFromTerms(
  clue: string,
  terms: string[],
  input: {
    timeLabel?: RecallRelativeTimeLabel
    objectTypes?: RecallObjectType[]
    behaviorHints?: RecallBehaviorHint[]
  }
): string[] {
  const normalizedClue = normalizeRecallText(clue)
  const blocklist = new Set<string>()

  const addSurfaceTokens = (surface: string) => {
    const tokens = normalizeRecallText(surface)
      .split(/[^a-z0-9\u3400-\u9fff]+/)
      .filter(Boolean)
    for (const token of tokens) {
      blocklist.add(token)
    }
  }

  if (input.timeLabel) {
    for (const entry of RECALL_TIME_LEXICON) {
      if (entry.value === input.timeLabel && clueHasSurface(normalizedClue, entry.surface)) {
        addSurfaceTokens(entry.surface)
      }
    }
  }

  if (input.objectTypes) {
    for (const type of input.objectTypes) {
      for (const entry of RECALL_OBJECT_TYPE_LEXICON) {
        if (entry.value === type && clueHasSurface(normalizedClue, entry.surface)) {
          addSurfaceTokens(entry.surface)
        }
      }
      for (const entry of LLM_OBJECT_TYPE_ALIASES) {
        if (entry.value === type && clueHasSurface(normalizedClue, entry.surface)) {
          addSurfaceTokens(entry.surface)
        }
      }
    }
  }

  if (input.behaviorHints) {
    for (const hint of input.behaviorHints) {
      for (const entry of RECALL_BEHAVIOR_LEXICON) {
        if (entry.value === hint && clueHasSurface(normalizedClue, entry.surface)) {
          addSurfaceTokens(entry.surface)
        }
      }
      for (const entry of LLM_BEHAVIOR_ALIASES) {
        if (entry.value === hint && clueHasSurface(normalizedClue, entry.surface)) {
          addSurfaceTokens(entry.surface)
        }
      }
    }
  }

  // 常见虚词（与规则 filler 对齐的一小撮），防 from/at/the 残留
  for (const filler of ['from', 'at', 'the', 'a', 'an', 'about', 'that', 'this', 'with']) {
    blocklist.add(filler)
  }

  return terms.filter(term => !blocklist.has(term))
}
