/**
 * `memory_page_previews`：库内 URL 的本机截图预览（Blob；不进 Backup / 云同步）。
 */

import { z } from 'zod'

/** 预览来源闭集。 */
export const PagePreviewSourceSchema = z.enum([
  'capture', // 保存书签/摘录时截
  'open_backfill' // 打开库内 URL 后补图
])

export type PagePreviewSource = z.infer<typeof PagePreviewSourceSchema>

/** 主键：`` `${ownerId}\0${urlKey}` `` */
export function buildPagePreviewId(ownerId: string, urlKey: string): string {
  return `${ownerId}\0${urlKey}`
}

/**
 * 规范化预览 URL 键：仅 http(s)；去 hash；host 小写；非根 path 去尾 `/`。
 * 不可截 / 非 http(s) → null。
 */
export function normalizePagePreviewUrlKey(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * 是否允许 captureVisibleTab：仅公网 http(s)；排除 Web Store / 明显不可截页。
 * chrome://、扩展页在 normalize 阶段已排除。
 */
export function isCapturablePagePreviewUrl(url: string): boolean {
  const key = normalizePagePreviewUrlKey(url)
  if (!key) {
    return false
  }
  try {
    const parsed = new URL(key)
    if (parsed.hostname === 'chromewebstore.google.com') {
      return false
    }
    if (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/** 元数据 schema（Blob 单独校验，避免 Zod 在部分环境对 Blob 不稳）。 */
export const PagePreviewMetaSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().uuid(),
  urlKey: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** ISO：写入时间 */
  capturedAt: z.string().datetime(),
  /** ISO：最近一次展示（悬停浮层）；LRU 用 */
  lastShownAt: z.string().datetime(),
  source: PagePreviewSourceSchema
})

export type PagePreviewMeta = z.infer<typeof PagePreviewMetaSchema>

/** 完整预览行（API 面用 Blob；IDB 落盘为 ArrayBuffer，见 repository）。 */
export type PagePreviewRecord = PagePreviewMeta & {
  blob: Blob
}

/** IDB 落盘形状：二进制用 ArrayBuffer（避免 fake-indexeddb / 跨 realm 丢 Blob.size）。 */
export type PagePreviewStoredRow = PagePreviewMeta & {
  bytes: ArrayBuffer
  mimeType: string
}

/** LRU：条数上限。 */
export const PAGE_PREVIEW_MAX_ENTRIES = 2000

/** LRU：字节上限（约 200MB）。 */
export const PAGE_PREVIEW_MAX_BYTES = 200 * 1024 * 1024

/** 打开补图：同一 URL 最短间隔（7 天）。 */
export const PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/** 打开后等待再截（毫秒）：tab 稳定可见。 */
export const PAGE_PREVIEW_OPEN_BACKFILL_DELAY_MS = 3000

/** 缩略图目标宽（px）。 */
export const PAGE_PREVIEW_TARGET_WIDTH_PX = 320

/** JPEG 质量（0–1）。 */
export const PAGE_PREVIEW_JPEG_QUALITY = 0.5

/** LRU 候选行（不含刚写入的 keepId）。 */
export type PagePreviewLruCandidate = {
  id: string
  byteSize: number
  lastShownAt: string
  capturedAt: string
}

/**
 * 选出应淘汰的 id：先按 lastShownAt（再 capturedAt）升序，直到条目/字节回到上限内。
 * keepId 永不进候选（刚写入条）。
 */
export function pickPagePreviewLruVictims(
  rows: readonly PagePreviewLruCandidate[],
  keepId: string,
  limits: { maxEntries: number; maxBytes: number } = {
    maxEntries: PAGE_PREVIEW_MAX_ENTRIES,
    maxBytes: PAGE_PREVIEW_MAX_BYTES
  }
): string[] {
  let totalBytes = rows.reduce((sum, row) => sum + row.byteSize, 0)
  let liveCount = rows.length
  const candidates = rows
    .filter(row => row.id !== keepId)
    .slice()
    .sort((a, b) => {
      const shown = a.lastShownAt.localeCompare(b.lastShownAt)
      if (shown !== 0) {
        return shown
      }
      return a.capturedAt.localeCompare(b.capturedAt)
    })
  const victims: string[] = []
  while ((liveCount > limits.maxEntries || totalBytes > limits.maxBytes) && candidates.length > 0) {
    const victim = candidates.shift()
    if (!victim) {
      break
    }
    victims.push(victim.id)
    totalBytes -= victim.byteSize
    liveCount -= 1
  }
  return victims
}
