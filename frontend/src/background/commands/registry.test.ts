import { beforeEach, describe, expect, it } from 'vitest'

import { isExtensionCommandId } from '@/core/commands/command-ids'
import {
  dispatchExtensionCommand,
  resetExtensionCommandRegistryForTests
} from '@/background/commands/registry'

describe('command-ids', () => {
  it('当前无自定义命令；保留命令不在白名单', () => {
    expect(isExtensionCommandId('_execute_action')).toBe(false)
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
