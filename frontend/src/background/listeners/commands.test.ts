import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  registerCommandListeners,
  resetCommandListenersForTests
} from '@/background/listeners/commands'
import { resetExtensionCommandRegistryForTests } from '@/background/commands/registry'

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
})
