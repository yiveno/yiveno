/**
 * Manifest 回归：扩展图标与 MV3 CSP 契约。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  EXTENSION_ICON_FILES,
  EXTENSION_ICON_SIZES
} from '@/core/extension/extension-icon-contract'

interface ExtensionManifest {
  icons?: Record<string, string>
  action?: {
    default_icon?: Record<string, string>
  }
  content_security_policy?: {
    extension_pages?: string
    sandbox?: string
  }
  sandbox?: {
    pages?: string[]
  }
  content_scripts?: Array<{
    js?: string[]
    css?: string[]
    matches?: string[]
  }>
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')
const publicRoot = resolve(import.meta.dirname, '../../../public')
const pagesRoot = resolve(import.meta.dirname, '../../pages')

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

const EXTENSION_PAGE_HTML_PATHS = [
  'sidepanel/index.html',
  'settings/index.html',
  'detail/index.html',
  'library/index.html',
  'getting-started/index.html'
] as const

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Icons 契约', () => {
  it('icons 与 action.default_icon 使用权威 PNG 路径', () => {
    const manifest = readManifest()
    for (const size of EXTENSION_ICON_SIZES) {
      expect(manifest.icons?.[size]).toBe(EXTENSION_ICON_FILES[size])
      expect(manifest.action?.default_icon?.[size]).toBe(EXTENSION_ICON_FILES[size])
    }
  })

  it('public 下图标文件存在且像素尺寸与 manifest 键一致', () => {
    for (const size of EXTENSION_ICON_SIZES) {
      const relativePath = EXTENSION_ICON_FILES[size]
      const absolutePath = resolve(publicRoot, relativePath)
      expect(existsSync(absolutePath)).toBe(true)
      const { width, height } = readPngDimensions(absolutePath)
      const expected = Number(size)
      expect(width).toBe(expected)
      expect(height).toBe(expected)
    }
  })
})

describe('manifest CSP 契约', () => {
  it('不自定义放宽 extension_pages CSP（沿用 MV3 默认 script-src self）', () => {
    const manifest = readManifest()
    expect(manifest.content_security_policy?.extension_pages).toBeUndefined()
    expect(manifest.content_security_policy?.sandbox).toBeUndefined()
  })

  it('未声明 sandbox 页（无用户代码执行面）', () => {
    const manifest = readManifest()
    expect(manifest.sandbox?.pages ?? []).toEqual([])
  })

  it('content_scripts 仅引用打包 JS，无内联 CSS', () => {
    const manifest = readManifest()
    for (const entry of manifest.content_scripts ?? []) {
      expect(entry.css ?? []).toEqual([])
      for (const script of entry.js ?? []) {
        expect(script.endsWith('.js')).toBe(true)
        expect(script).not.toMatch(/^https?:\/\//)
      }
    }
  })
})

describe('扩展页 HTML CSP 契约', () => {
  it('各扩展页仅使用 type=module 外链脚本', () => {
    for (const pagePath of EXTENSION_PAGE_HTML_PATHS) {
      const html = readFileSync(resolve(pagesRoot, pagePath), 'utf8')
      const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)]
      expect(scriptTags.length).toBeGreaterThan(0)
      for (const [, attrs] of scriptTags) {
        expect(attrs).toMatch(/type\s*=\s*["']module["']/i)
        expect(attrs).not.toMatch(/\bsrc\s*=\s*["']https?:\/\//i)
      }
    }
  })

  it('offscreen.html 仅使用 type=module 外链脚本', () => {
    const html = readFileSync(resolve(publicRoot, 'offscreen.html'), 'utf8')
    const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)]
    expect(scriptTags).toHaveLength(1)
    expect(scriptTags[0]?.[1]).toMatch(/type\s*=\s*["']module["']/i)
    expect(scriptTags[0]?.[1]).toMatch(/src\s*=\s*["']\.\/offscreen\.js["']/i)
  })
})
