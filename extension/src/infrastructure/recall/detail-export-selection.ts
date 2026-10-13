/** 切换 Detail export 多选（无条数上限）。 */
export function toggleDetailExportSelection(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) {
    next.delete(id)
    return next
  }
  next.add(id)
  return next
}

/** 全选：按 exportable 顺序勾选全部。 */
export function selectAllDetailExportItems(exportableIds: readonly string[]): Set<string> {
  return new Set(exportableIds)
}

/** 反选：在 exportable 范围内翻转勾选。 */
export function invertDetailExportSelection(
  exportableIds: readonly string[],
  selected: ReadonlySet<string>
): Set<string> {
  const next = new Set<string>()
  for (const id of exportableIds) {
    if (!selected.has(id)) {
      next.add(id)
    }
  }
  return next
}

export { DETAIL_EXPORT_MIN_ITEMS } from '@/core/recall/detail-export'
