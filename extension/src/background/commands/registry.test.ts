import { beforeEach, describe, expect, it } from 'vitest'

import { isExtensionCommandId } from '@/core/commands/command-ids'
import {
  dispatchExtensionCommand,
  resetExtensionCommandRegistryForTests
} from '@/background/commands/registry'

describe('command-ids', () => {
  it('白名单含记忆库/设置/划词保存；保留命令不在白名单', () => {
    expect(isExtensionCommandId('_execute_action')).toBe(false)
    expect(isExtensionCommandId('open_library')).toBe(true)
    expect(isExtensionCommandId('open_settings')).toBe(true)
    expect(isExtensionCommandId('save_selection')).toBe(true)
    expect(isExtensionCommandId('save_selection_with_note')).toBe(true)
    expect(isExtensionCommandId('yiveno-capture-current-page')).toBe(false)
  })
})

describe('command registry', () => {
  beforeEach(() => {
    resetExtensionCommandRegistryForTests()
  })

  it('未知命令不抛错', async () => {
    await expect(dispatchExtensionCommand('not-a-command')).resolves.toBeUndefined()
  })
})
