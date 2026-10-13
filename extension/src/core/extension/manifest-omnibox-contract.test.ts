/**
 * Manifest 回归：Omnibox keyword 与 Recall 离线轨契约。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

interface ExtensionManifest {
  omnibox?: {
    keyword?: string
  }
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Omnibox 契约', () => {
  it('keyword 为 yi（地址栏前缀，Chrome 会剥掉 keyword 再交给 onInputChanged）', () => {
    const manifest = readManifest()
    expect(manifest.omnibox?.keyword).toBe('yi')
  })
})
