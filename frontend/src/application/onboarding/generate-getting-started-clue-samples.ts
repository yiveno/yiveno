/**
 * Getting Started：挑一条真实书签 → LLM 一次 4 条口语 clue（失败回退标题模板）。
 */

import type { BookmarkLibraryIndexNode } from '@/core/memory/bookmark-library-index'
import type { GsClueSamplesOrigin } from '@/core/onboarding/gs-clue-samples'
import { resolveGettingStartedSampleSuggestions } from '@/core/onboarding/pick-getting-started-bookmark-sample'
import { requestGettingStartedClueSamples } from '@/infrastructure/ai/gs-clue-samples-api-client'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import {
  buildGsClueSamplesCacheKey,
  readGsClueSamplesCache,
  writeGsClueSamplesCache
} from '@/infrastructure/storage/gs-clue-samples-storage'

export type GenerateGettingStartedClueSamplesResult = {
  clues: string[]
  origin: GsClueSamplesOrigin
  chromeId: string
  title: string
  url?: string
  fromCache: boolean
}

function pickBookmarkSource(
  nodes: readonly BookmarkLibraryIndexNode[]
): BookmarkLibraryIndexNode | null {
  const bookmarks = nodes
    .filter(node => node.kind === 'bookmark' && node.title.trim().length > 0)
    .sort((a, b) => {
      const aTime = a.savedAt ? Date.parse(a.savedAt) : Number.NaN
      const bTime = b.savedAt ? Date.parse(b.savedAt) : Number.NaN
      const aOk = Number.isFinite(aTime)
      const bOk = Number.isFinite(bTime)
      if (aOk && bOk) {
        return bTime - aTime
      }
      if (aOk) {
        return -1
      }
      if (bOk) {
        return 1
      }
      return 0
    })
  return bookmarks[0] ?? null
}

function templateCluesFromNodes(
  nodes: readonly BookmarkLibraryIndexNode[],
  fallbackClue: string
): string[] {
  const samples = resolveGettingStartedSampleSuggestions(nodes, fallbackClue)
  return samples.map(sample => sample.clue).filter(Boolean)
}

/**
 * 生成示意 clue：缓存命中直接返回；关 AI / 失败 → 标题模板。
 */
export async function generateGettingStartedClueSamples(input: {
  nodes: readonly BookmarkLibraryIndexNode[]
  fallbackClue: string
}): Promise<GenerateGettingStartedClueSamplesResult | null> {
  const startedAt = flowStart('Onboarding', 'GS 示意 clue 生成')
  const source = pickBookmarkSource(input.nodes)
  if (!source) {
    const clues = templateCluesFromNodes(input.nodes, input.fallbackClue)
    if (clues.length === 0) {
      flowOk('Onboarding', 'GS 示意 clue 生成', startedAt, { empty: true })
      return null
    }
    flowOk('Onboarding', 'GS 示意 clue 生成', startedAt, {
      origin: 'template',
      clueCount: clues.length,
      noBookmark: true
    })
    return {
      clues,
      origin: 'template',
      chromeId: 'none',
      title: '',
      fromCache: false
    }
  }

  const cacheKey = buildGsClueSamplesCacheKey({
    chromeId: source.chromeId,
    title: source.title,
    ...(source.url ? { url: source.url } : {})
  })

  const cached = await readGsClueSamplesCache(cacheKey)
  if (cached) {
    flowOk('Onboarding', 'GS 示意 clue 生成', startedAt, {
      origin: cached.origin,
      fromCache: true,
      clueCount: cached.clues.length
    })
    return {
      clues: cached.clues,
      origin: cached.origin,
      chromeId: source.chromeId,
      title: cached.title,
      ...(cached.url ? { url: cached.url } : {}),
      fromCache: true
    }
  }

  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    const clues = templateCluesFromNodes(input.nodes, input.fallbackClue)
    await writeGsClueSamplesCache({
      cacheKey,
      title: source.title,
      ...(source.url ? { url: source.url } : {}),
      clues,
      origin: 'template'
    })
    flowOk('Onboarding', 'GS 示意 clue 生成', startedAt, {
      origin: 'template',
      aiDisabled: true,
      clueCount: clues.length
    })
    return {
      clues,
      origin: 'template',
      chromeId: source.chromeId,
      title: source.title,
      ...(source.url ? { url: source.url } : {}),
      fromCache: false
    }
  }

  try {
    const description = source.note?.trim() || undefined
    const result = await requestGettingStartedClueSamples({
      title: source.title.trim(),
      ...(source.url ? { url: source.url } : {}),
      ...(description ? { description } : {})
    })
    await writeGsClueSamplesCache({
      cacheKey,
      title: source.title,
      ...(source.url ? { url: source.url } : {}),
      clues: result.clues,
      origin: 'llm'
    })
    flowOk('Onboarding', 'GS 示意 clue 生成', startedAt, {
      origin: 'llm',
      clueCount: result.clues.length,
      model: result.model ?? null
    })
    return {
      clues: result.clues,
      origin: 'llm',
      chromeId: source.chromeId,
      title: source.title,
      ...(source.url ? { url: source.url } : {}),
      fromCache: false
    }
  } catch (error) {
    logger.warn('Onboarding', 'GS 示意 clue LLM 失败，回退模板', {
      error: error instanceof Error ? error.message : String(error),
      chromeId: source.chromeId
    })
    const clues = templateCluesFromNodes(input.nodes, input.fallbackClue)
    flowFail('Onboarding', 'GS 示意 clue 生成', startedAt, error, {
      fallback: 'template',
      clueCount: clues.length
    })
    return {
      clues,
      origin: 'template',
      chromeId: source.chromeId,
      title: source.title,
      ...(source.url ? { url: source.url } : {}),
      fromCache: false
    }
  }
}
