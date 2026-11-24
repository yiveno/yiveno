/**
 * 打开库内条目后：延迟读可见 tab 正文 → Worker 提炼 → 写入 auto_extract 摘录。
 * 与补图共享触发点与延迟/周节流语义；绝不主动开 tab 或 ping URL。
 */

import { requestPageExtractSummary } from '@/application/memory/extract-llm-client'
import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import type { MemoryItem } from '@/core/memory/memory-item'
import { urlsMatchForPreview } from '@/infrastructure/browser/capture-visible-tab-jpeg'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import {
  normalizePagePreviewUrlKey,
  PAGE_PREVIEW_OPEN_BACKFILL_DELAY_MS,
  PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS
} from '@/infrastructure/indexeddb/page-preview-types'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { bumpMemoryLibraryRevision } from '@/infrastructure/storage/memory-library-revision-storage'

/** 送 Worker 的正文截断上限（与 Worker Zod 一致）。 */
export const PAGE_CONTENT_EXTRACT_TEXT_MAX_CHARS = 12_000

/** 打开提炼：是否距上次 auto_extract updatedAt 不足一周。 */
export function shouldSkipContentExtractForThrottle(
  updatedAtIso: string | undefined,
  nowMs = Date.now()
): boolean {
  if (!updatedAtIso) {
    return false
  }
  const updatedMs = Date.parse(updatedAtIso)
  if (Number.isNaN(updatedMs)) {
    return false
  }
  return nowMs - updatedMs < PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS
}

const pendingExtractTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 用户打开库内条目后调度提炼（与补图同触发点）。
 * 门不满足 / 节流 / 读正文失败均静默跳过。
 */
export function schedulePageContentExtractOnOpen(input: {
  item: MemoryItem
  pageUrl: string
  windowId?: number
  delayMs?: number
}): void {
  const urlKey = normalizePagePreviewUrlKey(input.pageUrl)
  if (!urlKey) {
    return
  }

  // 防自循环：打开的就是自动提炼摘录本身
  if (input.item.type === 'text_excerpt' && input.item.payload.origin === 'auto_extract') {
    void logSkip('self_loop', urlKey)
    return
  }

  const existing = pendingExtractTimers.get(urlKey)
  if (existing !== undefined) {
    clearTimeout(existing)
  }

  const delay = input.delayMs ?? PAGE_PREVIEW_OPEN_BACKFILL_DELAY_MS
  const timer = setTimeout(() => {
    pendingExtractTimers.delete(urlKey)
    void runContentExtract({
      pageUrl: input.pageUrl,
      urlKey,
      ...(input.windowId !== undefined ? { windowId: input.windowId } : {})
    })
  }, delay)
  pendingExtractTimers.set(urlKey, timer)
}

async function logSkip(reason: string, urlKey: string): Promise<void> {
  const startedAt = flowStart('ContentExtract', '打开提炼')
  flowOk('ContentExtract', '打开提炼', startedAt, { ok: false, reason, urlKey })
}

async function runContentExtract(input: {
  pageUrl: string
  urlKey: string
  windowId?: number
}): Promise<void> {
  const startedAt = flowStart('ContentExtract', '打开提炼')
  try {
    const settings = await getUserSettings()
    if (!settings.contentExtractEnabled) {
      flowOk('ContentExtract', '打开提炼', startedAt, { ok: false, reason: 'extract_disabled' })
      return
    }
    if (!settings.aiFeaturesEnabled) {
      flowOk('ContentExtract', '打开提炼', startedAt, { ok: false, reason: 'ai_disabled' })
      return
    }

    const accessToken = (await getWorkerApiAccessToken())?.trim()
    if (!accessToken) {
      flowOk('ContentExtract', '打开提炼', startedAt, { ok: false, reason: 'no_token' })
      return
    }

    const ownerId = await getCurrentOwnerId()
    const existing = await memoryItemRepository.findAutoExtractBySourceUrl(input.pageUrl, ownerId)
    if (shouldSkipContentExtractForThrottle(existing?.updatedAt)) {
      flowOk('ContentExtract', '打开提炼', startedAt, { ok: false, reason: 'throttled' })
      return
    }

    const page = await readVisibleTabPageText({
      expectedUrl: input.pageUrl,
      ...(input.windowId !== undefined ? { windowId: input.windowId } : {})
    })
    if (!page.ok) {
      flowOk('ContentExtract', '打开提炼', startedAt, {
        ok: false,
        reason: page.reason,
        expectedHost: page.expectedHost ?? null,
        activeHost: page.activeHost ?? null
      })
      return
    }

    const llm = await requestPageExtractSummary({
      accessToken,
      url: input.pageUrl,
      text: page.text,
      ...(page.title ? { title: page.title } : {})
    })
    if (!llm.ok) {
      flowOk('ContentExtract', '打开提炼', startedAt, {
        ok: false,
        reason: llm.skipped ? 'llm_skipped' : 'llm_failed',
        errorCode: llm.errorCode
      })
      return
    }

    const upserted = await memoryItemRepository.upsertAutoExtractExcerpt({
      sourceUrl: input.pageUrl,
      pageTitle: page.title || existingTitle(existing) || input.urlKey,
      summary: llm.summary
    })
    scheduleAsyncMemoryEmbedding(upserted.item.id)
    void bumpMemoryLibraryRevision().catch(error => {
      logger.warn('ContentExtract', '提炼后 bump library revision 失败', error)
    })

    flowOk('ContentExtract', '打开提炼', startedAt, {
      ok: true,
      created: upserted.created,
      itemId: upserted.item.id,
      summaryLength: llm.summary.length,
      model: llm.model
    })
  } catch (error) {
    logger.warn('ContentExtract', '打开提炼异常', error)
    flowOk('ContentExtract', '打开提炼', startedAt, { ok: false, reason: 'exception' })
  }
}

function existingTitle(item: MemoryItem | null): string {
  if (item?.type === 'text_excerpt') {
    return item.payload.pageTitle.trim()
  }
  return ''
}

type ReadPageTextResult =
  | { ok: true; text: string; title: string }
  | {
      ok: false
      reason: 'gate_mismatch' | 'no_tab' | 'script_failed' | 'empty_text'
      expectedHost?: string | null
      activeHost?: string | null
    }

/**
 * 只读活动可见 tab 的 body.innerText；URL 与期望不符则放弃。
 */
export async function readVisibleTabPageText(input: {
  expectedUrl: string
  windowId?: number
}): Promise<ReadPageTextResult> {
  const queryFilter: chrome.tabs.QueryInfo = {
    active: true,
    ...(input.windowId !== undefined ? { windowId: input.windowId } : { currentWindow: true })
  }

  let active: chrome.tabs.Tab | undefined
  try {
    const tabs = await chrome.tabs.query(queryFilter)
    active = tabs[0]
  } catch {
    return { ok: false, reason: 'no_tab' }
  }

  if (!active?.id || !active.url) {
    return { ok: false, reason: 'no_tab', expectedHost: safeHost(input.expectedUrl) }
  }

  if (!urlsMatchForPreview(active.url, input.expectedUrl)) {
    return {
      ok: false,
      reason: 'gate_mismatch',
      expectedHost: safeHost(input.expectedUrl),
      activeHost: safeHost(active.url)
    }
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: active.id },
      func: () => {
        const body = document.body?.innerText ?? ''
        return {
          text: body,
          title: document.title || ''
        }
      }
    })
    const raw = results[0]?.result
    if (!raw || typeof raw !== 'object' || !('text' in raw)) {
      return { ok: false, reason: 'script_failed', expectedHost: safeHost(input.expectedUrl) }
    }
    const text = String(raw.text).trim().slice(0, PAGE_CONTENT_EXTRACT_TEXT_MAX_CHARS)
    if (!text) {
      return { ok: false, reason: 'empty_text', expectedHost: safeHost(input.expectedUrl) }
    }
    const title = 'title' in raw ? String(raw.title).trim() : ''
    return { ok: true, text, title }
  } catch {
    return { ok: false, reason: 'script_failed', expectedHost: safeHost(input.expectedUrl) }
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
