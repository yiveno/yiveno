import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EXTENSION_COMMAND_IDS } from '@/core/commands/command-ids'
import {
  dispatchExtensionCommand,
  resetExtensionCommandRegistryForTests
} from '@/background/commands/registry'
import {
  registerCommandListeners,
  resetCommandListenersForTests
} from '@/background/listeners/commands'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import {
  focusOrOpenLibraryTab,
  focusOrOpenSettingsTab
} from '@/infrastructure/browser/extension-tab'
import { dispatchSelectionToolbarCommand } from '@/infrastructure/browser/selection-toolbar-command'

vi.mock('@/infrastructure/browser/extension-tab', () => ({
  focusOrOpenLibraryTab: vi.fn().mockResolvedValue(true),
  focusOrOpenSettingsTab: vi.fn().mockResolvedValue(true)
}))

vi.mock('@/infrastructure/browser/selection-toolbar-command', () => ({
  dispatchSelectionToolbarCommand: vi.fn().mockResolvedValue({ status: 'ok' })
}))

vi.mock('@/infrastructure/browser/action-badge', () => ({
  flashActionBadge: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('command listeners', () => {
  const onCommandAddListener = vi.fn()

  beforeEach(() => {
    resetCommandListenersForTests()
    resetExtensionCommandRegistryForTests()
    vi.clearAllMocks()

    vi.stubGlobal('chrome', {
      commands: {
        onCommand: { addListener: onCommandAddListener }
      }
    })
  })

  it('registerCommandListeners 只注册一次 onCommand', () => {
    registerCommandListeners()
    registerCommandListeners()

    expect(onCommandAddListener).toHaveBeenCalledTimes(1)
  })

  it('白名单内自定义命令均有处理器', async () => {
    registerCommandListeners()
    for (const commandId of EXTENSION_COMMAND_IDS) {
      await expect(dispatchExtensionCommand(commandId)).resolves.toBeUndefined()
    }
  })

  it('open_library 打开失败时闪 error badge', async () => {
    vi.mocked(focusOrOpenLibraryTab).mockResolvedValueOnce(false)
    registerCommandListeners()

    await dispatchExtensionCommand('open_library')

    expect(flashActionBadge).toHaveBeenCalledWith('error')
  })

  it('open_settings 打开失败时闪 error badge', async () => {
    vi.mocked(focusOrOpenSettingsTab).mockResolvedValueOnce(false)
    registerCommandListeners()

    await dispatchExtensionCommand('open_settings')

    expect(flashActionBadge).toHaveBeenCalledWith('error')
  })

  it('save_selection no_receiver 时闪 error badge', async () => {
    vi.mocked(dispatchSelectionToolbarCommand).mockResolvedValueOnce({ status: 'no_receiver' })
    registerCommandListeners()

    await dispatchExtensionCommand('save_selection')

    expect(flashActionBadge).toHaveBeenCalledWith('error')
  })
})
