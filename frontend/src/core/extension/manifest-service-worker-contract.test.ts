/**
 * Manifest 回归：MV3 Service Worker 背景页配置。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

interface ExtensionManifestBackground {
  service_worker?: string
  type?: string
}

interface ExtensionManifest {
  manifest_version: number
  background?: ExtensionManifestBackground
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Service Worker 契约', () => {
  it('MV3 module service worker', () => {
    const manifest = readManifest()
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.background?.service_worker).toBe('background.js')
    expect(manifest.background?.type).toBe('module')
  })
})
