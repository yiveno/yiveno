import { computed, ref, type Ref } from 'vue'
import type {
  BookmarkOperation,
  BookmarkOperationType,
  DiffResult
} from '@/application/bookmark/bookmark-diff-service'
import { message } from '@/application/message/message-service'
import { logger } from '@/infrastructure/logging/logger'
import { t } from '@/utils/i18n-helpers'
import { getOperationsByType } from '../utils/management-utils'

interface BookmarkManagementStoreLike {
  hasUnsavedChanges: boolean
  applyProgress: {
    isApplying: boolean
    currentIndex: number
    totalOperations: number
  }
  calculateDiff(): DiffResult | null
  validateCurrentProposalApply(operations: BookmarkOperation[]): { ok: boolean; issues: unknown[] }
  applyChanges(
    operations: BookmarkOperation[],
    onProgress?: (current: number, total: number, operation: string) => void
  ): Promise<{
    success: boolean
    errors: Array<{ operation: BookmarkOperation; error: string }>
  }>
  markAsAIGenerated(value: boolean): void
}

/**
 * 管理页提案 diff 计算、确认与应用流程
 */
export function useManagementApplyFlow(
  bookmarkManagementStore: BookmarkManagementStoreLike,
  isPageLoading: Ref<boolean>,
  clearUnifiedSearch?: () => Promise<void>
) {
  const showApplyConfirmDialog = ref(false)
  const diffResult = ref<DiffResult | null>(null)
  const applyStartTime = ref(0)

  const applyButtonTooltip = computed(() => {
    if (isPageLoading.value) {
      return t('management_tooltip_page_loading')
    }

    if (!bookmarkManagementStore.hasUnsavedChanges) {
      return t('management_tooltip_no_changes')
    }

    return t('management_tooltip_apply_ready')
  })

  const applyConfirmTitle = computed(() => {
    if (!diffResult.value) return t('management_apply')

    const total = diffResult.value.statistics.total
    if (total < 100) {
      return t('management_confirm_apply_changes')
    }
    if (total < 500) {
      return '⚠️ ' + t('management_confirm_apply_changes')
    }
    return '⚠️ ' + t('management_large_operation_warning')
  })

  const applyConfirmIcon = computed(() => {
    if (!diffResult.value) return 'icon-check'

    const total = diffResult.value.statistics.total
    if (total < 100) {
      return 'icon-check'
    }
    return 'icon-warning'
  })

  const estimatedRemainingTime = computed(() => {
    const progress = bookmarkManagementStore.applyProgress
    if (!progress.isApplying || progress.currentIndex === 0) {
      return t('management_calculating')
    }

    const elapsed = Date.now() - applyStartTime.value
    const avgTimePerOp = elapsed / progress.currentIndex
    const remaining = Math.ceil(
      ((progress.totalOperations - progress.currentIndex) * avgTimePerOp) / 1000
    )

    if (remaining < 60) {
      return t('management_about_seconds', String(remaining))
    }
    const minutes = Math.ceil(remaining / 60)
    return t('management_about_minutes', String(minutes))
  })

  function getOperationIcon(type: BookmarkOperationType): string {
    const icons: Record<BookmarkOperationType, string> = {
      create: 'plus',
      move: 'refresh',
      edit: 'edit',
      delete: 'trash'
    }
    return icons[type] || 'bookmark'
  }

  function getOperationTypeText(type: BookmarkOperationType): string {
    const texts: Record<BookmarkOperationType, string> = {
      create: '新增',
      move: '移动',
      edit: '编辑',
      delete: '删除'
    }
    return texts[type] || type
  }

  function getOperationsByDiffType(type: BookmarkOperationType): BookmarkOperation[] {
    if (!diffResult.value) return []
    return getOperationsByType(diffResult.value.operations, type)
  }

  function handleApplyClick(): void {
    const diff = bookmarkManagementStore.calculateDiff()
    if (!diff || diff.statistics.total === 0) {
      bookmarkManagementStore.hasUnsavedChanges = false
      message.info(t('management_no_changes_detected'))
      return
    }

    const validation = bookmarkManagementStore.validateCurrentProposalApply(diff.operations)
    if (!validation.ok) {
      logger.error('Management', '提案应用前校验失败', validation.issues)
      message.error(t('management_apply_validation_failed'))
      return
    }

    diffResult.value = diff
    showApplyConfirmDialog.value = true
  }

  async function confirmApplyChanges(): Promise<void> {
    try {
      showApplyConfirmDialog.value = false
      applyStartTime.value = Date.now()

      const freshDiff = bookmarkManagementStore.calculateDiff()
      if (!freshDiff || freshDiff.statistics.total === 0) {
        bookmarkManagementStore.hasUnsavedChanges = false
        message.info(t('management_no_changes_detected'))
        diffResult.value = null
        return
      }

      const validation = bookmarkManagementStore.validateCurrentProposalApply(freshDiff.operations)
      if (!validation.ok) {
        logger.error('Management', '提案应用前校验失败', validation.issues)
        message.error(t('management_apply_validation_failed'))
        diffResult.value = null
        return
      }

      const result = await bookmarkManagementStore.applyChanges(
        freshDiff.operations,
        (current, total, operation) => {
          logger.debug('Management', `应用进度: ${current}/${total}`, { operation })
        }
      )

      if (result.success) {
        message.success(t('management_all_changes_applied'))
        bookmarkManagementStore.markAsAIGenerated(false)
        await clearUnifiedSearch?.()
      } else {
        logger.error('Management', '应用更改失败', result.errors)
        message.error(t('management_apply_changes_failed'))
      }

      diffResult.value = null
    } catch (error) {
      logger.error('Management', '应用更改失败', error)
      message.error(t('management_apply_changes_failed'))
    }
  }

  return {
    showApplyConfirmDialog,
    diffResult,
    applyButtonTooltip,
    applyConfirmTitle,
    applyConfirmIcon,
    estimatedRemainingTime,
    getOperationIcon,
    getOperationTypeText,
    getOperationsByDiffType,
    handleApplyClick,
    confirmApplyChanges
  }
}
