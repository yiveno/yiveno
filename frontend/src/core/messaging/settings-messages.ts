import type { UserSettings } from '@/core/settings/user-settings'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** 读取用户设置。 */
export type GetUserSettingsMessage = {
  scope: BackgroundMessageScope
  type: 'GET_USER_SETTINGS'
}

export type GetUserSettingsResponse =
  | {
      ok: true
      settings: UserSettings
    }
  | {
      ok: false
      error: string
    }

/** 更新用户设置（局部 patch）。 */
export type UpdateUserSettingsMessage = {
  scope: BackgroundMessageScope
  type: 'UPDATE_USER_SETTINGS'
  payload: Partial<UserSettings>
}

export type UpdateUserSettingsResponse =
  | {
      ok: true
      settings: UserSettings
    }
  | {
      ok: false
      error: string
    }

export type SettingsBackgroundMessage = GetUserSettingsMessage | UpdateUserSettingsMessage

export type SettingsBackgroundResponse = GetUserSettingsResponse | UpdateUserSettingsResponse
