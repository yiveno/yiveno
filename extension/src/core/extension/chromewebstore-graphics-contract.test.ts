/**
 * CHROMEWEBSTORE.md Graphics ↔ brand-assets/chrome-web-store 母本契约（A14 #6）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CHROMEWEBSTORE_GRAPHICS,
  CHROMEWEBSTORE_GRAPHICS_DIR
} from '@/core/extension/extension-cws-graphics-contract'
import { CHROMEWEBSTORE_DOC_PATH } from '@/core/extension/extension-cws-contract'

/** 读取 PNG IHDR 宽高（契约单测专用）。 */
function readPngDimensions(filePath: string): { width: number; height: number } {
  const buffer = readFileSync(filePath)
  if (buffer.length < 24) {
    throw new Error(`PNG 过短: ${filePath}`)
  }
  const signature = buffer.subarray(0, 8)
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!signature.equals(pngSignature)) {
    throw new Error(`非 PNG 文件: ${filePath}`)
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

const repoRoot = resolve(import.meta.dirname, '../../../../')
const graphicsRoot = resolve(repoRoot, CHROMEWEBSTORE_GRAPHICS_DIR)
const cwsDocPath = resolve(repoRoot, CHROMEWEBSTORE_DOC_PATH)

describe('CHROMEWEBSTORE Graphics ↔ brand-assets 契约', () => {
  it('必填截图母本存在且尺寸为 1280×800', () => {
    const requiredScreenshots = CHROMEWEBSTORE_GRAPHICS.filter(
      graphic => graphic.kind === 'screenshot' && graphic.requiredForListing
    )
    expect(requiredScreenshots.length).toBeGreaterThan(0)

    for (const graphic of requiredScreenshots) {
      const absolutePath = resolve(graphicsRoot, graphic.filename)
      expect(existsSync(absolutePath)).toBe(true)
      const { width, height } = readPngDimensions(absolutePath)
      expect(width).toBe(graphic.width)
      expect(height).toBe(graphic.height)
    }
  })

  it('权威图形表所列母本均存在且像素尺寸一致', () => {
    for (const graphic of CHROMEWEBSTORE_GRAPHICS) {
      const absolutePath = resolve(graphicsRoot, graphic.filename)
      expect(existsSync(absolutePath)).toBe(true)
      const { width, height } = readPngDimensions(absolutePath)
      expect(width).toBe(graphic.width)
      expect(height).toBe(graphic.height)
    }
  })

  it('CHROMEWEBSTORE.md Graphics 表引用权威母本文件名', () => {
    const content = readFileSync(cwsDocPath, 'utf8')
    for (const graphic of CHROMEWEBSTORE_GRAPHICS) {
      expect(content).toContain(graphic.filename)
    }
  })
})
