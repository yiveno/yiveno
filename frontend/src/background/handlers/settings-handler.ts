import type {
  GetUserSettingsResponse,
  UpdateUserSettingsResponse
} from '@/core/messaging/settings-messages'
import { UserSettingsSchema, type UserSettings } from '@/core/settings/user-settings'
import {
  getUserSettings,
  updateUserSettings
} from '@/infrastructure/settings/user-settings-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function toErrorPayload(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/** 读取用户设置。 */
export async function handleGetUserSettings(): Promise<GetUserSettingsResponse> {
  const startedAt = flowStart('Settings', '读取用户设置')
  try {
    const settings = await getUserSettings()
    flowOk('Settings', '读取用户设置', startedAt, {
      selectionToolbarEnabled: settings.selectionToolbarEnabled
    })
    return { ok: true, settings }
  } catch (error) {
    flowFail('Settings', '读取用户设置', startedAt, error)
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
  const startedAt = flowStart('Settings', '更新用户设置')
  try {
    const parsed = UserSettingsSchema.partial().parse(payload)
    const patch: Partial<UserSettings> = {}
    if (typeof parsed.selectionToolbarEnabled === 'boolean') {
      patch.selectionToolbarEnabled = parsed.selectionToolbarEnabled
    }
    const settings = await updateUserSettings(patch)
    flowOk('Settings', '更新用户设置', startedAt, {
      patchKeys: Object.keys(patch),
      selectionToolbarEnabled: settings.selectionToolbarEnabled
    })
    return { ok: true, settings }
  } catch (error) {
    flowFail('Settings', '更新用户设置', startedAt, error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'SETTINGS_UPDATE_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}
