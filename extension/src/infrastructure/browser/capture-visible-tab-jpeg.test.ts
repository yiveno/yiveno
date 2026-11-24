import { describe, expect, it } from 'vitest'

import {
  resizeImageSourceToJpegPreview,
  urlsMatchForPreview
} from '@/infrastructure/browser/capture-visible-tab-jpeg'

describe('urlsMatchForPreview', () => {
  it('忽略 hash 与 host 大小写', () => {
    expect(urlsMatchForPreview('https://Example.com/a#x', 'https://example.com/a')).toBe(true)
    expect(urlsMatchForPreview('https://example.com/a', 'https://example.com/b')).toBe(false)
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
