import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUserSettingsMock, updateUserSettingsMock } = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn()
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock,
  updateUserSettings: updateUserSettingsMock
}))

import {
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'

describe('settings-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handleGetUserSettings 返回当前设置', async () => {
    getUserSettingsMock.mockResolvedValue({ selectionToolbarEnabled: true })

    const response = await handleGetUserSettings()
    expect(response).toEqual({
      ok: true,
      settings: { selectionToolbarEnabled: true }
    })
  })

  it('handleUpdateUserSettings 校验并写入', async () => {
    updateUserSettingsMock.mockResolvedValue({ selectionToolbarEnabled: false })

    const response = await handleUpdateUserSettings({ selectionToolbarEnabled: false })
    expect(response).toEqual({
      ok: true,
      settings: { selectionToolbarEnabled: false }
    })
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ selectionToolbarEnabled: false })
  })
})
