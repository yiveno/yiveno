import { z } from 'zod'

/** chrome.storage.local 中的用户设置键。 */
export const USER_SETTINGS_STORAGE_KEY = 'yiveno.userSettings' as const

/** 用户可配置项（Settings 页写入）。 */
export const UserSettingsSchema = z.object({
  /** 划词后显示保存浮层。 */
  selectionToolbarEnabled: z.boolean(),
  /**
   * 是否允许经 Worker 的 AI（线索理解 LLM + Capture enrichment）。
   * 关闭后理解层降级规则；不向模型发送请求。
   */
  aiFeaturesEnabled: z.boolean().default(true),
  /**
   * 是否把 Chrome 书签灌入本机 Memory（首次 bulk + 原生增删改增量）。
   * 关闭后停止新写入与增量同步，不删除已灌入条目。
   */
  chromeBookmarkIngestEnabled: z.boolean().default(true)
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

/** 默认用户设置。 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  selectionToolbarEnabled: true,
  aiFeaturesEnabled: true,
  chromeBookmarkIngestEnabled: true
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
  if (value && typeof value === 'object') {
    const merged = { ...DEFAULT_USER_SETTINGS, ...(value as Record<string, unknown>) }
    const parsed = UserSettingsSchema.safeParse(merged)
    if (parsed.success) {
      return parsed.data
    }
  }
  return { ...DEFAULT_USER_SETTINGS }
}
