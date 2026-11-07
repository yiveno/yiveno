/**
 * Recall 候选上下文后处理（§7.1 / §7.2）：当前页域名、Outcome 对软调整。
 * 由原 apply-page-context / apply-current-tab-domain-boost / apply-stored-outcome-pairs 机械合并。
 */

import type { RecallMatch } from '@/core/recall/recall-result'
import { isSamePageContextDomain, type PageContextMode } from '@/core/recall/page-context-mode'
import {
  applyOutcomePairScoreAdjustments,
  fingerprintRecallClue
} from '@/core/recall/recall-outcome-pairs'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { listRecallOutcomePairs } from '@/infrastructure/storage/recall-outcome-pairs-storage'

/** 当前标签页同域软加成。 */
export const CURRENT_TAB_DOMAIN_BOOST = 5

/**
 * §7.1：当前标签页域名与条目 domain 一致时的软抬升。
 * 仅应由 applyPageContextToMatches（mode=boost）调用；禁止在 pageContextMode=none 时静默调用。
 */
export function applyCurrentTabDomainBoost(
  matches: RecallMatch[],
  currentTabDomain: string | undefined
): RecallMatch[] {
  if (!currentTabDomain?.trim()) {
    return matches
  }
  return matches.map(match => {
    if (!isSamePageContextDomain(match.item.clues.domain, currentTabDomain)) {
      return match
    }
    return {
      ...match,
      score: match.score + CURRENT_TAB_DOMAIN_BOOST,
      matchedFields: match.matchedFields.includes('currentTabDomain')
        ? match.matchedFields
        : [...match.matchedFields, 'currentTabDomain']
    }
  })
}

/**
 * §7.1：按 pageContextMode 对候选施加当前页上下文（boost / restrict）。
 * none 或无域名 → 原样返回。
 */
export function applyPageContextToMatches(
  matches: RecallMatch[],
  input: {
    pageContextMode: PageContextMode
    currentTabDomain: string | undefined
  }
): RecallMatch[] {
  const { pageContextMode, currentTabDomain } = input
  if (pageContextMode === 'none' || !currentTabDomain?.trim()) {
    return matches
  }
  if (pageContextMode === 'restrict') {
    return matches.filter(match =>
      isSamePageContextDomain(match.item.clues.domain, currentTabDomain)
    )
  }
  // boost：复用既有同域软加成（内部亦做大小写比较；调用前已由 mode 门控）
  return applyCurrentTabDomainBoost(matches, currentTabDomain)
}

/**
 * §7.2 P3：用 storage 中的 (clue→target / none) 对调整候选分后重排。
 * 用户关闭 `recallOutcomePairSoftAdjustEnabled` 时跳过（仍保留对缓冲）。
 * contentTerms 非空时正例须通过内容佐证。读取失败则原样返回（best-effort）。
 */
export async function applyStoredOutcomePairsToMatches(
  matches: RecallMatch[],
  pairClue: string,
  options?: { contentTerms?: readonly string[] }
): Promise<RecallMatch[]> {
  if (matches.length === 0 || !pairClue.trim()) {
    return matches
  }
  try {
    const settings = await getUserSettings()
    if (!settings.recallOutcomePairSoftAdjustEnabled) {
      return matches
    }
    const pairs = await listRecallOutcomePairs()
    if (pairs.length === 0) {
      return matches
    }
    return applyOutcomePairScoreAdjustments(
      matches,
      fingerprintRecallClue(pairClue),
      pairs,
      options?.contentTerms ? { contentTerms: options.contentTerms } : undefined
    )
  } catch {
    return matches
  }
}
