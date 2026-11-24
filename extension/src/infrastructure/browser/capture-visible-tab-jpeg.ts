/**
 * 将活动标签可见区域截为 320px 宽 JPEG Blob（OffscreenCanvas；SW 可用）。
 * 不访问目标站点网络——仅 chrome.tabs.captureVisibleTab。
 */

import {
  isCapturablePagePreviewUrl,
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
 * 截取指定窗口当前可见标签；失败返回 null（chrome://、权限、用户手势等）。
 * 调用方须保证 tab URL 可截；本函数仍做一次门禁。
 */
export async function captureVisibleTabAsJpegPreview(input: {
  windowId?: number
  /** 期望 URL；若与活动 tab 不一致则跳过（避免截错页） */
  expectedUrl?: string
}): Promise<CapturedPagePreviewJpeg | null> {
  if (input.expectedUrl && !isCapturablePagePreviewUrl(input.expectedUrl)) {
    return null
  }

  try {
    if (input.expectedUrl) {
      const tabs = await chrome.tabs.query({
        active: true,
        ...(input.windowId !== undefined ? { windowId: input.windowId } : { currentWindow: true })
      })
      const active = tabs[0]
      if (!active?.url || !urlsMatchForPreview(active.url, input.expectedUrl)) {
        logger.info('PagePreview', '跳过截图：活动 tab URL 与期望不符', {
          expectedHost: safeHost(input.expectedUrl),
          activeHost: active?.url ? safeHost(active.url) : null
        })
        return null
      }
      if (!isCapturablePagePreviewUrl(active.url)) {
        return null
      }
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(
      input.windowId ?? chrome.windows.WINDOW_ID_CURRENT,
      { format: 'jpeg', quality: 80 }
    )
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return null
    }
    const response = await fetch(dataUrl)
    const rawBlob = await response.blob()
    return await resizeImageSourceToJpegPreview(rawBlob)
  } catch (error) {
    logger.info('PagePreview', 'captureVisibleTab 失败（走无图 fallback）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/** 比较预览用途：忽略 hash；host 大小写不敏感。 */
export function urlsMatchForPreview(left: string, right: string): boolean {
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
