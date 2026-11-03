/**
 * §7.2 P3：读取本机 Outcome 对并对候选分做软调整（Hybrid 路径）。
 */

import {
  applyOutcomePairScoreAdjustments,
  fingerprintRecallClue
} from '@/core/recall/recall-outcome-pairs'
import type { RecallMatch } from '@/core/recall/recall-result'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { listRecallOutcomePairs } from '@/infrastructure/storage/recall-outcome-pairs-storage'

/**
 * 用 storage 中的 (clue→target / none) 对调整候选分后重排。
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
