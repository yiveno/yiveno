import type {
  GetUserSettingsResponse,
  UpdateUserSettingsResponse
} from '@/core/messaging/settings-messages'
import { UserSettingsSchema, type UserSettings } from '@/core/settings/user-settings'
import {
  getUserSettings,
  updateUserSettings
} from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

function toErrorPayload(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/** 读取用户设置。 */
export async function handleGetUserSettings(): Promise<GetUserSettingsResponse> {
  try {
    const settings = await getUserSettings()
    return { ok: true, settings }
  } catch (error) {
    logger.error('Settings', '读取用户设置失败', error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'SETTINGS_READ_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}

/** 更新用户设置。 */
export async function handleUpdateUserSettings(
  payload: unknown
): Promise<UpdateUserSettingsResponse> {
  try {
    const parsed = UserSettingsSchema.partial().parse(payload)
    const patch: Partial<UserSettings> = {}
    if (typeof parsed.selectionToolbarEnabled === 'boolean') {
      patch.selectionToolbarEnabled = parsed.selectionToolbarEnabled
    }
    const settings = await updateUserSettings(patch)
    return { ok: true, settings }
  } catch (error) {
    logger.error('Settings', '更新用户设置失败', error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'SETTINGS_UPDATE_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}
