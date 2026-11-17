import type {
  GetAiHostedQuotaResponse,
  GetUserSettingsResponse,
  UpdateUserSettingsResponse
} from '@/core/messaging/settings-messages'
import { UserSettingsPatchSchema, type UserSettings } from '@/core/settings/user-settings'
import { ensureChromeBookmarksImported } from '@/application/capture/import-chrome-bookmarks-service'
import { resumeAsyncMemoryEmbeddingAfterAuth } from '@/application/memory/schedule-async-memory-embedding'
import { resumeAsyncMemoryLlmEnrichmentAfterQuota } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'
import { syncChromeBookmarkSyncListenersWithSyncSetting } from '@/background/listeners/chrome-bookmark-sync'
import { ensureLinkStatusSweepAlarm } from '@/infrastructure/sync/link-status-sweep-alarm'
import { fetchHostedQuota } from '@/infrastructure/ai/hosted-quota-api-client'
import { readBrowserOnline } from '@/infrastructure/browser/browser-online'
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
      chromeBookmarkIngestEnabled: settings.chromeBookmarkIngestEnabled,
      chromeBookmarkSyncEnabled: settings.chromeBookmarkSyncEnabled
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
    const parsed = UserSettingsPatchSchema.parse(payload)
    const current = await getUserSettings()
    const patch: Partial<UserSettings> = {}
    if (typeof parsed.selectionToolbarEnabled === 'boolean') {
      patch.selectionToolbarEnabled = parsed.selectionToolbarEnabled
    }
    if (typeof parsed.aiFeaturesEnabled === 'boolean') {
      patch.aiFeaturesEnabled = parsed.aiFeaturesEnabled
    }
    if (typeof parsed.linkStatusSweepEnabled === 'boolean') {
      patch.linkStatusSweepEnabled = parsed.linkStatusSweepEnabled
    }
    if (typeof parsed.chromeBookmarkIngestEnabled === 'boolean') {
      patch.chromeBookmarkIngestEnabled = parsed.chromeBookmarkIngestEnabled
    }
    if (typeof parsed.chromeBookmarkSyncEnabled === 'boolean') {
      patch.chromeBookmarkSyncEnabled = parsed.chromeBookmarkSyncEnabled
      // Settings 开同步：文案已披露会导入现有书签；若尚未授权导入则一并置 ingest
      if (
        parsed.chromeBookmarkSyncEnabled === true &&
        !(patch.chromeBookmarkIngestEnabled ?? current.chromeBookmarkIngestEnabled)
      ) {
        patch.chromeBookmarkIngestEnabled = true
      }
    }
    if (typeof parsed.mcpReadOnlyEnabled === 'boolean') {
      patch.mcpReadOnlyEnabled = parsed.mcpReadOnlyEnabled
    }
    if (typeof parsed.recallOutcomePairSoftAdjustEnabled === 'boolean') {
      patch.recallOutcomePairSoftAdjustEnabled = parsed.recallOutcomePairSoftAdjustEnabled
    }
    if (parsed.uiLocalePreference !== undefined) {
      patch.uiLocalePreference = parsed.uiLocalePreference
    }
    const settings = await updateUserSettings(patch)
    if (typeof patch.aiFeaturesEnabled === 'boolean') {
      // AI 开关变更后立刻重挂 / 清空线索 LLM completer
      await refreshClueLlmCompleterFromDevConfig()
      if (patch.aiFeaturesEnabled) {
        // 重新打开 AI：解除 enrichment 配额熔断与 embed auth 熔断，允许后续 Capture 再试
        resumeAsyncMemoryLlmEnrichmentAfterQuota()
        resumeAsyncMemoryEmbeddingAfterAuth()
      }
    }
    if (typeof patch.linkStatusSweepEnabled === 'boolean') {
      // 巡检开关：挂/卸独立闹钟（不联动 AI）
      await ensureLinkStatusSweepAlarm(patch.linkStatusSweepEnabled)
    }
    // 一次性导入授权：只跑 bulk，不挂持续监听（同批开 sync 时由下方 sync 分支 ensure）
    if (typeof patch.chromeBookmarkIngestEnabled === 'boolean') {
      if (patch.chromeBookmarkIngestEnabled && patch.chromeBookmarkSyncEnabled !== true) {
        void ensureChromeBookmarksImported().catch(error => {
          logger.warn('Settings', '开启书签导入授权后导入失败', error)
        })
      } else if (!patch.chromeBookmarkIngestEnabled) {
        logger.info('Settings', '已关闭书签导入授权（不删已导入条目）')
      }
    }
    // 持续同步：挂/卸监听；开同步时 ensure/reconcile
    if (typeof patch.chromeBookmarkSyncEnabled === 'boolean') {
      await syncChromeBookmarkSyncListenersWithSyncSetting(patch.chromeBookmarkSyncEnabled)
      if (patch.chromeBookmarkSyncEnabled) {
        void ensureChromeBookmarksImported().catch(error => {
          logger.warn('Settings', '开启书签同步后导入/对齐失败', error)
        })
      } else {
        logger.info('Settings', '已关闭书签同步，增量监听已卸载')
      }
    }
    flowOk('Settings', '更新用户设置', startedAt, {
      patchKeys: Object.keys(patch),
      selectionToolbarEnabled: settings.selectionToolbarEnabled,
      aiFeaturesEnabled: settings.aiFeaturesEnabled,
      chromeBookmarkIngestEnabled: settings.chromeBookmarkIngestEnabled,
      chromeBookmarkSyncEnabled: settings.chromeBookmarkSyncEnabled,
      mcpReadOnlyEnabled: settings.mcpReadOnlyEnabled
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
    const errorCode = readBrowserOnline() ? 'AI_HOSTED_QUOTA_FAILED' : 'AI_HOSTED_QUOTA_OFFLINE'
    return {
      ok: false,
      errorCode,
      ...(debug ? { error: debug } : {})
    }
  }
}
