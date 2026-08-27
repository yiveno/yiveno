import { EVIDENCE_PACK_MAX_ITEMS, EVIDENCE_PACK_MIN_ITEMS } from '@/core/recall/evidence-pack'

/** 切换 evidence pack 多选（上限 5；满额时仅允许取消）。 */
export function toggleEvidencePackSelection(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) {
    next.delete(id)
    return next
  }
  if (next.size >= EVIDENCE_PACK_MAX_ITEMS) {
    return selected
  }
  next.add(id)
  return next
}

/** 是否还可继续勾选。 */
export function canSelectMoreEvidencePackItems(selected: Set<string>): boolean {
  return selected.size < EVIDENCE_PACK_MAX_ITEMS
}

export { EVIDENCE_PACK_MIN_ITEMS, EVIDENCE_PACK_MAX_ITEMS }
