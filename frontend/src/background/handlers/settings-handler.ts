import type {
  GetAiHostedQuotaResponse,
  GetUserSettingsResponse,
  UpdateUserSettingsResponse
} from '@/core/messaging/settings-messages'
import { UserSettingsSchema, type UserSettings } from '@/core/settings/user-settings'
import { ensureChromeBookmarksImported } from '@/application/capture/import-chrome-bookmarks-service'
import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'
import { syncChromeBookmarkSyncListenersWithIngestSetting } from '@/background/listeners/chrome-bookmark-sync'
import { fetchHostedQuota } from '@/infrastructure/ai/hosted-quota-api-client'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import {
  getUserSettings,
  updateUserSettings
} from '@/infrastructure/settings/user-settings-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

function toErrorPayload(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/** 读取用户设置。 */
export async function handleGetUserSettings(): Promise<GetUserSettingsResponse> {
  const startedAt = flowStart('Settings', '读取用户设置')
  try {
    const settings = await getUserSettings()
    flowOk('Settings', '读取用户设置', startedAt, {
      selectionToolbarEnabled: settings.selectionToolbarEnabled,
      aiFeaturesEnabled: settings.aiFeaturesEnabled,
      chromeBookmarkIngestEnabled: settings.chromeBookmarkIngestEnabled
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
    if (typeof parsed.aiFeaturesEnabled === 'boolean') {
      patch.aiFeaturesEnabled = parsed.aiFeaturesEnabled
    }
    if (typeof parsed.chromeBookmarkIngestEnabled === 'boolean') {
      patch.chromeBookmarkIngestEnabled = parsed.chromeBookmarkIngestEnabled
    }
    const settings = await updateUserSettings(patch)
    if (typeof patch.aiFeaturesEnabled === 'boolean') {
      // AI 开关变更后立刻重挂 / 清空线索 LLM completer
      await refreshClueLlmCompleterFromDevConfig()
    }
    if (typeof patch.chromeBookmarkIngestEnabled === 'boolean') {
      // 关：立刻卸 bookmarks.* 监听；开：挂监听并补跑导入/reconcile
      await syncChromeBookmarkSyncListenersWithIngestSetting(patch.chromeBookmarkIngestEnabled)
      if (patch.chromeBookmarkIngestEnabled) {
        void ensureChromeBookmarksImported().catch(error => {
          logger.warn('Settings', '重新开启书签灌库后导入/对齐失败', error)
        })
      } else {
        logger.info('Settings', '已关闭书签灌库，书签增量监听已卸载')
      }
    }
    flowOk('Settings', '更新用户设置', startedAt, {
      patchKeys: Object.keys(patch),
      selectionToolbarEnabled: settings.selectionToolbarEnabled,
      aiFeaturesEnabled: settings.aiFeaturesEnabled,
      chromeBookmarkIngestEnabled: settings.chromeBookmarkIngestEnabled
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

/** 读取托管 Clue LLM 月/日配额（须登录）。 */
export async function handleGetAiHostedQuota(): Promise<GetAiHostedQuotaResponse> {
  const startedAt = flowStart('Settings', '读取托管配额')
  try {
    const session = await getAuthSession()
    const accessToken = session?.accessToken
    if (!accessToken) {
      flowOk('Settings', '读取托管配额', startedAt, { reason: 'not_signed_in' })
      return { ok: false, errorCode: 'AI_HOSTED_QUOTA_AUTH_REQUIRED' }
    }
    const quota = await fetchHostedQuota(accessToken)
    flowOk('Settings', '读取托管配额', startedAt, {
      tier: quota.tier,
      used: quota.used,
      limit: quota.limit
    })
    return { ok: true, quota }
  } catch (error) {
    flowFail('Settings', '读取托管配额', startedAt, error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'AI_HOSTED_QUOTA_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}
