import { describe, expect, it, vi } from 'vitest'

const focusOrOpenSettingsTabMock = vi.hoisted(() => vi.fn(async () => true))

vi.mock('@/infrastructure/browser/extension-tab', () => ({
  focusOrOpenSettingsTab: focusOrOpenSettingsTabMock
}))

import { openExtensionOptionsPage } from '@/infrastructure/browser/extension-pages'

describe('openExtensionOptionsPage', () => {
  it('走 focusOrOpenSettingsTab，不用 openOptionsPage 堆重复 Tab', async () => {
    await openExtensionOptionsPage()
    expect(focusOrOpenSettingsTabMock).toHaveBeenCalledTimes(1)
  })

  it('focusOrOpenSettingsTab 失败时抛错', async () => {
    focusOrOpenSettingsTabMock.mockResolvedValueOnce(false)
    await expect(openExtensionOptionsPage()).rejects.toThrow('OPEN_SETTINGS_FAILED')
  })
})
