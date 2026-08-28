/**
 * DEV：种入召回探针语料（Chrome 书签 + Memory 摘录/附注）。
 * 仅 background / import.meta.env.DEV；禁止生产构建调用。
 */

import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { SeedRecallProbePayload } from '@/core/messaging/debug-messages'
import { resolveProbeCorpora } from '@/infrastructure/debug/recall-probe-corpora'
import {
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds
} from '@/infrastructure/debug/recall-probe-corpus-diversity'
import {
  buildNoiseBookmarkSeeds,
  buildNoiseExcerptSeeds
} from '@/infrastructure/debug/recall-probe-corpus-noise'
import type {
  RecallProbeBookmarkSeed,
  RecallProbeExcerptSeed,
  RecallProbePersonaId
} from '@/infrastructure/debug/recall-probe-corpus-types'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE } from '@/infrastructure/indexeddb/constants'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/** Chrome 书签栏下探针文件夹标题。 */
export const RECALL_PROBE_BOOKMARK_FOLDER_TITLE = 'Yiveno Probe'

function daysAgoIso(daysAgo: number): string {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString()
}

/** 让出事件循环，避免压力轮万级写入卡死 Service Worker。 */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

/** 清空书签栏与其它书签根下的全部子树（保留根节点本身）。 */
async function wipeAllChromeBookmarkChildren(): Promise<number> {
  const tree = await chrome.bookmarks.getTree()
  const roots = tree[0]?.children ?? []
  let wipedFolders = 0
  for (const root of roots) {
    const children = [...(root.children ?? [])]
    for (const child of children) {
      await chrome.bookmarks.removeTree(child.id)
      wipedFolders += 1
    }
  }
  return wipedFolders
}

/** 在书签栏下创建或复用探针文件夹。 */
async function ensureProbeFolder(): Promise<string> {
  const tree = await chrome.bookmarks.getTree()
  const bar = tree[0]?.children?.[0]
  if (!bar) {
    throw new Error('找不到 Chrome 书签栏根节点')
  }
  const existing = (bar.children ?? []).find(
    node => node.title === RECALL_PROBE_BOOKMARK_FOLDER_TITLE && !node.url
  )
  if (existing) {
    return existing.id
  }
  const created = await chrome.bookmarks.create({
    parentId: bar.id,
    title: RECALL_PROBE_BOOKMARK_FOLDER_TITLE
  })
  return created.id
}

async function seedBookmark(
  folderId: string,
  seed: RecallProbeBookmarkSeed,
  options: { enrich: boolean }
): Promise<string> {
  const chromeCreatedAt = daysAgoIso(seed.daysAgo)
  const node = await chrome.bookmarks.create({
    parentId: folderId,
    title: seed.title,
    url: seed.url
  })
  const item = await memoryItemService.upsertBookmarkFromChrome({
    payload: {
      title: seed.title,
      url: seed.url,
      chromeBookmarkId: node.id,
      chromeCreatedAt
    },
    ...(seed.note
      ? {
          clues: {
            note: seed.note
          }
        }
      : {}),
    now: () => chromeCreatedAt
  })
  if (seed.note && !item.clues.note) {
    await memoryItemService.updateNote(item.id, seed.note)
  }
  if (options.enrich) {
    scheduleAsyncMemoryLlmEnrichment(item.id)
    scheduleAsyncMemoryEmbedding(item.id)
  }
  return seed.key
}

/** 精选摘录：走 capture 路径以调度 enrichment / embedding。 */
async function seedExcerptCurated(seed: RecallProbeExcerptSeed): Promise<string> {
  const createdAt = daysAgoIso(seed.daysAgo)
  await memoryItemService.captureTextExcerpt({
    payload: {
      pageTitle: seed.pageTitle,
      sourceUrl: seed.sourceUrl,
      selectedText: seed.selectedText
    },
    ...(seed.note
      ? {
          clues: {
            note: seed.note
          }
        }
      : {}),
    now: () => createdAt
  })
  return seed.key
}

/** 噪声摘录：直写、不烧配额。 */
async function seedExcerptQuiet(seed: RecallProbeExcerptSeed): Promise<string> {
  const createdAt = daysAgoIso(seed.daysAgo)
  await memoryItemRepository.createTextExcerpt({
    payload: {
      pageTitle: seed.pageTitle,
      sourceUrl: seed.sourceUrl,
      selectedText: seed.selectedText
    },
    ...(seed.note
      ? {
          clues: {
            note: seed.note
          }
        }
      : {}),
    now: () => createdAt
  })
  return seed.key
}

/**
 * 压力轮：书签直写 Memory（不经 Chrome API），分批 putMany + 标 dirty。
 * 调用方须在整次种库结束后 ensureReadyForOwner 重建倒排。
 */
async function seedBookmarksBulkMemoryOnly(seeds: RecallProbeBookmarkSeed[]): Promise<number> {
  if (seeds.length === 0) {
    return 0
  }
  const [ownerId, profile] = await Promise.all([getCurrentOwnerId(), getOrCreateLocalProfile()])
  const batchSize = MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE
  for (let offset = 0; offset < seeds.length; offset += batchSize) {
    const chunk = seeds.slice(offset, offset + batchSize)
    const items = chunk.map(seed =>
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId: profile.localProfileId,
        captureEntry: 'sync',
        payload: {
          title: seed.title,
          url: seed.url
        },
        ...(seed.note
          ? {
              clues: {
                note: seed.note
              }
            }
          : {}),
        now: () => daysAgoIso(seed.daysAgo)
      })
    )
    await memoryItemRepository.putMany(items)
    logger.info('DevProbe', '压力轮书签批写入', {
      written: Math.min(offset + chunk.length, seeds.length),
      total: seeds.length
    })
    await yieldToEventLoop()
  }
  return seeds.length
}

/** 压力轮：摘录分批 putMany。 */
async function seedExcerptsBulkQuiet(seeds: RecallProbeExcerptSeed[]): Promise<number> {
  if (seeds.length === 0) {
    return 0
  }
  const [ownerId, profile] = await Promise.all([getCurrentOwnerId(), getOrCreateLocalProfile()])
  const batchSize = MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE
  for (let offset = 0; offset < seeds.length; offset += batchSize) {
    const chunk = seeds.slice(offset, offset + batchSize)
    const items = chunk.map(seed =>
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId: profile.localProfileId,
        captureEntry: 'selection_toolbar',
        payload: {
          pageTitle: seed.pageTitle,
          sourceUrl: seed.sourceUrl,
          selectedText: seed.selectedText
        },
        ...(seed.note
          ? {
              clues: {
                note: seed.note
              }
            }
          : {}),
        now: () => daysAgoIso(seed.daysAgo)
      })
    )
    await memoryItemRepository.putMany(items)
    logger.info('DevProbe', '压力轮摘录批写入', {
      written: Math.min(offset + chunk.length, seeds.length),
      total: seeds.length
    })
    await yieldToEventLoop()
  }
  return seeds.length
}

/** 将总数按画像均分（余数给前列画像）。 */
function splitCountAcrossPersonas(
  total: number,
  personas: readonly RecallProbePersonaId[]
): number[] {
  if (personas.length === 0) {
    return []
  }
  const base = Math.floor(total / personas.length)
  const rem = total % personas.length
  return personas.map((_, index) => base + (index < rem ? 1 : 0))
}

/**
 * 种入探针语料。
 * @returns 统计与探针 key 列表（仅精选，不含噪声/多样性）
 */
export async function seedRecallProbeCorpus(payload: SeedRecallProbePayload): Promise<{
  persona: string[]
  bookmarkCount: number
  excerptCount: number
  diversityBookmarkCount: number
  diversityExcerptCount: number
  noiseBookmarkCount: number
  noiseExcerptCount: number
  chromeBookmarkSync: 'all' | 'curated_only'
  indexRebuilt: boolean
  wipedChromeFolders: number
  clearedMemoryCount: number
  probeKeys: string[]
}> {
  if (!import.meta.env.DEV) {
    throw new Error('seedRecallProbeCorpus 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', '种入召回探针语料', {
    personas: payload.personas,
    replace: payload.replace,
    chromeBookmarkSync: payload.chromeBookmarkSync,
    diversityBookmarkCount: payload.diversityBookmarkCount,
    diversityExcerptCount: payload.diversityExcerptCount,
    noiseBookmarkCount: payload.noiseBookmarkCount,
    noiseExcerptCount: payload.noiseExcerptCount
  })

  try {
    let wipedChromeFolders = 0
    let clearedMemoryCount = 0

    if (payload.replace) {
      wipedChromeFolders = await wipeAllChromeBookmarkChildren()
      const ownerId = await getCurrentOwnerId()
      const existing = await memoryItemRepository.listAllByOwnerId(ownerId, {
        includeDeleted: true
      })
      clearedMemoryCount = existing.length
      await memoryItemRepository.replaceOwnerItems(ownerId, [])
      logger.info('DevProbe', '已清空 Chrome 书签子树与本地 Memory', {
        wipedChromeFolders,
        clearedMemoryCount
      })
    }

    const folderId = await ensureProbeFolder()
    const corpora = resolveProbeCorpora(payload.personas)
    const probeKeys: string[] = []
    let bookmarkCount = 0
    let excerptCount = 0
    const memoryOnlyFill = payload.chromeBookmarkSync === 'curated_only'

    for (const corpus of corpora) {
      for (const bm of corpus.bookmarks) {
        probeKeys.push(await seedBookmark(folderId, bm, { enrich: payload.enrichCurated }))
        bookmarkCount += 1
      }
      for (const ex of corpus.excerpts) {
        probeKeys.push(
          payload.enrichCurated ? await seedExcerptCurated(ex) : await seedExcerptQuiet(ex)
        )
        excerptCount += 1
      }
    }

    const personaIds = corpora.map(c => c.persona)
    const bmSplits = splitCountAcrossPersonas(payload.diversityBookmarkCount, personaIds)
    const exSplits = splitCountAcrossPersonas(payload.diversityExcerptCount, personaIds)

    const diversityBookmarks: RecallProbeBookmarkSeed[] = []
    const diversityExcerpts: RecallProbeExcerptSeed[] = []
    for (let i = 0; i < personaIds.length; i += 1) {
      const persona = personaIds[i]!
      diversityBookmarks.push(...buildDiversityBookmarkSeeds(persona, bmSplits[i] ?? 0))
      diversityExcerpts.push(...buildDiversityExcerptSeeds(persona, exSplits[i] ?? 0))
    }

    const noiseBookmarks = buildNoiseBookmarkSeeds(payload.noiseBookmarkCount)
    const noiseExcerpts = buildNoiseExcerptSeeds(payload.noiseExcerptCount)

    if (memoryOnlyFill) {
      await seedBookmarksBulkMemoryOnly([...diversityBookmarks, ...noiseBookmarks])
      await seedExcerptsBulkQuiet([...diversityExcerpts, ...noiseExcerpts])
    } else {
      for (const bm of diversityBookmarks) {
        await seedBookmark(folderId, bm, { enrich: false })
      }
      for (const ex of diversityExcerpts) {
        await seedExcerptQuiet(ex)
      }
      for (const bm of noiseBookmarks) {
        await seedBookmark(folderId, bm, { enrich: false })
      }
      for (const ex of noiseExcerpts) {
        await seedExcerptQuiet(ex)
      }
    }

    const ownerId = await getCurrentOwnerId()
    const indexReady = await keywordIndexRepository.ensureReadyForOwner(ownerId)

    const result = {
      persona: personaIds,
      bookmarkCount,
      excerptCount,
      diversityBookmarkCount: diversityBookmarks.length,
      diversityExcerptCount: diversityExcerpts.length,
      noiseBookmarkCount: noiseBookmarks.length,
      noiseExcerptCount: noiseExcerpts.length,
      chromeBookmarkSync: payload.chromeBookmarkSync,
      indexRebuilt: indexReady.rebuilt,
      wipedChromeFolders,
      clearedMemoryCount,
      probeKeys
    }
    flowOk('DevProbe', '种入召回探针语料', startedAt, {
      bookmarkCount,
      excerptCount,
      diversityBookmarkCount: result.diversityBookmarkCount,
      diversityExcerptCount: result.diversityExcerptCount,
      noiseBookmarkCount: result.noiseBookmarkCount,
      noiseExcerptCount: result.noiseExcerptCount,
      chromeBookmarkSync: result.chromeBookmarkSync,
      indexRebuilt: result.indexRebuilt
    })
    return result
  } catch (error) {
    flowFail('DevProbe', '种入召回探针语料', startedAt, error)
    throw error
  }
}
