/**
 * Manifest 回归：Bookmarks API 权限与灌库开关契约。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

interface ExtensionManifest {
  permissions?: string[]
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Bookmarks API 契约', () => {
  it('声明 bookmarks 权限（用户显式开启灌库后增量同步）', () => {
    const manifest = readManifest()
    expect(manifest.permissions).toContain('bookmarks')
  })
})
