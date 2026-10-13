/**
 * Manifest 回归：划词 content script 与构建产物 / SW keepalive 契约对齐。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SELECTION_TOOLBAR_KEEPALIVE_PORT } from '@/core/messaging/content-messages'
import { SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE } from '@/infrastructure/browser/selection-toolbar-command'

interface ExtensionManifestContentScript {
  matches?: string[]
  js?: string[]
  run_at?: string
}

interface ExtensionManifest {
  manifest_version: number
  content_scripts?: ExtensionManifestContentScript[]
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest content script 契约', () => {
  it('声明划词 content script 与构建产物文件名一致', () => {
    const manifest = readManifest()
    const entry = manifest.content_scripts?.[0]
    expect(entry?.js).toEqual([SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE])
    expect(SELECTION_TOOLBAR_CONTENT_SCRIPT_FILE).toBe('content-selection-toolbar.js')
  })

  it('仅注入 http/https 页面，document_idle 启动', () => {
    const manifest = readManifest()
    const entry = manifest.content_scripts?.[0]
    expect(entry?.matches).toEqual(['http://*/*', 'https://*/*'])
    expect(entry?.run_at).toBe('document_idle')
  })

  it('keepalive port 名稳定（SW onConnect 与 content connect 须一致）', () => {
    expect(SELECTION_TOOLBAR_KEEPALIVE_PORT).toBe('yiveno-selection-toolbar')
  })
})
