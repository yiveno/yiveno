import { z } from 'zod'

/** chrome.storage.local 中的用户设置键。 */
export const USER_SETTINGS_STORAGE_KEY = 'yiveno.userSettings' as const

/** 用户可配置项（Settings 页写入）。 */
export const UserSettingsSchema = z.object({
  /** 划词后显示保存浮层。 */
  selectionToolbarEnabled: z.boolean()
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

/** 默认用户设置。 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  selectionToolbarEnabled: true
}

/** 合并局部更新并校验。 */
export function mergeUserSettings(
  current: UserSettings,
  patch: Partial<UserSettings>
): UserSettings {
  return UserSettingsSchema.parse({ ...current, ...patch })
}

/** 安全解析存储值；失败时回退默认。 */
export function parseUserSettings(value: unknown): UserSettings {
  const parsed = UserSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : { ...DEFAULT_USER_SETTINGS }
}
