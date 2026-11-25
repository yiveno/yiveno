/**
 * 画像夜间编译 tick：挂 Dreaming 闹钟节奏；失败 fail-open。
 */

import { compilePortraitFactsCore } from '@/core/portrait/compile-portrait-facts-core'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { behaviorStatsRepository } from '@/infrastructure/indexeddb/behavior-stats-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import { portraitFactsRepository } from '@/infrastructure/indexeddb/portrait-facts-repository'
import { logger } from '@/infrastructure/logging/logger'

/** 编译命题扫描上限（避免一次扫爆）。 */
const NOTE_SCAN_LIMIT = 500

export type CompilePortraitFactsTickResult = {
  ok: boolean
  ownerId: string | null
  written: number
  stats: ReturnType<typeof compilePortraitFactsCore>['stats'] | null
  error?: string
}

/** 单次画像编译；幂等（同输入重跑只刷新）。 */
export async function compilePortraitFactsTick(
  nowMs: number = Date.now()
): Promise<CompilePortraitFactsTickResult> {
  let ownerId: string | null = null
  try {
    ownerId = await getCurrentOwnerId()
    const [existing, behaviorRows, notes] = await Promise.all([
      portraitFactsRepository.listByOwner(ownerId),
      behaviorStatsRepository.listByOwner(ownerId),
      memoryNotesRepository.listByOwnerUpdated({
        ownerId,
        limit: NOTE_SCAN_LIMIT
      })
    ])
    const nowIso = new Date(nowMs).toISOString()
    const compiled = compilePortraitFactsCore({
      ownerId,
      existing,
      behaviorRows,
      notes,
      nowMs,
      nowIso
    })
    const written = await portraitFactsRepository.putMany(compiled.upserts)
    logger.info('Portrait', '夜间编译完成', {
      ownerId,
      written,
      ...compiled.stats
    })
    return {
      ok: true,
      ownerId,
      written,
      stats: compiled.stats
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('Portrait', '夜间编译失败（fail-open）', { ownerId, error: message })
    return {
      ok: false,
      ownerId,
      written: 0,
      stats: null,
      error: message
    }
  }
}
