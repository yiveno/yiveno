import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'

/** v-memo 依赖：detail export / 折叠 / 卡面文案变更时才重绘单卡。 */
export function recallResultCardMemoDeps(input: {
  card: RecallCardModel
  expanded: boolean
  detailExportSelectionActive: boolean
  detailExportSelected: boolean
  topPick?: boolean
  compact?: boolean
  keyboardSelected: boolean
}): unknown[] {
  const { card } = input
  return [
    card.id,
    card.title,
    card.subtitle,
    card.excerpt,
    card.note,
    card.typeLabel,
    card.duplicateTotalCount,
    input.expanded,
    input.detailExportSelectionActive,
    input.detailExportSelected,
    input.topPick === true,
    input.compact === true,
    input.keyboardSelected
  ]
}
