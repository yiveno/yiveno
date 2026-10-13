/**
 * Manifest 回归：Options UI（settings.html · open_in_tab）契约。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  EXTENSION_OPTIONS_OPEN_IN_TAB,
  EXTENSION_OPTIONS_PAGE,
  EXTENSION_OPTIONS_SOURCE_HTML
} from '@/core/extension/extension-options-contract'
import { createBuildInput } from '../../../vite/build-options'

interface ExtensionManifest {
  options_ui?: {
    page?: string
    open_in_tab?: boolean
  }
  commands?: Record<string, { description?: string }>
}

const manifestPath = resolve(import.meta.dirname, '../../../public/manifest.json')
const srcRoot = resolve(import.meta.dirname, '../../')

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionManifest
}

describe('manifest Options UI 契约', () => {
  it('options_ui 指向全页 settings.html', () => {
    const manifest = readManifest()
    expect(manifest.options_ui?.page).toBe(EXTENSION_OPTIONS_PAGE)
    expect(manifest.options_ui?.open_in_tab).toBe(EXTENSION_OPTIONS_OPEN_IN_TAB)
  })

  it('设置页 Vite 入口与源 HTML 存在', () => {
    const input = createBuildInput()
    expect(input.settings).toContain('pages/settings/index.html')
    expect(existsSync(resolve(srcRoot, EXTENSION_OPTIONS_SOURCE_HTML))).toBe(true)
  })

  it('open_settings 命令已注册（无默认快捷键，用户自绑）', () => {
    const manifest = readManifest()
    expect(manifest.commands?.open_settings?.description).toBe('__MSG_command_open_settings__')
  })
})
