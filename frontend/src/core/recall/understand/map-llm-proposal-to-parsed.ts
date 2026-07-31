import type { LlmParsedClueProposal } from '@/core/recall/understand/llm-parsed-clue-proposal'
import {
  groundBehaviorHints,
  groundObjectTypes,
  groundTimeLabel,
  stripGroundedSurfacesFromTerms
} from '@/core/recall/understand/ground-llm-parse-slots'
import {
  extractContentTerms,
  resolveRecallClueConfidence,
  resolveRelativeTimeRange
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

  const timeLabel = groundTimeLabel(clue, proposal.timeLabel)
  const timeRange = timeLabel ? resolveRelativeTimeRange(timeLabel, nowMs) : undefined

  const objectTypes = groundObjectTypes(clue, proposal.objectTypes ?? undefined)
  const behaviorHints = groundBehaviorHints(clue, proposal.behaviorHints ?? undefined)
  const noteHint = proposal.noteHint === true ? true : undefined

  const contentTerms = stripGroundedSurfacesFromTerms(
    clue,
    extractContentTerms(proposal.contentTerms.join(' ')),
    {
      ...(timeLabel ? { timeLabel } : {}),
      ...(objectTypes ? { objectTypes } : {}),
      ...(behaviorHints ? { behaviorHints } : {})
    }
  )

  const hasTime = Boolean(timeRange)
  const hasObject = Boolean(objectTypes && objectTypes.length > 0)
  const hasBehavior = Boolean(behaviorHints && behaviorHints.length > 0)
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
    ...(objectTypes ? { objectTypes } : {}),
    ...(behaviorHints ? { behaviorHints } : {}),
    ...(noteHint ? { noteHint } : {})
  })
}
