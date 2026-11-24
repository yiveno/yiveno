/**
 * 将活动标签可见区域截为 320px 宽 JPEG Blob（OffscreenCanvas；SW 可用）。
 * 不访问目标站点网络——仅 chrome.tabs.captureVisibleTab。
 */

import {
  isCapturablePagePreviewUrl,
  normalizePagePreviewUrlKey,
  PAGE_PREVIEW_JPEG_QUALITY,
  PAGE_PREVIEW_TARGET_WIDTH_PX
} from '@/infrastructure/indexeddb/page-preview-types'
import { logger } from '@/infrastructure/logging/logger'

export type CapturedPagePreviewJpeg = {
  blob: Blob
  width: number
  height: number
  byteSize: number
}

/** captureVisibleTabAsJpegPreview 失败细分（供 flowOk / 真机复验）。 */
export type CaptureVisibleTabFailureReason =
  | 'uncapturable' // 期望 URL 不可截
  | 'gate_mismatch' // 活动 tab URL 与期望不符
  | 'capture_empty' // captureVisibleTab 未返回 data URL
  | 'resize_error' // createImageBitmap / OffscreenCanvas 链失败

export type CaptureVisibleTabJpegResult =
  | { ok: true; preview: CapturedPagePreviewJpeg }
  | {
      ok: false
      reason: CaptureVisibleTabFailureReason
      expectedHost?: string | null
      activeHost?: string | null
      error?: string
    }

/**
 * data URL / blob → 缩略 JPEG。
 * 纯函数侧：依赖 createImageBitmap + OffscreenCanvas（Chrome MV3 SW 支持）。
 */
export async function resizeImageSourceToJpegPreview(
  source: Blob | ImageBitmap,
  options?: { targetWidth?: number; quality?: number }
): Promise<CapturedPagePreviewJpeg> {
  const targetWidth = options?.targetWidth ?? PAGE_PREVIEW_TARGET_WIDTH_PX
  const quality = options?.quality ?? PAGE_PREVIEW_JPEG_QUALITY

  const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source)
  try {
    const scale = targetWidth / Math.max(1, bitmap.width)
    const width = targetWidth
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('OffscreenCanvas 2d 不可用')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    return { blob, width, height, byteSize: blob.size }
  } finally {
    bitmap.close()
  }
}

/**
 * 截取指定窗口当前可见标签；失败返回 ok:false（chrome://、权限、用户手势等）。
 * 调用方须尽量传入 windowId（SW 无可靠 currentWindow）；仍做 expectedUrl 门禁。
 */
export async function captureVisibleTabAsJpegPreview(input: {
  windowId?: number
  /** 期望 URL；若与活动 tab 不一致则跳过（避免截错页） */
  expectedUrl?: string
}): Promise<CaptureVisibleTabJpegResult> {
  if (input.expectedUrl && !isCapturablePagePreviewUrl(input.expectedUrl)) {
    return { ok: false, reason: 'uncapturable', expectedHost: safeHost(input.expectedUrl) }
  }

  const windowId = input.windowId
  const queryFilter: chrome.tabs.QueryInfo = {
    active: true,
    ...(windowId !== undefined ? { windowId } : { currentWindow: true })
  }

  try {
    if (input.expectedUrl) {
      const tabs = await chrome.tabs.query(queryFilter)
      const active = tabs[0]
      if (!active?.url || !urlsMatchForPreview(active.url, input.expectedUrl)) {
        const expectedHost = safeHost(input.expectedUrl)
        const activeHost = active?.url ? safeHost(active.url) : null
        logger.info('PagePreview', '跳过截图：活动 tab URL 与期望不符', {
          expectedHost,
          activeHost,
          hasWindowId: windowId !== undefined
        })
        return {
          ok: false,
          reason: 'gate_mismatch',
          expectedHost,
          activeHost
        }
      }
      if (!isCapturablePagePreviewUrl(active.url)) {
        return {
          ok: false,
          reason: 'uncapturable',
          expectedHost: safeHost(input.expectedUrl),
          activeHost: safeHost(active.url)
        }
      }
    }

    let dataUrl: string
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, {
        format: 'jpeg',
        quality: 80
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.info('PagePreview', 'captureVisibleTab 失败（走无图 fallback）', {
        error: message,
        hasWindowId: windowId !== undefined
      })
      return {
        ok: false,
        reason: 'capture_empty',
        expectedHost: input.expectedUrl ? safeHost(input.expectedUrl) : null,
        error: message
      }
    }
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      logger.info('PagePreview', 'captureVisibleTab 返回非 data URL（走无图 fallback）', {
        hasWindowId: windowId !== undefined
      })
      return {
        ok: false,
        reason: 'capture_empty',
        expectedHost: input.expectedUrl ? safeHost(input.expectedUrl) : null
      }
    }
    try {
      const response = await fetch(dataUrl)
      const rawBlob = await response.blob()
      const preview = await resizeImageSourceToJpegPreview(rawBlob)
      return { ok: true, preview }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.info('PagePreview', 'captureVisibleTab 失败（走无图 fallback）', {
        error: message,
        hasWindowId: windowId !== undefined
      })
      return {
        ok: false,
        reason: 'resize_error',
        expectedHost: input.expectedUrl ? safeHost(input.expectedUrl) : null,
        error: message
      }
    }
  } catch (error) {
    // tabs.query 等门禁外围失败：归入 capture_empty，便于真机一次读出
    const message = error instanceof Error ? error.message : String(error)
    logger.info('PagePreview', 'captureVisibleTab 失败（走无图 fallback）', {
      error: message,
      hasWindowId: windowId !== undefined
    })
    return {
      ok: false,
      reason: 'capture_empty',
      expectedHost: input.expectedUrl ? safeHost(input.expectedUrl) : null,
      error: message
    }
  }
}

/**
 * 比较预览用途：与 normalizePagePreviewUrlKey 对齐（去 hash、尾斜杠、host 大小写）；
 * 非 http(s) 时回退为清 hash 后的 href 小写比较。
 */
export function urlsMatchForPreview(left: string, right: string): boolean {
  const aKey = normalizePagePreviewUrlKey(left)
  const bKey = normalizePagePreviewUrlKey(right)
  if (aKey && bKey) {
    return aKey === bKey
  }
  try {
    const a = new URL(left)
    const b = new URL(right)
    a.hash = ''
    b.hash = ''
    return a.href.toLowerCase() === b.href.toLowerCase()
  } catch {
    return false
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
