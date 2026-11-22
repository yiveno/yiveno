/**
 * Side Panel 详情导出：多选模式、选中集合、copy/download toast、全选/反选。
 * 从 SidePanel.vue 机械抽出；行为与原文一致。
 * expandedDuplicateGroupId 属结果卡折叠，见 use-recall-result-cards。
 */

import { computed, type ComputedRef, type Ref, ref } from 'vue'

import type { ConversationTurn } from '@/pages/sidepanel/recall-conversation-types'
import type { RecallOutcomeSessionState } from '@/application/recall/commit-recall-outcome'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import {
  copyDetailExportToClipboard,
  downloadDetailExport
} from '@/infrastructure/recall/detail-export-client'
import {
  invertDetailExportSelection,
  selectAllDetailExportItems,
  toggleDetailExportSelection as toggleDetailExportSelectionSet
} from '@/infrastructure/recall/detail-export-selection'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'
import { t } from '@/infrastructure/i18n/t'

/** 导出栏 bulk 动作：首次全选 → 之后反选。 */
export type DetailExportBulkAction = 'selectAll' | 'invert'

export type UseDetailExportOptions = {
  /** 会话轮次（判定是否有可导出结果卡）。 */
  conversationTurns: Ref<ConversationTurn[]>
  /** Outcome 会话：导出成功时写 copiedOrPackedId。 */
  outcomeSession: Ref<RecallOutcomeSessionState>
}

export type UseDetailExportResult = {
  selectedDetailExportIds: Ref<Set<string>>
  detailExportMode: Ref<boolean>
  detailExportExporting: Ref<boolean>
  detailExportSelectedCount: ComputedRef<number>
  showDetailExportBar: ComputedRef<boolean>
  hasRecallResultCards: ComputedRef<boolean>
  /** 当前结果集可导出 id（含重复组 siblings）。 */
  exportableDetailExportIds: ComputedRef<string[]>
  detailExportBulkAction: Ref<DetailExportBulkAction>
  enterDetailExportMode: () => void
  exitDetailExportMode: () => void
  handleToggleDetailExportSelection: (id: string) => void
  handleDetailExportBulk: () => void
  clearDetailExportSelection: () => void
  runDetailExportAction: (
    format: 'json' | 'markdown',
    channel: 'copy' | 'download'
  ) => Promise<void>
}

/** 从会话轮次收集可导出 MemoryItem id（去重保序；含 siblings）。 */
export function collectExportableDetailExportIds(turns: readonly ConversationTurn[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()

  function pushCard(card: RecallCardModel | null | undefined): void {
    if (!card || seen.has(card.id)) {
      return
    }
    seen.add(card.id)
    ids.push(card.id)
    if (!card.siblings) {
      return
    }
    for (const sibling of card.siblings) {
      if (seen.has(sibling.id)) {
        continue
      }
      seen.add(sibling.id)
      ids.push(sibling.id)
    }
  }

  for (const turn of turns) {
    if (turn.role !== 'assistant') {
      continue
    }
    pushCard(turn.primaryCard)
    pushCard(turn.relatedGuessCard)
    for (const card of turn.candidateCards ?? []) {
      pushCard(card)
    }
  }
  return ids
}

/** Side Panel 详情导出模式与执行。 */
export function useDetailExport(options: UseDetailExportOptions): UseDetailExportResult {
  const { conversationTurns, outcomeSession } = options

  const selectedDetailExportIds = ref<Set<string>>(new Set())
  /** Detail export 多选模式：默认关，点 Export 后才显示勾选框。 */
  const detailExportMode = ref(false)
  const detailExportExporting = ref(false)
  const detailExportBulkAction = ref<DetailExportBulkAction>('selectAll')

  const { success: showToastSuccess, error: showToastError } = useAppToast()

  const detailExportSelectedCount = computed(() => selectedDetailExportIds.value.size)
  const showDetailExportBar = computed(() => detailExportMode.value)

  const exportableDetailExportIds = computed(() =>
    collectExportableDetailExportIds(conversationTurns.value)
  )

  /** 当前线程是否有可导出的结果卡（非空态 / 纯追问）。 */
  const hasRecallResultCards = computed(() =>
    conversationTurns.value.some(turn => {
      if (turn.role !== 'assistant') {
        return false
      }
      return Boolean(
        turn.primaryCard || turn.relatedGuessCard || (turn.candidateCards?.length ?? 0) > 0
      )
    })
  )

  function enterDetailExportMode(): void {
    detailExportMode.value = true
    detailExportBulkAction.value = 'selectAll'
  }

  function exitDetailExportMode(): void {
    detailExportMode.value = false
    detailExportBulkAction.value = 'selectAll'
    selectedDetailExportIds.value = new Set()
  }

  function handleToggleDetailExportSelection(id: string): void {
    selectedDetailExportIds.value = toggleDetailExportSelectionSet(
      selectedDetailExportIds.value,
      id
    )
  }

  /** 全选 ↔ 反选（与 Library 同规则；操作对象 = 当前结果集可导出 id）。 */
  function handleDetailExportBulk(): void {
    const ids = exportableDetailExportIds.value
    if (detailExportBulkAction.value === 'selectAll') {
      selectedDetailExportIds.value = selectAllDetailExportItems(ids)
      detailExportBulkAction.value = 'invert'
      return
    }
    selectedDetailExportIds.value = invertDetailExportSelection(ids, selectedDetailExportIds.value)
    detailExportBulkAction.value = 'selectAll'
  }

  function clearDetailExportSelection(): void {
    exitDetailExportMode()
  }

  async function runDetailExportAction(
    format: 'json' | 'markdown',
    channel: 'copy' | 'download'
  ): Promise<void> {
    if (detailExportExporting.value) {
      return
    }
    detailExportExporting.value = true
    try {
      const ids = [...selectedDetailExportIds.value]
      const result =
        channel === 'copy'
          ? await copyDetailExportToClipboard(ids, format)
          : await downloadDetailExport(ids, format)
      if (!result.ok) {
        showToastError(tMemoryError(result.errorCode))
        return
      }
      showToastSuccess(
        channel === 'copy' ? t('detail_export_copy_success') : t('detail_export_download_success')
      )
      const firstId = ids[0]
      if (firstId) {
        outcomeSession.value = {
          ...outcomeSession.value,
          copiedOrPackedId: firstId
        }
      }
    } catch {
      showToastError(t('error_detail_export_operation_failed'))
    } finally {
      detailExportExporting.value = false
    }
  }

  return {
    selectedDetailExportIds,
    detailExportMode,
    detailExportExporting,
    detailExportSelectedCount,
    showDetailExportBar,
    hasRecallResultCards,
    exportableDetailExportIds,
    detailExportBulkAction,
    enterDetailExportMode,
    exitDetailExportMode,
    handleToggleDetailExportSelection,
    handleDetailExportBulk,
    clearDetailExportSelection,
    runDetailExportAction
  }
}
