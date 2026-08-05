/**
 * §7.1：当前标签页域名与条目 domain 一致时的软抬升。
 */

import type { RecallMatch } from '@/core/recall/recall-result'

/** 当前标签页同域软加成。 */
export const CURRENT_TAB_DOMAIN_BOOST = 5

export function applyCurrentTabDomainBoost(
  matches: RecallMatch[],
  currentTabDomain: string | undefined
): RecallMatch[] {
  const domain = currentTabDomain?.trim().toLowerCase()
  if (!domain) {
    return matches
  }
  return matches.map(match => {
    const itemDomain = (match.item.clues.domain ?? '').toLowerCase()
    if (!itemDomain || itemDomain !== domain) {
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
