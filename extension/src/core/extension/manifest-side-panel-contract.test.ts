/**
 * Manifest 回归：Side Panel 与 action 互斥约束（chrome-extensions Rule 2）。
 * 防止误加 default_popup 导致 setPanelBehavior 失效。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

interface ExtensionManifestAction {
  default_popup?: string
  default_title?: string
  default_icon?: Record<string, string>
}

interface ExtensionManifestSidePanel {
  default_path?: string
}

interface ExtensionManifest {
  manifest_version: number
  permissions?: string[]
  action?: ExtensionManifestAction
  side_panel?: ExtensionManifestSidePanel
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Side Panel 契约', () => {
  it('声明 sidePanel 权限与 side_panel.default_path', () => {
    const manifest = readManifest()
    expect(manifest.permissions).toContain('sidePanel')
    expect(manifest.side_panel?.default_path).toBe('sidepanel.html')
  })

  it('action 不得含 default_popup（与 openPanelOnActionClick 互斥）', () => {
    const manifest = readManifest()
    expect(manifest.action?.default_popup).toBeUndefined()
  })

  it('MV3 service worker 背景页', () => {
    const manifest = readManifest()
    expect(manifest.manifest_version).toBe(3)
  })
})
