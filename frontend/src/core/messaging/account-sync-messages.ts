import { z } from 'zod'

import type { AccountBinding } from '@/core/identity/local-profile'
import type { SyncPrefs } from '@/core/identity/sync-prefs'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** 账户 / 同步面向 UI 的稳定错误码。 */
export const AccountSyncErrorCodeSchema = z.enum([
  'AUTH_NOT_CONFIGURED', // 未配置 Supabase
  'AUTH_SIGN_IN_FAILED', // 登录失败
  'AUTH_SIGN_OUT_FAILED', // 登出失败
  'AUTH_STATE_READ_FAILED', // 读取登录态失败
  'SYNC_NOT_AUTHENTICATED', // 未登录无法同步
  'SYNC_STATUS_FAILED', // 同步状态失败
  'SYNC_PREFS_UPDATE_FAILED', // 更新同步偏好失败
  'SYNC_REPLACE_LOCAL_FAILED', // 本机覆盖云端失败
  'SYNC_REPLACE_REMOTE_FAILED' // 云端覆盖本机失败
])

export type AccountSyncErrorCode = z.infer<typeof AccountSyncErrorCodeSchema>

export type AuthSignInMessage = {
  scope: BackgroundMessageScope
  type: 'AUTH_SIGN_IN'
}

export type AuthSignInResponse =
  | {
      ok: true
      /** 已打开官网登录页；真正绑定靠 external handoff */
      openedWebsite: true
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type AuthSignOutMessage = {
  scope: BackgroundMessageScope
  type: 'AUTH_SIGN_OUT'
}

export type AuthSignOutResponse =
  | { ok: true }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type GetAuthStateMessage = {
  scope: BackgroundMessageScope
  type: 'GET_AUTH_STATE'
}

export type GetAuthStateResponse =
  | {
      ok: true
      signedIn: boolean
      binding: AccountBinding | null
      email?: string
      avatarUrl?: string
      displayName?: string
      syncPrefs: SyncPrefs
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type GetSyncStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_SYNC_STATUS'
}

export type GetSyncStatusResponse =
  | {
      ok: true
      signedIn: boolean
      syncEnabled: boolean
      localCount: number
      remoteCount: number
      latestRemoteUpdatedAt: string | null
      /** 两边都有未删数据，需用户选 A/B */
      needsConflictChoice: boolean
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type SetSyncEnabledMessage = {
  scope: BackgroundMessageScope
  type: 'SET_SYNC_ENABLED'
  payload: {
    enabled: boolean
  }
}

export type SetSyncEnabledResponse =
  | {
      ok: true
      syncPrefs: SyncPrefs
      /** 开启后若两边都有数据，UI 应展示冲突选择 */
      needsConflictChoice: boolean
      localCount: number
      remoteCount: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type SyncReplaceWithLocalMessage = {
  scope: BackgroundMessageScope
  type: 'SYNC_REPLACE_WITH_LOCAL'
}

export type SyncReplaceWithLocalResponse =
  | {
      ok: true
      written: number
      backupId: string
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type SyncReplaceWithRemoteMessage = {
  scope: BackgroundMessageScope
  type: 'SYNC_REPLACE_WITH_REMOTE'
}

export type SyncReplaceWithRemoteResponse =
  | {
      ok: true
      written: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type AccountSyncBackgroundMessage =
  | AuthSignInMessage
  | AuthSignOutMessage
  | GetAuthStateMessage
  | GetSyncStatusMessage
  | SetSyncEnabledMessage
  | SyncReplaceWithLocalMessage
  | SyncReplaceWithRemoteMessage

export type AccountSyncBackgroundResponse =
  | AuthSignInResponse
  | AuthSignOutResponse
  | GetAuthStateResponse
  | GetSyncStatusResponse
  | SetSyncEnabledResponse
  | SyncReplaceWithLocalResponse
  | SyncReplaceWithRemoteResponse
