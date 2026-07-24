import type {
  GetUserSettingsResponse,
  UpdateUserSettingsResponse
} from '@/core/messaging/settings-messages'
import type { UserSettings } from '@/core/settings/user-settings'
import { UserSettingsSchema } from '@/core/settings/user-settings'
import {
  getUserSettings,
  updateUserSettings
} from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

/** 读取用户设置。 */
export async function handleGetUserSettings(): Promise<GetUserSettingsResponse> {
  try {
    const settings = await getUserSettings()
    return { ok: true, settings }
  } catch (error) {
    logger.error('Settings', '读取用户设置失败', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : '读取设置失败'
    }
  }
}

/** 更新用户设置。 */
export async function handleUpdateUserSettings(
  payload: unknown
): Promise<UpdateUserSettingsResponse> {
  try {
    const patch = UserSettingsSchema.partial().parse(payload)
    const settings = await updateUserSettings(patch)
    return { ok: true, settings }
  } catch (error) {
    logger.error('Settings', '更新用户设置失败', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : '更新设置失败'
    }
  }
}
