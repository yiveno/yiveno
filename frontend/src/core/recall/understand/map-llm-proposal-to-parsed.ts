import type { LlmParsedClueProposal } from '@/core/recall/understand/llm-parsed-clue-proposal'
import {
  dropMisleadingNoteContentTerm,
  groundBehaviorHints,
  groundObjectTypes,
  groundTimeLabel,
  stripGroundedSurfacesFromTerms
} from '@/core/recall/understand/ground-llm-parse-slots'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import {
  extractContentTerms,
  reinforceBookmarkObjectType,
  reinforceRecentlySavedBehavior,
  resolveRecallClueConfidence,
  resolveRelativeTimeRange,
  timeConfidenceForRelativeLabel
} from '@/core/recall/parse-recall-clue'
import {
  ParsedRecallClueSchema,
  type ParsedRecallClue
} from '@/core/recall/parse-recall-clue-types'

/**
 * 将 LLM 提议映射为编排层可消费的 ParsedRecallClue（确定性）。
 * - contentTerms：短语拆 token
 * - objectTypes / behaviorHints：须在线索中有词面支撑
 * - confidence：按槽位重算（忽略模型自评）
 */
export function mapLlmProposalToParsedClue(
  clue: string,
  proposal: LlmParsedClueProposal,
  nowMs: number
): ParsedRecallClue {
  const raw = clue.trim()
  const normalized = normalizeRecallText(raw)

  const timeLabel = groundTimeLabel(clue, proposal.timeLabel)
  const timeRange = timeLabel ? resolveRelativeTimeRange(timeLabel, nowMs) : undefined
  const timeConfidence = timeLabel ? timeConfidenceForRelativeLabel(timeLabel) : undefined

  let objectTypes = groundObjectTypes(clue, proposal.objectTypes ?? undefined) ?? []
  let behaviorHints = groundBehaviorHints(clue, proposal.behaviorHints ?? undefined) ?? []
  objectTypes = reinforceBookmarkObjectType(normalized, objectTypes)
  behaviorHints = reinforceRecentlySavedBehavior(normalized, behaviorHints)

  const noteHint = proposal.noteHint === true ? true : undefined

  let contentTerms = stripGroundedSurfacesFromTerms(
    clue,
    extractContentTerms(proposal.contentTerms.join(' ')),
    {
      ...(timeLabel ? { timeLabel } : {}),
      ...(objectTypes.length > 0 ? { objectTypes } : {}),
      ...(behaviorHints.length > 0 ? { behaviorHints } : {})
    }
  )
  contentTerms = dropMisleadingNoteContentTerm(normalized, contentTerms)

  // 刚存/类型约束线索：剥掉模型常残留的虚词，避免挡约束邻域；保留真实内容词
  const hasConstraintSlots =
    objectTypes.length > 0 && (Boolean(timeRange) || behaviorHints.includes('recently_saved'))
  if (hasConstraintSlots) {
    const noise = new Set([
      'just',
      'saved',
      'save',
      'stored',
      'store',
      'collected',
      'collect',
      'bookmark',
      'bookmarks',
      'bookmarked',
      'recently',
      'newly',
      'ago',
      'now',
      'ed'
    ])
    contentTerms = contentTerms.filter(term => !noise.has(term))
  }

  const hasTime = Boolean(timeRange)
  const hasObject = objectTypes.length > 0
  const hasBehavior = behaviorHints.length > 0
  const hasNote = noteHint === true
  const hasContent = contentTerms.length > 0

  return ParsedRecallClueSchema.parse({
    raw,
    contentTerms,
    confidence: resolveRecallClueConfidence({
      hasTime,
      hasObject,
      hasBehavior,
      hasNote,
      hasContent
    }),
    ...(timeRange ? { timeRange } : {}),
    ...(timeConfidence ? { timeConfidence } : {}),
    ...(hasObject ? { objectTypes } : {}),
    ...(hasBehavior ? { behaviorHints } : {}),
    ...(noteHint ? { noteHint } : {})
  })
}
