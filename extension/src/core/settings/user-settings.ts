import { z } from 'zod'

import type { UiLocalePreference } from '@/core/i18n/ui-locale'

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
   * 内容提炼：打开库内已保存页面时，把正文送云端 LLM 摘要并存为摘录。
   * 默认关；须 aiFeaturesEnabled 开才生效（总开关关则不向模型发请求）。
   */
  contentExtractEnabled: z.boolean().default(false),
  /**
   * 是否每周本机巡检书签/摘录 URL 死链（只降权、不删除）。
   * 不联动 aiFeaturesEnabled（巡检不调模型）；默认开。
   */
  linkStatusSweepEnabled: z.boolean().default(true),
  /**
   * 是否已授权一次性把 Chrome 书签导入本机 Memory（GS / Settings 重新导入）。
   * 与持续同步（chromeBookmarkSyncEnabled）分开；关开关不删除已导入条目。
   */
  chromeBookmarkIngestEnabled: z.boolean().default(false),
  /**
   * 是否持续同步 Chrome 书签（bookmarks.* 增量监听 + repair alarm + reconcile 门禁）。
   * 与一次性导入授权（chromeBookmarkIngestEnabled）分开；默认关。
   */
  chromeBookmarkSyncEnabled: z.boolean().default(false),
  /**
   * 只读 MCP beta（§5.10.5）：关闭后本机 MCP_RECALL_EVIDENCE 与云端 /api/mcp 均拒绝。
   */
  mcpReadOnlyEnabled: z.boolean().default(false),
  /**
   * A 层：是否用本机 Outcome 对做 Hybrid 软升/降权（§7.2 P3）。
   * 关闭后仍保留对缓冲与可清除；不锁死 Recall；Omnibox 本就不走 Outcome。
   */
  recallOutcomePairSoftAdjustEnabled: z.boolean().default(true),
  /**
   * 暗线·本地学习：是否在本机分析遥测并展示学习记录（ADR-027）。
   * 默认关；不控制遥测录制本身（录制始终本机环形缓冲）。
   */
  dualThreadLocalLearningEnabled: z.boolean().default(false),
  /**
   * 暗线·贡献匿名汇总：是否在同意后每日最多一次上传草图计数（ADR-027）。
   * 默认关；须本地学习开 + 已登录才可启用上传；不含线索原文。
   */
  dualThreadContributeAggregatesEnabled: z.boolean().default(false),
  /**
   * 界面语言偏好：system 跟浏览器；en / zh_CN 强制。
   * 只影响 UI 文案，不改变 Recall 线索理解语言策略。
   */
  uiLocalePreference: z.enum(['system', 'en', 'zh_CN']).default('system')
})

/**
 * 局部更新 patch（无 .default）。
 * Zod 4：`Schema.partial()` 仍会套用字段 default，会把「未传字段」填成默认值；
 * patch 必须用不带 default 的 schema，避免误写整表。
 */
export const UserSettingsPatchSchema = z.object({
  selectionToolbarEnabled: z.boolean().optional(),
  aiFeaturesEnabled: z.boolean().optional(),
  contentExtractEnabled: z.boolean().optional(),
  linkStatusSweepEnabled: z.boolean().optional(),
  chromeBookmarkIngestEnabled: z.boolean().optional(),
  chromeBookmarkSyncEnabled: z.boolean().optional(),
  mcpReadOnlyEnabled: z.boolean().optional(),
  recallOutcomePairSoftAdjustEnabled: z.boolean().optional(),
  dualThreadLocalLearningEnabled: z.boolean().optional(),
  dualThreadContributeAggregatesEnabled: z.boolean().optional(),
  uiLocalePreference: z.enum(['system', 'en', 'zh_CN']).optional()
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

/** 默认用户设置。 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  selectionToolbarEnabled: true,
  aiFeaturesEnabled: true,
  contentExtractEnabled: false,
  linkStatusSweepEnabled: true,
  chromeBookmarkIngestEnabled: false,
  chromeBookmarkSyncEnabled: false,
  mcpReadOnlyEnabled: false,
  recallOutcomePairSoftAdjustEnabled: true,
  dualThreadLocalLearningEnabled: false,
  dualThreadContributeAggregatesEnabled: false,
  uiLocalePreference: 'system' satisfies UiLocalePreference
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
    const raw = value as Record<string, unknown>
    const merged: Record<string, unknown> = { ...DEFAULT_USER_SETTINGS, ...raw }
    // 存量缺少 sync 时：sync = ingest（以前开着灌库的升级后同步保持开；关着的保持关）
    if (!('chromeBookmarkSyncEnabled' in raw)) {
      const ingest =
        typeof raw.chromeBookmarkIngestEnabled === 'boolean'
          ? raw.chromeBookmarkIngestEnabled
          : DEFAULT_USER_SETTINGS.chromeBookmarkIngestEnabled
      merged.chromeBookmarkSyncEnabled = ingest
    }
    const parsed = UserSettingsSchema.safeParse(merged)
    if (parsed.success) {
      return parsed.data
    }
  }
  return { ...DEFAULT_USER_SETTINGS }
}
