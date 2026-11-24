import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  captureVisibleTabAsJpegPreview,
  resizeImageSourceToJpegPreview,
  urlsMatchForPreview
} from '@/infrastructure/browser/capture-visible-tab-jpeg'

describe('urlsMatchForPreview', () => {
  it('忽略 hash 与 host 大小写', () => {
    expect(urlsMatchForPreview('https://Example.com/a#x', 'https://example.com/a')).toBe(true)
    expect(urlsMatchForPreview('https://example.com/a', 'https://example.com/b')).toBe(false)
  })

  it('与 urlKey 对齐：忽略非根 path 尾斜杠', () => {
    expect(urlsMatchForPreview('https://example.com/a/', 'https://example.com/a')).toBe(true)
    expect(urlsMatchForPreview('https://example.com/a/?q=1', 'https://example.com/a?q=1')).toBe(
      true
    )
  })
})

describe('resizeImageSourceToJpegPreview', () => {
  it('缩到目标宽并产出 JPEG Blob', async () => {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      return
    }

    const canvas = new OffscreenCanvas(640, 400)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // 部分 vitest 环境 OffscreenCanvas 无 2d
      return
    }
    ctx.fillStyle = '#336699'
    ctx.fillRect(0, 0, 640, 400)
    const source = await canvas.convertToBlob({ type: 'image/png' })

    const result = await resizeImageSourceToJpegPreview(source, {
      targetWidth: 320,
      quality: 0.5
    })
    expect(result.width).toBe(320)
    expect(result.height).toBe(200)
    expect(result.blob.type).toContain('jpeg')
    expect(result.byteSize).toBeGreaterThan(0)
  })
})

describe('captureVisibleTabAsJpegPreview windowId', () => {
  const originalChrome = globalThis.chrome

  afterEach(() => {
    globalThis.chrome = originalChrome
    vi.restoreAllMocks()
  })

  it('传入 windowId 时 query / captureVisibleTab 使用该窗，不用 currentWindow', async () => {
    const query = vi.fn(async () => [
      { id: 11, windowId: 42, url: 'https://example.com/article', active: true }
    ])
    const captureVisibleTab = vi.fn(async () => {
      throw new Error('stop-before-resize')
    })

    globalThis.chrome = {
      tabs: { query, captureVisibleTab },
      windows: { WINDOW_ID_CURRENT: -2 }
    } as unknown as typeof chrome

    const result = await captureVisibleTabAsJpegPreview({
      windowId: 42,
      expectedUrl: 'https://example.com/article'
    })

    expect(query).toHaveBeenCalledWith({ active: true, windowId: 42 })
    expect(captureVisibleTab).toHaveBeenCalledWith(42, { format: 'jpeg', quality: 80 })
    expect(result).toMatchObject({ ok: false, reason: 'capture_empty' })
  })

  it('活动 tab URL 不符 → gate_mismatch（带 host）', async () => {
    const query = vi.fn(async () => [
      { id: 11, windowId: 1, url: 'https://other.example/x', active: true }
    ])
    const captureVisibleTab = vi.fn()

    globalThis.chrome = {
      tabs: { query, captureVisibleTab },
      windows: { WINDOW_ID_CURRENT: -2 }
    } as unknown as typeof chrome

    const result = await captureVisibleTabAsJpegPreview({
      windowId: 1,
      expectedUrl: 'https://example.com/article'
    })

    expect(captureVisibleTab).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      reason: 'gate_mismatch',
      expectedHost: 'example.com',
      activeHost: 'other.example'
    })
  })
})
