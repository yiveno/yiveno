import type { UserSettings } from '@/core/settings/user-settings'
import type { BackgroundMessageScope } from '@/core/messaging/constants'
import { z } from 'zod'

/** Settings 面向 UI 的稳定错误码。 */
export const SettingsErrorCodeSchema = z.enum([
  'SETTINGS_READ_FAILED', // 读取设置失败
  'SETTINGS_UPDATE_FAILED', // 更新设置失败
  'AI_HOSTED_QUOTA_AUTH_REQUIRED', // 读托管配额须登录
  'AI_HOSTED_QUOTA_FAILED' // 读托管配额失败
])

export type SettingsErrorCode = z.infer<typeof SettingsErrorCodeSchema>

/** 托管 Clue LLM 配额快照（与 Worker 对齐）。 */
export type AiHostedQuotaSnapshot = {
  model: string
  tier: 'free' | 'pro' // free=登录免费档；pro=有效 Pro
  used: number
  limit: number
  remaining: number
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthKey: string
}

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

/** 读取托管 Clue LLM 配额（须登录）。 */
export type GetAiHostedQuotaMessage = {
  scope: BackgroundMessageScope
  type: 'GET_AI_HOSTED_QUOTA'
}

export type GetAiHostedQuotaResponse =
  | {
      ok: true
      quota: AiHostedQuotaSnapshot
    }
  | {
      ok: false
      errorCode: SettingsErrorCode
      error?: string
    }

export type SettingsBackgroundMessage =
  GetUserSettingsMessage | UpdateUserSettingsMessage | GetAiHostedQuotaMessage

export type SettingsBackgroundResponse =
  GetUserSettingsResponse | UpdateUserSettingsResponse | GetAiHostedQuotaResponse
