/**
 * 「你了解我多少」：读 B 层 → 构建摘要（确定性，零 LLM）。
 */

import { buildPortraitSummary } from '@/core/portrait/build-portrait-summary'
import type { RecallResult } from '@/core/recall/recall-result'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { portraitFactsRepository } from '@/infrastructure/indexeddb/portrait-facts-repository'
import { logger } from '@/infrastructure/logging/logger'

export async function resolvePortraitInspect(input: {
  clue: string
  parsed: ParsedRecallClue
}): Promise<RecallResult> {
  const ownerId = await getCurrentOwnerId()
  const facts = await portraitFactsRepository.listByOwner(ownerId)
  const summary = buildPortraitSummary(facts)
  logger.info('Portrait', '画像可查性摘要', {
    ownerId,
    empty: summary.empty,
    pendingInferences: summary.pendingInferences.length,
    verified: summary.groups.verified.length,
    corroborated: summary.groups.corroborated.length,
    unconfirmed: summary.groups.unconfirmed.length,
    contested: summary.groups.contested.length
  })
  return {
    outcome: 'no_match',
    topPick: null,
    alsoPossible: [],
    totalRankedCount: 0,
    clue: input.clue,
    emptyKind: 'portrait_inspect',
    parsed: input.parsed,
    portraitSummary: summary,
    effectiveClue: input.clue
  }
}
