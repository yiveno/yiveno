/**
 * 书签检索 Profile 应用服务
 *
 * Pro + 语义检索：批量调用 LLM 生成检索描述，写入 IndexedDB，并触发向量失效。
 */

import { parseRetrievalProfileBatchResponse } from '@/application/ai/retrieval-profile-parser'
import { createRetrievalProfileBatchPrompt, RETRIEVAL_PROFILE_BATCH_SIZE } from '@/core/ai/prompts'
import {
  bookmarkNeedsRetrievalProfile,
  buildRetrievalProfileSourceHash
} from '@/core/ai/retrieval-profile-hash'
import {
  RETRIEVAL_PROFILE_CONTENT_VERSION,
  type RetrievalProfileBookmarkInput
} from '@/core/ai/retrieval-profile-types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { localVectorStore } from '@/infrastructure/embedding/local-vector-store'
import { hostedLLMClient } from '@/infrastructure/llm/hosted-llm-client'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'RetrievalProfileService'

/** 单次后台运行最多处理的批次数 */
export const RETRIEVAL_PROFILE_MAX_BATCHES_PER_RUN = 3

/** 批间间隔（毫秒），避免占满 API */
export const RETRIEVAL_PROFILE_BATCH_INTERVAL_MS = 1500

export interface RetrievalProfileSyncResult {
  updatedIds: string[]
  processed: number
  pendingRemaining: number
  stoppedReason: 'completed' | 'quota' | 'no-provider' | 'no-pending' | 'error'
}

function toProfileInput(bookmark: BookmarkRecord): RetrievalProfileBookmarkInput | null {
  if (!bookmark.url || bookmark.isFolder) {
    return null
  }

  const title = bookmark.title?.trim() ?? ''
  const url = bookmark.url.trim()
  if (!title || !url) {
    return null
  }

  return {
    id: String(bookmark.id),
    title,
    url
  }
}

/**
 * 筛选待生成 Profile 的书签
 */
export function selectBookmarksNeedingRetrievalProfile(
  bookmarks: BookmarkRecord[]
): BookmarkRecord[] {
  return bookmarks.filter(bookmark =>
    bookmarkNeedsRetrievalProfile(bookmark, RETRIEVAL_PROFILE_CONTENT_VERSION)
  )
}

/**
 * 估算检索 Profile 批次的输出 token 上限
 */
export function estimateRetrievalProfileMaxTokens(bookmarkCount: number): number {
  return Math.min(8192, 200 + bookmarkCount * 240)
}

/**
 * 执行一批检索 Profile 生成并持久化
 */
async function generateRetrievalProfileBatchOnce(
  bookmarks: RetrievalProfileBookmarkInput[]
): Promise<Map<string, { profile: string; keywords: string[] }>> {
  if (bookmarks.length === 0) {
    return new Map()
  }

  const validIds = new Set(bookmarks.map(item => item.id))
  const idByListIndex = new Map(bookmarks.map((item, index) => [String(index + 1), item.id]))
  const prompt = createRetrievalProfileBatchPrompt(bookmarks)
  const maxTokens = estimateRetrievalProfileMaxTokens(bookmarks.length)
  const MAX_PARSE_RETRIES = 1
  const MAX_LLM_RETRIES = 1

  let parsed: ReturnType<typeof parseRetrievalProfileBatchResponse> = []

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt += 1) {
    let resultText = ''

    for (let llmAttempt = 0; llmAttempt <= MAX_LLM_RETRIES; llmAttempt += 1) {
      try {
        const result = await llmAdapter.complete(prompt, {
          maxTokens,
          temperature: attempt === 0 ? 0.2 : 0.05
        })
        resultText = result.text
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const retryable =
          message.includes('deepseek_empty_response') ||
          message.includes('托管 AI 调用失败') ||
          message.includes('网络请求失败')

        if (llmAttempt < MAX_LLM_RETRIES && retryable) {
          logger.warn(LOG_TAG, 'LLM 调用失败，稍后重试', {
            llmAttempt: llmAttempt + 1,
            batchSize: bookmarks.length,
            message
          })
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }

        throw error
      }
    }

    parsed = parseRetrievalProfileBatchResponse(resultText, validIds, idByListIndex)
    if (parsed.length >= bookmarks.length) {
      break
    }

    if (attempt < MAX_PARSE_RETRIES) {
      logger.warn(LOG_TAG, '批次 JSON 不完整，重试 LLM', {
        attempt: attempt + 1,
        batchSize: bookmarks.length,
        parsed: parsed.length
      })
    }
  }

  const output = new Map<string, { profile: string; keywords: string[] }>()
  for (const item of parsed) {
    output.set(item.bookmarkId, {
      profile: item.profile,
      keywords: item.keywords
    })
  }

  return output
}

/**
 * 执行一批检索 Profile 生成；解析不完整时拆分子批重试缺失项
 */
async function generateRetrievalProfileBatch(
  bookmarks: RetrievalProfileBookmarkInput[]
): Promise<Map<string, { profile: string; keywords: string[] }>> {
  const output = await generateRetrievalProfileBatchOnce(bookmarks)
  const missing = bookmarks.filter(item => !output.has(item.id))

  if (missing.length === 0 || missing.length === bookmarks.length || bookmarks.length <= 2) {
    return output
  }

  logger.warn(LOG_TAG, '批次解析不完整，拆分子批重试缺失项', {
    requested: bookmarks.length,
    parsed: output.size,
    missing: missing.length
  })

  const subBatchSize = Math.max(2, Math.ceil(missing.length / 2))
  for (let index = 0; index < missing.length; index += subBatchSize) {
    const subBatch = missing.slice(index, index + subBatchSize)
    const subOutput = await generateRetrievalProfileBatch(subBatch)
    for (const [bookmarkId, profile] of subOutput) {
      output.set(bookmarkId, profile)
    }
  }

  return output
}

/**
 * 将 Profile 写入 IndexedDB，并使对应向量失效
 */
async function persistRetrievalProfiles(
  bookmarks: BookmarkRecord[],
  profiles: Map<string, { profile: string; keywords: string[] }>
): Promise<string[]> {
  const updatedIds: string[] = []
  const now = Date.now()

  for (const bookmark of bookmarks) {
    const id = String(bookmark.id)
    const generated = profiles.get(id)
    if (!generated || !bookmark.url) {
      continue
    }

    const sourceHash = buildRetrievalProfileSourceHash(bookmark.title, bookmark.url)
    const nextRecord: BookmarkRecord = {
      ...bookmark,
      retrievalProfile: generated.profile,
      retrievalKeywords: generated.keywords,
      retrievalProfileSourceHash: sourceHash,
      retrievalProfileVersion: RETRIEVAL_PROFILE_CONTENT_VERSION,
      retrievalProfileUpdatedAt: now
    }

    await indexedDBManager.updateBookmark(nextRecord)
    updatedIds.push(id)
  }

  if (updatedIds.length > 0) {
    await localVectorStore.deleteBatch(updatedIds)
  }

  return updatedIds
}

async function canContinueLlmGeneration(): Promise<boolean> {
  if (await llmAdapter.hasAvailableProvider()) {
    return true
  }
  return false
}

async function hasHostedQuotaRemaining(): Promise<boolean> {
  const quota = await hostedLLMClient.fetchQuota()
  if (!quota) {
    return true
  }
  return quota.remaining > 0
}

/**
 * 同步一批待处理书签的检索 Profile
 */
export async function runRetrievalProfileSyncBatch(
  maxBatches = RETRIEVAL_PROFILE_MAX_BATCHES_PER_RUN
): Promise<RetrievalProfileSyncResult> {
  try {
    await indexedDBManager.initialize()

    if (!(await canContinueLlmGeneration())) {
      logger.info(LOG_TAG, '无可用 LLM，跳过检索 Profile 同步')
      return {
        updatedIds: [],
        processed: 0,
        pendingRemaining: 0,
        stoppedReason: 'no-provider'
      }
    }

    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const pending = selectBookmarksNeedingRetrievalProfile(allBookmarks)

    if (pending.length === 0) {
      logger.info(LOG_TAG, '无待生成检索 Profile 的书签')
      return {
        updatedIds: [],
        processed: 0,
        pendingRemaining: 0,
        stoppedReason: 'no-pending'
      }
    }

    const allUpdatedIds: string[] = []
    let processed = 0
    let batchesRun = 0

    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
      if (!(await hasHostedQuotaRemaining())) {
        logger.warn(LOG_TAG, '托管 LLM 配额不足，暂停检索 Profile 同步')
        return {
          updatedIds: allUpdatedIds,
          processed,
          pendingRemaining: pending.length - processed,
          stoppedReason: 'quota'
        }
      }

      const sliceStart = batchIndex * RETRIEVAL_PROFILE_BATCH_SIZE
      const chunkRecords = pending.slice(sliceStart, sliceStart + RETRIEVAL_PROFILE_BATCH_SIZE)
      if (chunkRecords.length === 0) {
        break
      }

      const inputs = chunkRecords
        .map(toProfileInput)
        .filter((item): item is RetrievalProfileBookmarkInput => item !== null)

      if (inputs.length === 0) {
        processed += chunkRecords.length
        continue
      }

      logger.info(LOG_TAG, '▶ 检索 Profile 批次开始', {
        batch: batchIndex + 1,
        size: inputs.length
      })

      try {
        const profiles = await generateRetrievalProfileBatch(inputs)
        const updatedIds = await persistRetrievalProfiles(chunkRecords, profiles)
        allUpdatedIds.push(...updatedIds)
        processed += chunkRecords.length
        batchesRun += 1

        logger.info(LOG_TAG, '✅ 检索 Profile 批次完成', {
          batch: batchIndex + 1,
          requested: inputs.length,
          parsed: profiles.size,
          persisted: updatedIds.length
        })
      } catch (error) {
        logger.error(LOG_TAG, '检索 Profile 批次失败，跳过本批待下轮重试', {
          batch: batchIndex + 1,
          size: inputs.length,
          error
        })
      }

      if (
        batchIndex + 1 < maxBatches &&
        sliceStart + RETRIEVAL_PROFILE_BATCH_SIZE < pending.length
      ) {
        await new Promise(resolve => setTimeout(resolve, RETRIEVAL_PROFILE_BATCH_INTERVAL_MS))
      }
    }

    const stillPending = selectBookmarksNeedingRetrievalProfile(
      await indexedDBManager.getAllBookmarks()
    ).length

    logger.info(LOG_TAG, '检索 Profile 同步轮次结束', {
      processed,
      updated: allUpdatedIds.length,
      pendingRemaining: stillPending,
      batchesRun
    })

    return {
      updatedIds: allUpdatedIds,
      processed,
      pendingRemaining: stillPending,
      stoppedReason: stillPending > 0 ? 'completed' : 'completed'
    }
  } catch (error) {
    logger.error(LOG_TAG, '检索 Profile 同步失败', error)
    return {
      updatedIds: [],
      processed: 0,
      pendingRemaining: 0,
      stoppedReason: 'error'
    }
  }
}
