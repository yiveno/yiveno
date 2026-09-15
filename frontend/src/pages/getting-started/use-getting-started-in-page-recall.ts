/**
 * Getting Started 页内真 Recall（书签 / 摘录 tab 共用）。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import { navigateActiveTab, recallWithClue } from '@/infrastructure/messaging/background-client'
import {
  markFirstRecallOpenDone,
  readFirstRecallOpenDone
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import {
  mapGettingStartedRecallCard,
  type GettingStartedRecallCard
} from '@/pages/getting-started/map-getting-started-recall-card'
import type { GettingStartedLibraryPhase } from '@/pages/getting-started/getting-started-progress'

export function useGettingStartedInPageRecall(options: {
  libraryPhase: Ref<GettingStartedLibraryPhase>
  /** 当前源是否可提交（书签须同意；摘录恒 true） */
  sourceUnlocked: Ref<boolean> | ComputedRef<boolean>
  logLabel: string
}) {
  const clueDraft = ref('')
  const recallBusy = ref(false)
  const recallError = ref('')
  const primaryCard = ref<GettingStartedRecallCard | null>(null)
  const secondaryCard = ref<GettingStartedRecallCard | null>(null)
  const emptyKind = ref<'none' | 'no_match' | 'need_a_clue' | null>(null)
  const recallDone = ref(false)

  const detailPageUrl = computed(() => chrome.runtime.getURL('detail.html'))

  async function syncRecallDoneFlag(): Promise<void> {
    recallDone.value = await readFirstRecallOpenDone()
  }

  async function markRecallSuccess(): Promise<void> {
    if (recallDone.value) {
      return
    }
    await markFirstRecallOpenDone()
    recallDone.value = true
  }

  function clearResults(): void {
    primaryCard.value = null
    secondaryCard.value = null
    emptyKind.value = null
    recallError.value = ''
  }

  async function handleSubmitClue(clue: string): Promise<void> {
    if (
      !options.sourceUnlocked.value ||
      recallBusy.value ||
      options.libraryPhase.value !== 'ready'
    ) {
      return
    }
    recallBusy.value = true
    clearResults()
    logger.info('Onboarding', `${options.logLabel} 页内 Recall 开始`, {
      cluePreview: clue.slice(0, 80)
    })

    try {
      const response = await recallWithClue({ clue })
      if (!response.ok) {
        recallError.value = t('getting_started_recall_failed')
        logger.warn('Onboarding', `${options.logLabel} 页内 Recall 失败`, {
          errorCode: response.errorCode
        })
        return
      }

      const { result } = response
      if (result.outcome === 'top_pick' && result.topPick) {
        primaryCard.value = mapGettingStartedRecallCard(
          result.topPick,
          result.clue,
          t,
          detailPageUrl.value
        )
        const also = result.alsoPossible[0]
        secondaryCard.value = also
          ? mapGettingStartedRecallCard(also, result.clue, t, detailPageUrl.value)
          : null
        emptyKind.value = null
        await markRecallSuccess()
        logger.info('Onboarding', `${options.logLabel} 页内 Recall top_pick`, {
          id: result.topPick.item.id
        })
        return
      }

      if (result.outcome === 'need_a_clue') {
        const first = result.alsoPossible[0]
        if (first) {
          primaryCard.value = mapGettingStartedRecallCard(
            first,
            result.clue,
            t,
            detailPageUrl.value
          )
          const second = result.alsoPossible[1]
          secondaryCard.value = second
            ? mapGettingStartedRecallCard(second, result.clue, t, detailPageUrl.value)
            : null
        }
        emptyKind.value = 'need_a_clue'
        return
      }

      emptyKind.value = 'no_match'
    } catch (error) {
      recallError.value = t('getting_started_recall_failed')
      logger.warn('Onboarding', `${options.logLabel} 页内 Recall 异常`, { error })
    } finally {
      recallBusy.value = false
    }
  }

  async function handleOpenCard(card: GettingStartedRecallCard): Promise<void> {
    if (!options.sourceUnlocked.value) {
      return
    }
    try {
      await navigateActiveTab({ url: card.url, disposition: 'newForegroundTab' })
      await markRecallSuccess()
    } catch (error) {
      recallError.value = t('getting_started_open_result_failed')
      logger.warn('Onboarding', `${options.logLabel} 打开结果失败`, { error, id: card.id })
    }
  }

  async function handleFoundYes(): Promise<void> {
    if (!options.sourceUnlocked.value) {
      return
    }
    await markRecallSuccess()
  }

  return {
    clueDraft,
    recallBusy,
    recallError,
    primaryCard,
    secondaryCard,
    emptyKind,
    recallDone,
    syncRecallDoneFlag,
    clearResults,
    handleSubmitClue,
    handleOpenCard,
    handleFoundYes
  }
}
