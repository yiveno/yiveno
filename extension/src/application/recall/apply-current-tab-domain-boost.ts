/**
 * §7.1：当前标签页域名与条目 domain 一致时的软抬升。
 * 仅应由 applyPageContextToMatches（mode=boost）调用；禁止在 pageContextMode=none 时静默调用。
 */

import type { RecallMatch } from '@/core/recall/recall-result'
import { isSamePageContextDomain } from '@/core/recall/page-context-mode'

/** 当前标签页同域软加成。 */
export const CURRENT_TAB_DOMAIN_BOOST = 5

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
