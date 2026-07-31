import type { UserSettings } from '@/core/settings/user-settings'
import type { BackgroundMessageScope } from '@/core/messaging/constants'
import { z } from 'zod'

/** Settings 面向 UI 的稳定错误码。 */
export const SettingsErrorCodeSchema = z.enum([
  'SETTINGS_READ_FAILED', // 读取设置失败
  'SETTINGS_UPDATE_FAILED' // 更新设置失败
])

export type SettingsErrorCode = z.infer<typeof SettingsErrorCodeSchema>

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
      errorCode: SettingsErrorCode
      error?: string
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
      errorCode: SettingsErrorCode
      error?: string
    }

export type SettingsBackgroundMessage = GetUserSettingsMessage | UpdateUserSettingsMessage

export type SettingsBackgroundResponse = GetUserSettingsResponse | UpdateUserSettingsResponse
