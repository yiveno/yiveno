/**
 * 登录迁移门闸 UI（ADR-018）：Import / Export / Delete。
 * Settings 与 Side Panel 共用。
 */

import { ref } from 'vue'
import {
  fetchLoginMigrationStatus,
  resolveLoginMigration
} from '@/infrastructure/messaging/background-client'
import { tAccountSyncError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'

export function useLoginMigrationDialog() {
  const { success: showToastSuccess } = useAppToast()
  const loginMigrationOpen = ref(false)
  const loginMigrationLoading = ref(false)
  const loginMigrationError = ref('')
  const loginMigrationExcerptCount = ref(0)
  const loginMigrationBookmarkCount = ref(0)
  /** Export 后提示是否删除未导入副本 */
  const loginMigrationDeleteAfterExportOpen = ref(false)
  /**
   * 本页内存态：用户点「稍后再说」/ Esc 后本会话不再弹。
   * composable 随页面挂载重建 → Side Panel 与设置页各有一份，进设置会再提醒。
   */
  const loginMigrationDismissed = ref(false)

  function downloadMigrationExportJson(items: unknown[]): void {
    const blob = new Blob(
      [JSON.stringify({ kind: 'yiveno-login-migration-excerpts', items }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `yiveno-login-migration-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** 已登录时盘点；有未归属摘录则弹窗（本页已 dismiss 则不重开）。 */
  async function refreshLoginMigrationGate(): Promise<void> {
    try {
      const response = await fetchLoginMigrationStatus()
      if (!response.ok) {
        return
      }
      loginMigrationExcerptCount.value = response.excerptCount
      loginMigrationBookmarkCount.value = response.localBookmarkCount
      if (response.pending) {
        loginMigrationError.value = ''
        if (!loginMigrationDismissed.value) {
          loginMigrationOpen.value = true
        }
      } else {
        loginMigrationOpen.value = false
      }
    } catch {
      // 门闸失败不阻断主 UI
    }
  }

  /** 稍后再说 / Esc：关本次；下次进 Side Panel 或设置页再提醒。 */
  function dismissLoginMigration(): void {
    loginMigrationOpen.value = false
    loginMigrationDismissed.value = true
  }

  async function runLoginMigrationImport(): Promise<void> {
    if (loginMigrationLoading.value) {
      return
    }
    loginMigrationLoading.value = true
    loginMigrationError.value = ''
    try {
      const response = await resolveLoginMigration('import')
      if (!response.ok) {
        loginMigrationError.value = tAccountSyncError(response.errorCode)
        return
      }
      if (response.action !== 'import') {
        loginMigrationError.value = t('settings_error_login_migration')
        return
      }
      showToastSuccess(
        t('settings_login_migration_import_done', [
          String(response.importedExcerpts),
          String(response.remappedLocalBookmarks)
        ])
      )
      loginMigrationOpen.value = false
    } catch {
      loginMigrationError.value = t('settings_error_login_migration')
    } finally {
      loginMigrationLoading.value = false
    }
  }

  async function runLoginMigrationExport(): Promise<void> {
    if (loginMigrationLoading.value) {
      return
    }
    loginMigrationLoading.value = true
    loginMigrationError.value = ''
    try {
      const response = await resolveLoginMigration('export')
      if (!response.ok) {
        loginMigrationError.value = tAccountSyncError(response.errorCode)
        return
      }
      if (response.action !== 'export') {
        loginMigrationError.value = t('settings_error_login_migration')
        return
      }
      downloadMigrationExportJson(response.items)
      showToastSuccess(t('settings_login_migration_export_done', [String(response.items.length)]))
      loginMigrationDeleteAfterExportOpen.value = true
    } catch {
      loginMigrationError.value = t('settings_error_login_migration')
    } finally {
      loginMigrationLoading.value = false
    }
  }

  async function runLoginMigrationDelete(): Promise<void> {
    if (loginMigrationLoading.value) {
      return
    }
    loginMigrationLoading.value = true
    loginMigrationError.value = ''
    try {
      const response = await resolveLoginMigration('delete')
      if (!response.ok) {
        loginMigrationError.value = tAccountSyncError(response.errorCode)
        return
      }
      if (response.action !== 'delete') {
        loginMigrationError.value = t('settings_error_login_migration')
        return
      }
      showToastSuccess(t('settings_login_migration_delete_done', [String(response.deletedCount)]))
      loginMigrationOpen.value = false
      loginMigrationDeleteAfterExportOpen.value = false
    } catch {
      loginMigrationError.value = t('settings_error_login_migration')
    } finally {
      loginMigrationLoading.value = false
    }
  }

  function dismissDeleteAfterExport(): void {
    loginMigrationDeleteAfterExportOpen.value = false
    // 仍 pending：主门闸保持打开
  }

  return {
    dismissDeleteAfterExport,
    dismissLoginMigration,
    loginMigrationBookmarkCount,
    loginMigrationDeleteAfterExportOpen,
    loginMigrationError,
    loginMigrationExcerptCount,
    loginMigrationLoading,
    loginMigrationOpen,
    refreshLoginMigrationGate,
    runLoginMigrationDelete,
    runLoginMigrationExport,
    runLoginMigrationImport
  }
}
