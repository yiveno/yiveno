import { describe, expect, it, vi } from 'vitest'

const focusOrOpenSettingsTabMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/infrastructure/browser/extension-tab', () => ({
  focusOrOpenSettingsTab: focusOrOpenSettingsTabMock
}))

import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'

describe('openExtensionOptionsPage', () => {
  it('走 focusOrOpenSettingsTab，不用 openOptionsPage 堆重复 Tab', async () => {
    await openExtensionOptionsPage()
    expect(focusOrOpenSettingsTabMock).toHaveBeenCalledTimes(1)
  })
})
