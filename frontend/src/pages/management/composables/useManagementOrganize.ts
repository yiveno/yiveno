import { ref, type Ref } from 'vue'
import { bookmarkOrganizeService } from '@/application/bookmark/bookmark-organize-service'
import type { OrganizeProgress } from '@/application/bookmark/bookmark-organize-service'
import { createInitialOrganizeProgress } from '@/core/bookmark/organize-progress'
import { message } from '@/application/message/message-service'
import { logger } from '@/infrastructure/logging/logger'
import { t } from '@/utils/i18n-helpers'
import type { BookmarkNode } from '@/types'

interface BookmarkManagementStoreLike {
  applyOrganizeProposal(proposalTree: BookmarkNode[]): void
}

/**
 * 管理页 AI 一键整理流程
 */
export function useManagementOrganize(options: {
  bookmarkManagementStore: BookmarkManagementStoreLike
  originalTree: Ref<BookmarkNode[]>
  isLeftPanelCollapsed: Ref<boolean>
}) {
  const { bookmarkManagementStore, originalTree, isLeftPanelCollapsed } = options

  const isOrganizing = ref(false)
  const organizeProgress = ref<OrganizeProgress>(createInitialOrganizeProgress())
  const showOrganizeProgress = ref(false)
  const showOrganizeNotesDialog = ref(false)
  const organizeUserNotes = ref('')
  const organizeRemoveDuplicates = ref(false)
  const organizeRemoveInvalid = ref(false)
  const ORGANIZE_USER_NOTES_MAX_LENGTH = 500

  function handleAutoOrganize(): void {
    if (isOrganizing.value) return
    showOrganizeNotesDialog.value = true
  }

  function closeOrganizeNotesDialog(): void {
    showOrganizeNotesDialog.value = false
  }

  async function confirmStartOrganize(): Promise<void> {
    if (isOrganizing.value) return

    const userNotes = organizeUserNotes.value.trim()
    const removeDuplicates = organizeRemoveDuplicates.value
    const removeInvalid = organizeRemoveInvalid.value
    showOrganizeNotesDialog.value = false
    await runAutoOrganize(userNotes, removeDuplicates, removeInvalid)
  }

  async function runAutoOrganize(
    userNotes?: string,
    removeDuplicates?: boolean,
    removeInvalid?: boolean
  ): Promise<void> {
    if (isOrganizing.value) return

    const organizingSnapshot = isOrganizing.value
    isOrganizing.value = true
    organizeProgress.value = createInitialOrganizeProgress()
    showOrganizeProgress.value = true

    try {
      await bookmarkOrganizeService.ensureLlmReady()
      logger.info('Management', '开始一键整理书签', {
        hasUserNotes: Boolean(userNotes),
        removeDuplicates: Boolean(removeDuplicates),
        removeInvalid: Boolean(removeInvalid)
      })

      const result = await bookmarkOrganizeService.organizeBookmarks(
        progress => {
          organizeProgress.value = progress
        },
        {
          ...(userNotes ? { userNotes } : {}),
          ...(removeDuplicates ? { removeDuplicates: true } : {}),
          ...(removeInvalid ? { removeInvalid: true } : {})
        }
      )

      const proposalTree = bookmarkOrganizeService.buildValidatedProposalPreview(
        originalTree.value,
        result
      )

      bookmarkManagementStore.applyOrganizeProposal(proposalTree)
      isLeftPanelCollapsed.value = false

      message.success(t('management_organize_success'))
      logger.info('Management', 'AI 整理提案已生成', result)
    } catch (error) {
      logger.error('Management', '一键整理失败', error)
      message.error(t('management_organize_failed_retry'))
    } finally {
      if (organizingSnapshot !== undefined) {
        isOrganizing.value = false
      }
      showOrganizeProgress.value = false
    }
  }


  return {
    isOrganizing,
    organizeProgress,
    showOrganizeProgress,
    showOrganizeNotesDialog,
    organizeUserNotes,
    organizeRemoveDuplicates,
    organizeRemoveInvalid,
    ORGANIZE_USER_NOTES_MAX_LENGTH,
    handleAutoOrganize,
    closeOrganizeNotesDialog,
    confirmStartOrganize
  }
}
