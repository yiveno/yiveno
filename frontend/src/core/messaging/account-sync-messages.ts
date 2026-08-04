import { z } from 'zod'

import type { AccountBinding } from '@/core/identity/local-profile'
import type { SyncPrefs } from '@/core/identity/sync-prefs'
import type { MemoryItem } from '@/core/memory/memory-item'
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
  'SYNC_REPLACE_LOCAL_EMPTY', // 本机空库禁止盖云
  'SYNC_REPLACE_REMOTE_FAILED', // 云端覆盖本机失败
  'ORPHAN_EXPORT_FAILED', // 导出孤儿桶失败
  'ORPHAN_CLEAR_FAILED' // 清除孤儿桶失败
])

export type AccountSyncErrorCode = z.infer<typeof AccountSyncErrorCodeSchema>

/**
 * 退出登录对本机 Memory 的处理策略。
 * 默认 keep_local：不清库；clear / sync_then_clear 须经设置页确认框。
 */
export const AuthSignOutModeSchema = z.enum([
  'keep_local', // 仅退出，保留本机当前账号 Memory
  'clear_local', // 退出并删除本机当前 accountId 桶（不动 localProfileId）
  'sync_then_clear_local' // 先将本机（含 remap）覆盖云端，再清本机账号桶并退出
])

export type AuthSignOutMode = z.infer<typeof AuthSignOutModeSchema>

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
  payload: {
    mode: AuthSignOutMode
  }
}

export type AuthSignOutResponse =
  | {
      ok: true
      mode: AuthSignOutMode
      /** 本机被删除的当前账号条目数（keep_local 为 0） */
      clearedCount: number
      /** sync_then_clear 时写入云端的条数；其它模式为 0 */
      syncedCount: number
    }
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
      /** 当前账号 ownerId 下未软删条数（退出对话框用） */
      accountOwnerCount: number
      /** 本机 localProfileId 下未软删条数（退出对话框用） */
      localProfileOwnerCount: number
      remoteCount: number
      latestRemoteUpdatedAt: string | null
      /** 两边都有未删数据，需用户选 A/B */
      needsConflictChoice: boolean
      /** 保留集外的历史账号桶个数 */
      orphanBucketCount: number
      /** 孤儿桶未软删条数之和 */
      orphanActiveCount: number
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

/** 导出本机孤儿 owner 桶（换号残留），供设置页下载 JSON。 */
export type ExportOrphanOwnersMessage = {
  scope: BackgroundMessageScope
  type: 'EXPORT_ORPHAN_OWNERS'
}

export type ExportOrphanOwnersResponse =
  | {
      ok: true
      orphanBucketCount: number
      items: MemoryItem[]
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 硬删本机孤儿 owner 桶（不动当前账号与 localProfile）。 */
export type ClearOrphanOwnersMessage = {
  scope: BackgroundMessageScope
  type: 'CLEAR_ORPHAN_OWNERS'
}

export type ClearOrphanOwnersResponse =
  | {
      ok: true
      clearedBuckets: number
      clearedItems: number
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
  | ExportOrphanOwnersMessage
  | ClearOrphanOwnersMessage

export type AccountSyncBackgroundResponse =
  | AuthSignInResponse
  | AuthSignOutResponse
  | GetAuthStateResponse
  | GetSyncStatusResponse
  | SetSyncEnabledResponse
  | SyncReplaceWithLocalResponse
  | SyncReplaceWithRemoteResponse
  | ExportOrphanOwnersResponse
  | ClearOrphanOwnersResponse
