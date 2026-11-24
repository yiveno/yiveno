/**
 * page-preview-types：bytesToDataUrl 等纯函数。
 */
import { describe, expect, it } from 'vitest'

import { bytesToDataUrl } from '@/infrastructure/indexeddb/page-preview-types'

describe('bytesToDataUrl', () => {
  it('已知字节 → data URL 前缀与 base64 内容', () => {
    const bytes = new TextEncoder().encode('hello').buffer as ArrayBuffer
    const dataUrl = bytesToDataUrl(bytes, 'image/jpeg')
    expect(dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(dataUrl).toBe(`data:image/jpeg;base64,${btoa('hello')}`)
  })

  it('空 bytes（byteLength 0）→ 空字符串', () => {
    expect(bytesToDataUrl(new ArrayBuffer(0), 'image/jpeg')).toBe('')
  })
})
