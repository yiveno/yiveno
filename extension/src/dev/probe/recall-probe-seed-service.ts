/**
 * DEV：种入召回探针语料（Chrome 书签 + Memory 摘录/附注）。
 * 仅 background / import.meta.env.DEV；禁止生产构建调用。
 *
 * Chrome 布局：模拟真实用户书签栏（主题文件夹 + 少量栏上散落），
 * 不再集中塞进「Yiveno Probe」沙盒夹。维护者本机即测试场。
 */

import {
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds,
  buildNoiseBookmarkSeeds,
  buildNoiseExcerptSeeds,
  DEFAULT_PROBE_FILLER_SEED,
  resolveProbeCorpora,
  type RecallProbeBookmarkSeed,
  type RecallProbeExcerptSeed,
  type RecallProbePersonaId
} from '@yiveno/probe'
import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { SeedRecallProbePayload } from '@/core/messaging/debug-messages'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE } from '@/infrastructure/indexeddb/constants'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 历史沙盒夹标题（仅清理兼容；种库不再创建）。
 * @deprecated 新种库使用真实主题文件夹
 */
export const RECALL_PROBE_BOOKMARK_FOLDER_TITLE = 'Yiveno Probe'

/** 主题包 → 书签栏下常见英文文件夹名（模拟真实用户结构）。 */
export const PROBE_PERSONA_BOOKMARK_FOLDERS: Readonly<
  Record<RecallProbePersonaId, readonly string[]>
> = {
  researcher: ['Research', 'Reading list'],
  creator: ['Design', 'Inspiration'],
  developer: ['Dev docs', 'Engineering'],
  student: ['Courses', 'Study'],
  knowledge_worker: ['Work', 'Ops']
}

/** 半仿真/干扰散落用的杂项夹。 */
export const PROBE_FILLER_BOOKMARK_FOLDERS = ['Later', 'Misc', 'Archive'] as const

/** 种库可能创建的全部文件夹标题（含历史沙盒夹，供清理识别）。 */
export function listProbeSeedChromeFolderTitles(): readonly string[] {
  const titles = new Set<string>([
    RECALL_PROBE_BOOKMARK_FOLDER_TITLE,
    ...PROBE_FILLER_BOOKMARK_FOLDERS
  ])
  for (const folders of Object.values(PROBE_PERSONA_BOOKMARK_FOLDERS)) {
    for (const title of folders) {
      titles.add(title)
    }
  }
  return [...titles]
}

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
export async function wipeAllChromeBookmarkChildren(): Promise<number> {
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

/** 书签栏根 id。 */
async function getBookmarkBarId(): Promise<string> {
  const tree = await chrome.bookmarks.getTree()
  const bar = tree[0]?.children?.[0]
  if (!bar) {
    throw new Error('找不到 Chrome 书签栏根节点')
  }
  return bar.id
}

/** 在指定父节点下创建或复用同名文件夹。 */
async function ensureChildFolder(parentId: string, title: string): Promise<string> {
  const children = await chrome.bookmarks.getChildren(parentId)
  const existing = children.find(node => node.title === title && !node.url)
  if (existing) {
    return existing.id
  }
  const created = await chrome.bookmarks.create({ parentId, title })
  return created.id
}

/**
 * 为已选主题包准备真实感文件夹；返回栏 id、主题夹、散落用夹池。
 */
async function ensureRealisticChromeFolders(personas: readonly RecallProbePersonaId[]): Promise<{
  barId: string
  foldersByPersona: Map<RecallProbePersonaId, string[]>
  scatterFolderIds: string[]
}> {
  const barId = await getBookmarkBarId()
  const foldersByPersona = new Map<RecallProbePersonaId, string[]>()
  const scatterFolderIds: string[] = []

  for (const persona of personas) {
    const titles = PROBE_PERSONA_BOOKMARK_FOLDERS[persona]
    const ids: string[] = []
    for (const title of titles) {
      const id = await ensureChildFolder(barId, title)
      ids.push(id)
      scatterFolderIds.push(id)
    }
    foldersByPersona.set(persona, ids)
  }

  for (const title of PROBE_FILLER_BOOKMARK_FOLDERS) {
    scatterFolderIds.push(await ensureChildFolder(barId, title))
  }

  return { barId, foldersByPersona, scatterFolderIds }
}

/**
 * 选父节点：约 1/6 散落在书签栏，其余轮询主题夹（像真用户夹 + 栏上零散书签）。
 */
function pickBookmarkParentId(index: number, barId: string, folderIds: readonly string[]): string {
  if (folderIds.length === 0 || index % 6 === 0) {
    return barId
  }
  return folderIds[index % folderIds.length]!
}

async function seedBookmark(
  parentId: string,
  seed: RecallProbeBookmarkSeed,
  options: { enrich: boolean }
): Promise<string> {
  const chromeCreatedAt = daysAgoIso(seed.daysAgo)
  const node = await chrome.bookmarks.create({
    parentId,
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
    noiseExcerptCount: payload.noiseExcerptCount,
    fillerSeed: payload.fillerSeed ?? DEFAULT_PROBE_FILLER_SEED
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

    const corpora = resolveProbeCorpora(payload.personas)
    const personaIds = corpora.map(c => c.persona)
    const { barId, foldersByPersona, scatterFolderIds } =
      await ensureRealisticChromeFolders(personaIds)
    logger.info('DevProbe', 'Chrome 书签按真实主题文件夹写入（非 Yiveno Probe 沙盒夹）', {
      personas: personaIds,
      scatterFolders: scatterFolderIds.length
    })

    const probeKeys: string[] = []
    let bookmarkCount = 0
    let excerptCount = 0
    const memoryOnlyFill = payload.chromeBookmarkSync === 'curated_only'

    for (const corpus of corpora) {
      const personaFolders = foldersByPersona.get(corpus.persona) ?? []
      let curatedBmIndex = 0
      for (const bm of corpus.bookmarks) {
        const parentId = pickBookmarkParentId(curatedBmIndex, barId, personaFolders)
        curatedBmIndex += 1
        probeKeys.push(await seedBookmark(parentId, bm, { enrich: payload.enrichCurated }))
        bookmarkCount += 1
      }
      for (const ex of corpus.excerpts) {
        probeKeys.push(
          payload.enrichCurated ? await seedExcerptCurated(ex) : await seedExcerptQuiet(ex)
        )
        excerptCount += 1
      }
    }

    const fillerSeed = payload.fillerSeed ?? DEFAULT_PROBE_FILLER_SEED
    const bmSplits = splitCountAcrossPersonas(payload.diversityBookmarkCount, personaIds)
    const exSplits = splitCountAcrossPersonas(payload.diversityExcerptCount, personaIds)

    const diversityBookmarks: RecallProbeBookmarkSeed[] = []
    const diversityExcerpts: RecallProbeExcerptSeed[] = []
    for (let i = 0; i < personaIds.length; i += 1) {
      const persona = personaIds[i]!
      diversityBookmarks.push(
        ...buildDiversityBookmarkSeeds(persona, bmSplits[i] ?? 0, { seed: fillerSeed })
      )
      diversityExcerpts.push(
        ...buildDiversityExcerptSeeds(persona, exSplits[i] ?? 0, { seed: fillerSeed })
      )
    }

    const noiseBookmarks = buildNoiseBookmarkSeeds(payload.noiseBookmarkCount, {
      seed: fillerSeed
    })
    const noiseExcerpts = buildNoiseExcerptSeeds(payload.noiseExcerptCount, {
      seed: fillerSeed
    })

    if (memoryOnlyFill) {
      await seedBookmarksBulkMemoryOnly([...diversityBookmarks, ...noiseBookmarks])
      await seedExcerptsBulkQuiet([...diversityExcerpts, ...noiseExcerpts])
    } else {
      let fillerBmIndex = 0
      for (const bm of [...diversityBookmarks, ...noiseBookmarks]) {
        const parentId = pickBookmarkParentId(fillerBmIndex, barId, scatterFolderIds)
        fillerBmIndex += 1
        await seedBookmark(parentId, bm, { enrich: false })
      }
      for (const ex of diversityExcerpts) {
        await seedExcerptQuiet(ex)
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
