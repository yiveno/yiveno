/**
 * Manifest 回归：Action / Commands 与 command-ids 白名单、Chrome 快捷键上限对齐。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { EXTENSION_COMMAND_IDS } from '@/core/commands/command-ids'

interface ExtensionManifestAction {
  default_popup?: string
  default_title?: string
}

interface ExtensionManifestCommand {
  description?: string
  suggested_key?: {
    default?: string
    mac?: string
  }
}

interface ExtensionManifest {
  manifest_version: number
  action?: ExtensionManifestAction
  commands?: Record<string, ExtensionManifestCommand>
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Action / Commands 契约', () => {
  it('action 无 default_popup（与 Side Panel openPanelOnActionClick 互斥）', () => {
    const manifest = readManifest()
    expect(manifest.action?.default_popup).toBeUndefined()
  })

  it('commands 键名与白名单 + 保留 _execute_action 一致', () => {
    const manifest = readManifest()
    const keys = Object.keys(manifest.commands ?? {}).sort()
    expect(keys).toEqual(['_execute_action', ...EXTENSION_COMMAND_IDS].sort())
  })

  it('自定义命令 description 均走 i18n __MSG_', () => {
    const manifest = readManifest()
    for (const id of EXTENSION_COMMAND_IDS) {
      const description = manifest.commands?.[id]?.description ?? ''
      expect(description).toMatch(/^__MSG_command_/)
    }
    expect(manifest.commands?._execute_action?.description).toBe('__MSG_command_open_recall__')
  })

  it('带 suggested_key 的命令不超过 4 个（含 _execute_action）', () => {
    const manifest = readManifest()
    const withSuggestedKey = Object.values(manifest.commands ?? {}).filter(
      command => command.suggested_key !== undefined
    )
    expect(withSuggestedKey.length).toBeLessThanOrEqual(4)
    expect(withSuggestedKey.length).toBe(4)
  })

  it('open_settings 不设默认快捷键（用户自绑）', () => {
    const manifest = readManifest()
    expect(manifest.commands?.open_settings?.suggested_key).toBeUndefined()
  })
})
