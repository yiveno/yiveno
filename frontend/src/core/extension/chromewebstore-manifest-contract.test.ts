/**
 * CHROMEWEBSTORE.md ↔ manifest 合规契约（A14）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CHROMEWEBSTORE_DOC_PATH,
  EXTENSION_CWS_CONTENT_SCRIPT_JS,
  EXTENSION_CWS_HOST_PERMISSIONS,
  EXTENSION_CWS_PERMISSIONS,
  EXTENSION_CWS_SHORT_DESCRIPTION
} from '@/core/extension/extension-cws-contract'

interface ExtensionManifest {
  version?: string
  description?: string
  permissions?: string[]
  host_permissions?: string[]
  content_scripts?: Array<{ js?: string[] }>
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')
const localesPath = resolve(import.meta.dirname, '../../../public/_locales/en/messages.json')
const cwsDocPath = resolve(import.meta.dirname, '../../../../CHROMEWEBSTORE.md')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

function readCwsDoc(): string {
  return readFileSync(cwsDocPath, 'utf8')
}

function readEnAppDescription(): string {
  const messages = JSON.parse(readFileSync(localesPath, 'utf8')) as {
    app_description?: { message?: string }
  }
  return messages.app_description?.message ?? ''
}

/** 解析 Permissions Justification 表中 `` `permission` `` 行。 */
function extractDocumentedPermissionKeys(content: string): Set<string> {
  const keys = new Set<string>()
  for (const line of content.split('\n')) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/)
    if (match?.[1]) {
      keys.add(match[1])
    }
  }
  return keys
}

describe('CHROMEWEBSTORE ↔ manifest 契约', () => {
  it('manifest permissions 与权威 CWS 表一致', () => {
    const manifest = readManifest()
    expect([...(manifest.permissions ?? [])].sort()).toEqual([...EXTENSION_CWS_PERMISSIONS].sort())
  })

  it('manifest host_permissions 与权威 CWS 表一致', () => {
    const manifest = readManifest()
    expect([...(manifest.host_permissions ?? [])].sort()).toEqual(
      [...EXTENSION_CWS_HOST_PERMISSIONS].sort()
    )
  })

  it('CHROMEWEBSTORE.md 逐项披露 permissions 与 host_permissions', () => {
    const content = readCwsDoc()
    const documented = extractDocumentedPermissionKeys(content)

    for (const permission of EXTENSION_CWS_PERMISSIONS) {
      expect(documented.has(permission)).toBe(true)
    }
    for (const host of EXTENSION_CWS_HOST_PERMISSIONS) {
      expect(documented.has(host)).toBe(true)
    }
  })

  it('CHROMEWEBSTORE 短描述与 en app_description 一致', () => {
    expect(readEnAppDescription()).toBe(EXTENSION_CWS_SHORT_DESCRIPTION)
    expect(readCwsDoc()).toContain(EXTENSION_CWS_SHORT_DESCRIPTION)
  })

  it('CHROMEWEBSTORE 版本表与 manifest.version 一致', () => {
    const manifest = readManifest()
    const content = readCwsDoc()
    expect(manifest.version).toBeTruthy()
    expect(content).toMatch(new RegExp(`\\|\\s*${manifest.version}\\s+\\|`))
  })

  it('content_scripts 产物在 manifest 与 CHROMEWEBSTORE 中披露', () => {
    const manifest = readManifest()
    const scripts = (manifest.content_scripts ?? []).flatMap(entry => entry.js ?? [])
    expect(scripts).toContain(EXTENSION_CWS_CONTENT_SCRIPT_JS)
    expect(readCwsDoc()).toContain(EXTENSION_CWS_CONTENT_SCRIPT_JS)
  })

  it('CHROMEWEBSTORE 文档路径常量可解析', () => {
    expect(CHROMEWEBSTORE_DOC_PATH).toBe('CHROMEWEBSTORE.md')
    expect(readFileSync(cwsDocPath, 'utf8').length).toBeGreaterThan(0)
  })
})
