import { describe, expect, it } from 'vitest'

import {
  shouldRefreshExtensionCommandsOnVisibility,
  shouldRefreshSyncContextOnVisibility
} from '@/pages/settings/settings-visibility-refresh'

describe('settings-visibility-refresh', () => {
  it('shouldRefreshExtensionCommandsOnVisibility 需可见且等待快捷键页返回', () => {
    expect(
      shouldRefreshExtensionCommandsOnVisibility({
        documentVisible: true,
        awaitingShortcutsReturn: true
      })
    ).toBe(true)
    expect(
      shouldRefreshExtensionCommandsOnVisibility({
        documentVisible: false,
        awaitingShortcutsReturn: true
      })
    ).toBe(false)
    expect(
      shouldRefreshExtensionCommandsOnVisibility({
        documentVisible: true,
        awaitingShortcutsReturn: false
      })
    ).toBe(false)
  })

  it('shouldRefreshSyncContextOnVisibility 仅可见时刷新', () => {
    expect(shouldRefreshSyncContextOnVisibility(true)).toBe(true)
    expect(shouldRefreshSyncContextOnVisibility(false)).toBe(false)
  })
})
