/**
 * 页面预览截图编排：保存时截、打开后补图（每周一次）、申请持久化存储。
 * 禁止后台打开链接 / ping 站点——只截当前可见 tab。
 */

import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { captureVisibleTabAsJpegPreview } from '@/infrastructure/browser/capture-visible-tab-jpeg'
import { pagePreviewRepository } from '@/infrastructure/indexeddb/page-preview-repository'
import {
  buildPagePreviewId,
  isCapturablePagePreviewUrl,
  normalizePagePreviewUrlKey,
  PAGE_PREVIEW_OPEN_BACKFILL_DELAY_MS,
  PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS,
  type PagePreviewSource
} from '@/infrastructure/indexeddb/page-preview-types'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

let persistRequested = false

/** 申请 IndexedDB 持久化（best-effort；只试一次/进程）。 */
export async function ensurePagePreviewStoragePersist(): Promise<void> {
  if (persistRequested) {
    return
  }
  persistRequested = true
  try {
    const storage = globalThis.navigator?.storage
    if (storage && typeof storage.persist === 'function') {
      const granted = await storage.persist()
      logger.info('PagePreview', 'storage.persist 结果', { granted })
    }
  } catch (error) {
    logger.info('PagePreview', 'storage.persist 不可用', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

async function storeCapturedPreview(input: {
  ownerId: string
  urlKey: string
  source: PagePreviewSource
  blob: Blob
  width: number
  height: number
  byteSize: number
}): Promise<void> {
  await ensurePagePreviewStoragePersist()
  const now = new Date().toISOString()
  const { evicted } = await pagePreviewRepository.putRecord({
    id: buildPagePreviewId(input.ownerId, input.urlKey),
    ownerId: input.ownerId,
    urlKey: input.urlKey,
    blob: input.blob,
    byteSize: input.byteSize,
    width: input.width,
    height: input.height,
    capturedAt: now,
    lastShownAt: now,
    source: input.source
  })
  if (evicted > 0) {
    logger.info('PagePreview', 'LRU 淘汰', { evicted, ownerId: input.ownerId })
  }
}

/**
 * 保存书签/摘录后：对当前可见 tab 截一张（URL 须可截且与期望一致）。
 * fire-and-forget 安全；失败静默走无图。
 */
export async function capturePagePreviewOnSave(input: {
  pageUrl: string
  windowId?: number
}): Promise<boolean> {
  const startedAt = flowStart('PagePreview', '保存时截图')
  const urlKey = normalizePagePreviewUrlKey(input.pageUrl)
  if (!urlKey || !isCapturablePagePreviewUrl(input.pageUrl)) {
    flowOk('PagePreview', '保存时截图', startedAt, { ok: false, reason: 'uncapturable' })
    return false
  }

  try {
    const ownerId = await getCurrentOwnerId()
    const captured = await captureVisibleTabAsJpegPreview({
      ...(input.windowId !== undefined ? { windowId: input.windowId } : {}),
      expectedUrl: input.pageUrl
    })
    if (!captured) {
      flowOk('PagePreview', '保存时截图', startedAt, { ok: false, reason: 'capture_failed' })
      return false
    }
    await storeCapturedPreview({
      ownerId,
      urlKey,
      source: 'capture',
      blob: captured.blob,
      width: captured.width,
      height: captured.height,
      byteSize: captured.byteSize
    })
    flowOk('PagePreview', '保存时截图', startedAt, {
      ok: true,
      byteSize: captured.byteSize,
      width: captured.width
    })
    return true
  } catch (error) {
    logger.warn('PagePreview', '保存时截图异常', error)
    flowOk('PagePreview', '保存时截图', startedAt, { ok: false, reason: 'exception' })
    return false
  }
}

/** 打开补图：是否距上次捕获不足一周。 */
export function shouldSkipOpenBackfillForThrottle(
  capturedAtIso: string | undefined,
  nowMs = Date.now()
): boolean {
  if (!capturedAtIso) {
    return false
  }
  const capturedMs = Date.parse(capturedAtIso)
  if (Number.isNaN(capturedMs)) {
    return false
  }
  return nowMs - capturedMs < PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS
}

const pendingBackfillTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 用户打开库内 URL 后：延迟数秒再截活动 tab（每周每 URL 最多一次）。
 * 不打开新标签、不 ping。
 */
export function schedulePagePreviewOpenBackfill(input: {
  pageUrl: string
  windowId?: number
  delayMs?: number
}): void {
  const urlKey = normalizePagePreviewUrlKey(input.pageUrl)
  if (!urlKey || !isCapturablePagePreviewUrl(input.pageUrl)) {
    return
  }

  const existing = pendingBackfillTimers.get(urlKey)
  if (existing !== undefined) {
    clearTimeout(existing)
  }

  const delay = input.delayMs ?? PAGE_PREVIEW_OPEN_BACKFILL_DELAY_MS
  const timer = setTimeout(() => {
    pendingBackfillTimers.delete(urlKey)
    void runOpenBackfill({
      pageUrl: input.pageUrl,
      urlKey,
      ...(input.windowId !== undefined ? { windowId: input.windowId } : {})
    })
  }, delay)
  pendingBackfillTimers.set(urlKey, timer)
}

async function runOpenBackfill(input: {
  pageUrl: string
  urlKey: string
  windowId?: number
}): Promise<void> {
  const startedAt = flowStart('PagePreview', '打开补图')
  try {
    const ownerId = await getCurrentOwnerId()
    const existing = await pagePreviewRepository.getByUrl(ownerId, input.urlKey)
    if (shouldSkipOpenBackfillForThrottle(existing?.capturedAt)) {
      flowOk('PagePreview', '打开补图', startedAt, { ok: false, reason: 'throttled' })
      return
    }

    const captured = await captureVisibleTabAsJpegPreview({
      ...(input.windowId !== undefined ? { windowId: input.windowId } : {}),
      expectedUrl: input.pageUrl
    })
    if (!captured) {
      flowOk('PagePreview', '打开补图', startedAt, { ok: false, reason: 'capture_failed' })
      return
    }

    await storeCapturedPreview({
      ownerId,
      urlKey: input.urlKey,
      source: 'open_backfill',
      blob: captured.blob,
      width: captured.width,
      height: captured.height,
      byteSize: captured.byteSize
    })
    flowOk('PagePreview', '打开补图', startedAt, {
      ok: true,
      byteSize: captured.byteSize,
      hadExisting: Boolean(existing)
    })
  } catch (error) {
    logger.warn('PagePreview', '打开补图异常', error)
    flowOk('PagePreview', '打开补图', startedAt, { ok: false, reason: 'exception' })
  }
}
