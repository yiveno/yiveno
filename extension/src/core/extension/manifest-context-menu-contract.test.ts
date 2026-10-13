/**
 * Manifest 回归：右键菜单权限与稳定菜单 id。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CONTEXT_MENU_SAVE_SELECTION_ID } from '@/background/listeners/context-menu'

interface ExtensionManifest {
  permissions?: string[]
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest context menu 契约', () => {
  it('声明 contextMenus 权限', () => {
    const manifest = readManifest()
    expect(manifest.permissions).toContain('contextMenus')
  })

  it('菜单 id 稳定（upsert update/create 依赖固定 id）', () => {
    expect(CONTEXT_MENU_SAVE_SELECTION_ID).toBe('yiveno-save-selection')
  })
})
