import type { LlmParsedClueProposalInput } from '@/core/recall/understand/llm-parsed-clue-proposal'
import {
  dropMisleadingNoteContentTerm,
  groundBehaviorHints,
  groundObjectTypes,
  groundTimeLabel,
  preservePlatformChannelTerms,
  stripGroundedSurfacesFromTerms
} from '@/core/recall/understand/ground-llm-parse-slots'
import { shouldReclassifyQuestionAsRecall } from '@/core/recall/understand/reclassify-question-as-recall'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import { reconcilePositiveAndExcludeTerms } from '@/core/recall/exclude-content-terms'
import {
  extractContentTerms,
  reinforceBookmarkObjectType,
  reinforceRecentlySavedBehavior,
  resolveRecallClueConfidence,
  resolveRelativeTimeRange,
  timeConfidenceForRelativeLabel
} from '@/core/recall/parse-recall-clue'
import {
  ConditionCertaintySchema,
  ParsedRecallClueSchema,
  type ConditionCertainty,
  type ParsedClueCertainty,
  type ParsedRecallClue
} from '@/core/recall/parse-recall-clue-types'

/** 标量确定度；非法 / 缺省 → undefined（消费侧按 neutral；不把畸形写成 neutral）。 */
function normalizeCertaintyScalar(raw: unknown): ConditionCertainty | undefined {
  if (raw === undefined || raw === null) {
    return undefined
  }
  const parsed = ConditionCertaintySchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

/** 多值 map；非法键值丢弃；空 map → undefined。 */
function normalizeCertaintyMap(raw: unknown): Record<string, ConditionCertainty> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined
  }
  const out: Record<string, ConditionCertainty> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedKey = key.trim().toLowerCase()
    if (!normalizedKey) {
      continue
    }
    const parsed = ConditionCertaintySchema.safeParse(value)
    if (!parsed.success) {
      continue
    }
    out[normalizedKey] = parsed.data
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * LLM certainty → ParsedRecallClue.certainty（透传，不落地、不参与 grounding）。
 * 缺省 / 畸形槽位不写（消费侧按 neutral）。
 */
function mapProposalCertainty(
  proposal: LlmParsedClueProposalInput
): ParsedClueCertainty | undefined {
  const raw = proposal.certainty
  if (!raw || typeof raw !== 'object') {
    return undefined
  }
  const timeRange = normalizeCertaintyScalar(raw.timeRange)
  const preferenceOperator = normalizeCertaintyScalar(raw.preferenceOperator)
  const contentTerms = normalizeCertaintyMap(raw.contentTerms)
  const objectTypes = normalizeCertaintyMap(raw.objectTypes)
  if (!timeRange && !preferenceOperator && !contentTerms && !objectTypes) {
    return undefined
  }
  return {
    ...(timeRange ? { timeRange } : {}),
    ...(preferenceOperator ? { preferenceOperator } : {}),
    ...(contentTerms ? { contentTerms } : {}),
    ...(objectTypes ? { objectTypes } : {})
  }
}

/**
 * 约束槽位存在时剥掉的模型残留词（具名常量，原内联匿名 Set）。
 * 与 `WEAK_PREFERENCE_RESIDUAL_TERMS` 分工不同：那里管「弱偏好残留不过佐证门」，
 * 这里管「模型在刚存/类型约束线索里常残留的虚词」；两表词面无重叠，不合并。
 * 词汇与近期副词/保存动词同源（just/recently/newly + saved/stored/collected/bookmarked
 * 及其原形/复数），另加 ago/now。`ed` 是模型切词残片，已去掉——它不是词。
 */
const CONSTRAINT_SLOT_NOISE_TERMS = new Set([
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
  'now'
])

/**
 * 将 LLM 提议映射为编排层可消费的 ParsedRecallClue（确定性）。
 * - contentTerms：短语拆 token（正向）
 * - excludeContentTerms：明确排除；与正词冲突时消解
 * - objectTypes / behaviorHints：须在线索中有词面支撑
 * - objectTypeOther：未知类型原文词 → 去重追加进 contentTerms，永不进 objectTypes 硬筛
 * - confidence：按槽位重算（忽略模型自评）
 * - certainty：措辞确定度透传（不落地、不参与 grounding；与 preferenceOperator 同理）
 */
export function mapLlmProposalToParsedClue(
  clue: string,
  proposal: LlmParsedClueProposalInput,
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
  const portraitQuery = proposal.portraitQuery === true ? true : undefined

  // 偏好算子：语义判断，不做词面 grounding；直接透传（坏值已在 proposal .catch 置空）
  const preferenceOperator =
    proposal.preferenceOperator === 'most_frequent' ||
    proposal.preferenceOperator === 'favorite' ||
    proposal.preferenceOperator === 'recent_frequent'
      ? proposal.preferenceOperator
      : undefined
  const preferenceTarget =
    proposal.preferenceTarget === 'site' || proposal.preferenceTarget === 'page'
      ? proposal.preferenceTarget
      : preferenceOperator
        ? ('site' as const)
        : undefined

  // R7：未知类型出口；非法/超长在此丢弃本字段（与 proposal schema catch 同口径）
  const objectTypeOtherTrimmed =
    typeof proposal.objectTypeOther === 'string' ? proposal.objectTypeOther.trim() : ''
  const objectTypeOther =
    objectTypeOtherTrimmed.length >= 1 && objectTypeOtherTrimmed.length <= 40
      ? objectTypeOtherTrimmed
      : undefined

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
  // 平台/渠道表面：clue 中出现则确定性补回，避免模型只留主题词挤掉来源实体
  contentTerms = preservePlatformChannelTerms(clue, contentTerms)

  // 刚存/类型约束线索：剥掉模型常残留的虚词，避免挡约束邻域；保留真实内容词
  const hasConstraintSlots =
    objectTypes.length > 0 && (Boolean(timeRange) || behaviorHints.includes('recently_saved'))
  if (hasConstraintSlots) {
    contentTerms = contentTerms.filter(term => !CONSTRAINT_SLOT_NOISE_TERMS.has(term))
  }

  // 在虚词剥离之后追加 other，避免被 CONSTRAINT_SLOT_NOISE_TERMS 误伤；不参与 grounding 剥离
  if (objectTypeOther) {
    const otherTerms = extractContentTerms(objectTypeOther)
    const seen = new Set(contentTerms)
    for (const term of otherTerms) {
      if (!seen.has(term)) {
        seen.add(term)
        contentTerms.push(term)
      }
    }
  }

  const excludeFromProposal = extractContentTerms((proposal.excludeContentTerms ?? []).join(' '))
  const reconciled = reconcilePositiveAndExcludeTerms({
    contentTerms,
    excludeContentTerms: excludeFromProposal
  })
  contentTerms = reconciled.contentTerms
  const excludeContentTerms = reconciled.excludeContentTerms

  const hasTime = Boolean(timeRange)
  const hasObject = objectTypes.length > 0
  const hasBehavior = behaviorHints.length > 0
  const hasNote = noteHint === true
  const hasContent = contentTerms.length > 0
  const certainty = mapProposalCertainty(proposal)

  // 问句式召回护栏：已有具体槽位 + 找回锚 → 改判 recall，清空 assistantReply
  const reclassifyAsRecall = shouldReclassifyQuestionAsRecall({
    clue: raw,
    intent: proposal.intent,
    contentTerms,
    objectTypeOther
  })
  const resolvedIntent = reclassifyAsRecall ? 'recall' : proposal.intent

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
    ...(objectTypeOther ? { objectTypeOther } : {}),
    ...(hasBehavior ? { behaviorHints } : {}),
    ...(preferenceOperator ? { preferenceOperator } : {}),
    ...(preferenceTarget ? { preferenceTarget } : {}),
    ...(noteHint ? { noteHint } : {}),
    ...(portraitQuery ? { portraitQuery } : {}),
    ...(excludeContentTerms.length > 0 ? { excludeContentTerms } : {}),
    ...(certainty ? { certainty } : {}),
    ...(resolvedIntent && resolvedIntent !== 'recall' ? { intent: resolvedIntent } : {}),
    ...(resolvedIntent && resolvedIntent !== 'recall' && proposal.assistantReply?.trim()
      ? { assistantReply: proposal.assistantReply.trim().slice(0, 280) }
      : {})
  })
}
