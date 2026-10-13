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
   * 关闭后卸载 bookmarks.* 监听、停止新写入与增量同步，不删除已灌入条目。
   */
  chromeBookmarkIngestEnabled: z.boolean().default(false),
  /**
   * 只读 MCP beta（§5.10.5）：关闭后本机 MCP_RECALL_EVIDENCE 与云端 /api/mcp 均拒绝。
   */
  mcpReadOnlyEnabled: z.boolean().default(false)
})

/**
 * 局部更新 patch（无 .default）。
 * Zod 4：`Schema.partial()` 仍会套用字段 default，会把「未传字段」填成默认值；
 * patch 必须用不带 default 的 schema，避免误写整表。
 */
export const UserSettingsPatchSchema = z.object({
  selectionToolbarEnabled: z.boolean().optional(),
  aiFeaturesEnabled: z.boolean().optional(),
  chromeBookmarkIngestEnabled: z.boolean().optional(),
  mcpReadOnlyEnabled: z.boolean().optional()
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

/** 默认用户设置。 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  selectionToolbarEnabled: true,
  aiFeaturesEnabled: true,
  chromeBookmarkIngestEnabled: false,
  mcpReadOnlyEnabled: false
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
