import { describe, expect, it } from 'vitest'

import {
  CHROME_EXTENSION_SHORTCUTS_URL,
  EDGE_EXTENSION_SHORTCUTS_URL,
  getExtensionShortcutsSettingsUrl
} from '@/core/commands/command-display'

describe('getExtensionShortcutsSettingsUrl', () => {
  it('Edge UA → edge://extensions/shortcuts', () => {
    expect(
      getExtensionShortcutsSettingsUrl(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      )
    ).toBe(EDGE_EXTENSION_SHORTCUTS_URL)
  })

  it('Chrome UA → chrome://extensions/shortcuts', () => {
    expect(
      getExtensionShortcutsSettingsUrl(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(CHROME_EXTENSION_SHORTCUTS_URL)
  })
})
