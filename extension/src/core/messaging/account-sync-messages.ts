import { z } from 'zod'

import type { AccountBinding } from '@/core/identity/local-profile'
import type { SubscriptionSnapshot } from '@/core/identity/subscription-snapshot'
import type { SyncPrefs } from '@/core/identity/sync-prefs'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { BackgroundMessageScope } from '@/core/messaging/constants'
import type {
  MemoryNoteRecord,
  MemoryNotesMeta
} from '@/infrastructure/indexeddb/memory-notes-types'

/** 账户 / 同步面向 UI 的稳定错误码。 */
export const AccountSyncErrorCodeSchema = z.enum([
  'AUTH_NOT_CONFIGURED', // 未配置 Supabase
  'AUTH_SIGN_IN_FAILED', // 登录失败
  'AUTH_CONNECT_WEBSITE_FAILED', // Connect 官网会话到扩展失败
  'AUTH_SIGN_OUT_FAILED', // 登出失败
  'AUTH_STATE_READ_FAILED', // 读取登录态失败
  'AUTH_PROFILE_REFRESH_FAILED', // 刷新头像/资料失败
  'WEBSITE_AUTH_PROBE_FAILED', // 探测官网登录态失败
  'SYNC_NOT_AUTHENTICATED', // 未登录无法同步
  'SYNC_PRO_REQUIRED', // 云同步需有效 Pro
  'SYNC_STATUS_FAILED', // 同步状态失败
  'SYNC_PREFS_UPDATE_FAILED', // 更新同步偏好失败
  'SYNC_REPLACE_LOCAL_FAILED', // 本机覆盖云端失败
  'SYNC_REPLACE_LOCAL_EMPTY', // 本机空库禁止盖云
  'SYNC_REPLACE_REMOTE_FAILED', // 云端覆盖本机失败
  'SYNC_MERGE_FAILED', // 本机与云端并集合并失败
  'SYNC_RESTORE_BACKUP_FAILED', // 从云端备份恢复失败
  'SYNC_INCREMENTAL_FAILED', // 增量/定时同步失败
  'SYNC_INCREMENTAL_OFFLINE', // 增量同步时浏览器离线
  'PRIVACY_NOTICE_REQUIRED', // 开同步前须确认隐私说明
  'PRIVACY_ACK_FAILED', // 确认隐私说明失败
  'CLOUD_DELETE_FAILED', // 删除云端记忆失败
  'ACCOUNT_DELETE_FAILED', // 删除账号失败
  'LOCAL_EXPORT_FAILED', // 导出本机记忆失败
  'ORPHAN_EXPORT_FAILED', // 导出孤儿桶失败
  'ORPHAN_CLEAR_FAILED', // 清除孤儿桶失败
  'LOCAL_CLEAR_FAILED', // 清除本机记忆失败
  'LOCAL_RECALL_ADAPTATION_CLEAR_FAILED', // 清除本机 Recall 适应信号失败
  'LOGIN_MIGRATION_STATUS_FAILED', // 读取登录迁移门闸失败
  'LOGIN_MIGRATION_FAILED', // 执行登录迁移（导入/导出/删除）失败
  'SUBSCRIPTION_STATUS_FAILED', // 拉取订阅状态失败
  'MCP_REMOTE_UPDATE_FAILED', // 同步 MCP 开关到云端失败
  'AUTH_PROMOTE_INVALID_EMAIL', // 转正邮箱格式非法
  'AUTH_PROMOTE_EMAIL_CONFLICT', // 转正邮箱已被其它账号占用
  'AUTH_PROMOTE_FAILED', // 转正失败（网络 / Worker）
  'AUTH_PROMOTE_NOT_ANONYMOUS' // 当前非匿名会话，无法转正
])

export type AccountSyncErrorCode = z.infer<typeof AccountSyncErrorCodeSchema>

/**
 * 退出登录对本机 Memory 的处理策略（ADR-018 · G1-a）。
 * 默认 keep_local：账号桶（摘录+书签）全量回迁 localProfileId；
 * `deleteLocalExcerpts: true` 才走旧口径 A（删摘录）；Pro 可先 flush_then_keep。
 */
export const AuthSignOutModeSchema = z.enum([
  'keep_local', // 默认：账号桶全量回迁本地档后退出；opt-in 可删摘录
  'flush_then_keep', // 先 flush 摘录上云，再同 keep_local 回迁（失败不退出，UI 可仍退出）
  'clear_local' // 整桶清空账号桶（含已归属书签，不回迁；强确认）
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

/**
 * 将本浏览器官网已登录会话接到扩展（Connect 软条）。
 * 优先 UI 桥零导航；无 ack 则打开 `/account?connect_extension=1`。
 */
export type AuthConnectWebsiteMessage = {
  scope: BackgroundMessageScope
  type: 'AUTH_CONNECT_WEBSITE'
}

export type AuthConnectWebsiteResponse =
  | {
      ok: true
      /** bridge=Port 零导航；account_tab=打开/聚焦账户页 */
      path: 'bridge' | 'account_tab'
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      /** 用户取消挤掉（非硬失败） */
      cancelled?: boolean
      error?: string
    }

export type AuthSignOutMessage = {
  scope: BackgroundMessageScope
  type: 'AUTH_SIGN_OUT'
  payload: {
    mode: AuthSignOutMode
    /**
     * true = 旧口径 A：删账号桶摘录、书签回迁；
     * false / 缺省 = 全量回迁（与 clear_local 不同）。
     */
    deleteLocalExcerpts?: boolean
  }
}

export type AuthSignOutResponse =
  | {
      ok: true
      mode: AuthSignOutMode
      /** 本机从账号桶删除的条数（仅 deleteLocalExcerpts / clear_local 等） */
      clearedCount: number
      /** flush_then_keep 时写入云端的条数；其它模式为 0 */
      syncedCount: number
      /** keep / flush_then_keep：回迁到本地档的条数（书签 + 摘录） */
      releasedToLocalCount: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
      /**
       * flush_then_keep 同步失败且尚未退出。
       * UI 应展示真实原因，并提供「先导出备份」与「仍退出」。
       */
      flushFailed?: true
    }

/** 登录迁移门闸动作。 */
export const LoginMigrationActionSchema = z.enum([
  'import', // 导入摘录（+ 本地档书签本机归属）到当前账号
  'export', // 导出未归属摘录 JSON
  'delete' // 删除未归属摘录
])

export type LoginMigrationAction = z.infer<typeof LoginMigrationActionSchema>

export type GetLoginMigrationStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_LOGIN_MIGRATION_STATUS'
}

export type GetLoginMigrationStatusResponse =
  | {
      ok: true
      pending: boolean
      excerptCount: number
      sourceOwnerIds: string[]
      localBookmarkCount: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type ResolveLoginMigrationMessage = {
  scope: BackgroundMessageScope
  type: 'RESOLVE_LOGIN_MIGRATION'
  payload: {
    action: LoginMigrationAction
  }
}

export type ResolveLoginMigrationResponse =
  | {
      ok: true
      action: 'import'
      importedExcerpts: number
      remappedLocalBookmarks: number
    }
  | {
      ok: true
      action: 'export'
      items: MemoryItem[]
    }
  | {
      ok: true
      action: 'delete'
      deletedCount: number
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

/** 探测官网是否已登录（开后台 probe 页；不写入扩展 session）。 */
export type ProbeWebsiteSignedInMessage = {
  scope: BackgroundMessageScope
  type: 'PROBE_WEBSITE_SIGNED_IN'
}

export type ProbeWebsiteSignedInResponse =
  | {
      ok: true
      websiteSignedIn: boolean
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type GetAuthStateResponse =
  | {
      ok: true
      signedIn: boolean
      binding: AccountBinding | null
      email?: string
      avatarUrl?: string
      displayName?: string
      /** 来自 device session；匿名试用为 true */
      isAnonymous?: boolean
      /** Turnstile 曾失败，Settings 可前景重试 */
      anonymousCaptchaRetryNeeded?: boolean
      syncPrefs: SyncPrefs
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** Settings：前景打开 Turnstile 页后重试匿名 ensure。 */
export type RetryAnonymousCaptchaMessage = {
  scope: BackgroundMessageScope
  type: 'RETRY_ANONYMOUS_CAPTCHA'
}

export type RetryAnonymousCaptchaResponse =
  | {
      ok: true
      /** ensure 结果摘要 */
      outcome: 'created' | 'already' | 'failed' | 'skipped_has_legacy'
      error?: string
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/**
 * 匿名试用转正：绑定邮箱（Worker `POST /api/auth/promote`）。
 * Side Panel 内联提示与 Settings 账号区共用。
 */
export type ConvertAnonymousAccountMessage = {
  scope: BackgroundMessageScope
  type: 'CONVERT_ANONYMOUS_ACCOUNT'
  payload: {
    email: string
  }
}

export type ConvertAnonymousAccountResponse =
  | {
      ok: true
      email: string
      userId: string
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 从 Supabase getUser 刷新本机 session 的头像 / 展示名（非热路径）。 */
export type RefreshAuthProfileMessage = {
  scope: BackgroundMessageScope
  type: 'REFRESH_AUTH_PROFILE'
}

export type RefreshAuthProfileResponse =
  | {
      ok: true
      email?: string
      avatarUrl?: string
      displayName?: string
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
      /** @deprecated 开同步已改为自动并集；恒为 false，保留字段兼容旧客户端 */
      needsConflictChoice: boolean
      /** 保留集外的历史账号桶个数 */
      orphanBucketCount: number
      /** 孤儿桶未软删条数之和 */
      orphanActiveCount: number
      /** 上次成功增量 pull 水位 */
      lastPulledAt?: string
      /** 上次成功增量 push 水位 */
      lastPushedAt?: string
      /** 是否已确认当前隐私说明版本（开同步门禁） */
      privacyNoticeAcked: boolean
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
      /** @deprecated 开同步已改为自动并集；恒为 false */
      needsConflictChoice: boolean
      localCount: number
      remoteCount: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 同步只读 MCP 开关到 Worker（KV；供云端 /api/mcp 门禁）。 */
export type SetMcpReadOnlyMessage = {
  scope: BackgroundMessageScope
  type: 'SET_MCP_READ_ONLY'
  payload: {
    enabled: boolean
  }
}

export type SetMcpReadOnlyResponse =
  | { ok: true; enabled: boolean }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 手动触发一次增量云同步（定时闹钟同路径）。 */
export type RunIncrementalMemorySyncMessage = {
  scope: BackgroundMessageScope
  type: 'RUN_INCREMENTAL_MEMORY_SYNC'
}

export type RunIncrementalMemorySyncResponse =
  | {
      ok: true
      pulled: number
      pushed: number
      mergedLocal: number
      lastPulledAt: string
      lastPushedAt: string
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

/** 用最近一次云端 replace 备份恢复，并拉回本机。 */
export type RestoreLatestSyncBackupMessage = {
  scope: BackgroundMessageScope
  type: 'RESTORE_LATEST_SYNC_BACKUP'
}

export type RestoreLatestSyncBackupResponse =
  | {
      ok: true
      backupId: string
      restored: number
      localWritten: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 确认当前版本隐私说明（开同步门禁）。 */
export type AckPrivacyNoticeMessage = {
  scope: BackgroundMessageScope
  type: 'ACK_PRIVACY_NOTICE'
}

export type AckPrivacyNoticeResponse =
  | {
      ok: true
      privacyNoticeAcked: true
      noticeAckedAt: string
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 删除云端全部 Memory（默认不动本机）。 */
export type DeleteCloudMemoryMessage = {
  scope: BackgroundMessageScope
  type: 'DELETE_CLOUD_MEMORY'
}

export type DeleteCloudMemoryResponse =
  | {
      ok: true
      deletedItems: number
      deletedBackups: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/**
 * 删除账号：云端 Memory + Auth 注销 + 本机当前 accountId 桶 + 退登。
 * 不动 localProfileId 身份。
 */
export type DeleteAccountMessage = {
  scope: BackgroundMessageScope
  type: 'DELETE_ACCOUNT'
}

export type DeleteAccountResponse =
  | {
      ok: true
      deletedItems: number
      deletedBackups: number
      clearedLocalCount: number
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 导出当前 owner 本机全部 Memory（含软删），供设置页下载 JSON。 */
export type ExportLocalMemoryMessage = {
  scope: BackgroundMessageScope
  type: 'EXPORT_LOCAL_MEMORY'
}

export type ExportLocalMemoryResponse =
  | {
      ok: true
      ownerId: string
      items: MemoryItem[]
      /** Dreaming L3 命题（Backup 须含；ADR-022）。 */
      memoryNotes: MemoryNoteRecord[]
      /** L3 meta（从未编译过则为 null）。 */
      memoryNotesMeta: MemoryNotesMeta | null
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/**
 * 清除当前 owner 本机全部 Memory（硬清 IndexedDB 行）。
 * 不得改写 Chrome 原生书签；成功后关书签灌库；若同步开着则关同步。
 */
export type ClearLocalMemoryMessage = {
  scope: BackgroundMessageScope
  type: 'CLEAR_LOCAL_MEMORY'
}

export type ClearLocalMemoryResponse =
  | {
      ok: true
      ownerId: string
      clearedCount: number
      /** 是否因此关闭了书签灌库 */
      bookmarkIngestDisabled: true
      /** 是否因此关闭了云同步 */
      syncDisabled: boolean
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/**
 * 仅清除本机 Recall 适应信号（Outcome 对 + TTE 环）。
 * 不删 Memory、不改条目 openCount、不关灌库/同步。
 */
export type ClearLocalRecallAdaptationMessage = {
  scope: BackgroundMessageScope
  type: 'CLEAR_LOCAL_RECALL_ADAPTATION'
}

export type ClearLocalRecallAdaptationResponse =
  | {
      ok: true
      /** 是否已清 Outcome 对键 */
      outcomePairsCleared: true
      /** 是否已清 TTE 遥测环 */
      telemetryCleared: true
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

/** 读取本机订阅快照（可顺带刷新）。 */
export type GetSubscriptionStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_SUBSCRIPTION_STATUS'
  payload?: {
    /** true 时强制打 Worker；默认先读缓存，无缓存再拉。 */
    refresh?: boolean
  }
}

export type GetSubscriptionStatusResponse =
  | {
      ok: true
      snapshot: SubscriptionSnapshot
      /** 官网定价页；未登录时 null */
      upgradeUrl: string | null
      /** 官网账户页（管理订阅） */
      manageUrl: string | null
    }
  | {
      ok: false
      errorCode: AccountSyncErrorCode
      error?: string
    }

export type AccountSyncBackgroundMessage =
  | AuthSignInMessage
  | AuthConnectWebsiteMessage
  | AuthSignOutMessage
  | GetAuthStateMessage
  | ProbeWebsiteSignedInMessage
  | RetryAnonymousCaptchaMessage
  | ConvertAnonymousAccountMessage
  | RefreshAuthProfileMessage
  | GetSyncStatusMessage
  | GetLoginMigrationStatusMessage
  | ResolveLoginMigrationMessage
  | SetSyncEnabledMessage
  | SetMcpReadOnlyMessage
  | RunIncrementalMemorySyncMessage
  | SyncReplaceWithLocalMessage
  | SyncReplaceWithRemoteMessage
  | ExportOrphanOwnersMessage
  | ClearOrphanOwnersMessage
  | RestoreLatestSyncBackupMessage
  | AckPrivacyNoticeMessage
  | DeleteCloudMemoryMessage
  | DeleteAccountMessage
  | ExportLocalMemoryMessage
  | ClearLocalMemoryMessage
  | ClearLocalRecallAdaptationMessage
  | GetSubscriptionStatusMessage

export type AccountSyncBackgroundResponse =
  | AuthSignInResponse
  | AuthConnectWebsiteResponse
  | AuthSignOutResponse
  | GetAuthStateResponse
  | ProbeWebsiteSignedInResponse
  | RetryAnonymousCaptchaResponse
  | ConvertAnonymousAccountResponse
  | RefreshAuthProfileResponse
  | GetSyncStatusResponse
  | GetLoginMigrationStatusResponse
  | ResolveLoginMigrationResponse
  | SetSyncEnabledResponse
  | SetMcpReadOnlyResponse
  | RunIncrementalMemorySyncResponse
  | SyncReplaceWithLocalResponse
  | SyncReplaceWithRemoteResponse
  | ExportOrphanOwnersResponse
  | ClearOrphanOwnersResponse
  | RestoreLatestSyncBackupResponse
  | AckPrivacyNoticeResponse
  | DeleteCloudMemoryResponse
  | DeleteAccountResponse
  | ExportLocalMemoryResponse
  | ClearLocalMemoryResponse
  | ClearLocalRecallAdaptationResponse
  | GetSubscriptionStatusResponse
