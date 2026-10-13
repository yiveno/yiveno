/**
 * Manifest 回归：Storage / Alarms API 权限契约。
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

describe('manifest Storage / Alarms 契约', () => {
  it('声明 storage 权限（设置、会话、本机遥测等）', () => {
    const manifest = readManifest()
    expect(manifest.permissions).toContain('storage')
  })

  it('声明 alarms 权限（用户开启云同步后的周期增量同步）', () => {
    const manifest = readManifest()
    expect(manifest.permissions).toContain('alarms')
  })
})
