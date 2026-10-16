/**
 * §7.1：按 pageContextMode 对候选施加当前页上下文（boost / restrict）。
 * none 或无域名 → 原样返回。
 */

import type { RecallMatch } from '@/core/recall/recall-result'
import { isSamePageContextDomain, type PageContextMode } from '@/core/recall/page-context-mode'
import { applyCurrentTabDomainBoost } from '@/application/recall/apply-current-tab-domain-boost'

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
