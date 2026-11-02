import {
  scoreRecallEvidenceEcs,
  truncateRecallTelemetryAnchor
} from '@/core/recall/recall-telemetry'

/** TTE evidenceVisible 所需卡片字段（与 RecallCardModel 子集对齐）。 */
export interface RecallEvidenceCardInput {
  id: string
  typeLabel: string
  subtitle: string
  title: string
  url: string
  excerpt?: string
  savedAtIso?: string
  reasonLine?: string
  reasonCodes?: string[]
  telemetryRank?: number
}

export interface RecallEvidenceVisiblePayload {
  memoryItemId: string
  rank: number
  ecs: number
  reasonCodes?: string[]
  anchor?: string
}

/** 无 telemetryRank 时不打点。 */
export function buildRecallEvidencePayload(
  card: RecallEvidenceCardInput
): RecallEvidenceVisiblePayload | null {
  const rank = card.telemetryRank
  if (rank === undefined) {
    return null
  }

  const ecs = scoreRecallEvidenceEcs({
    typeLabel: card.typeLabel,
    subtitle: card.subtitle,
    title: card.title,
    url: card.url,
    ...(card.excerpt !== undefined ? { excerpt: card.excerpt } : {}),
    ...(card.savedAtIso !== undefined ? { savedAtIso: card.savedAtIso } : {}),
    ...(card.reasonLine !== undefined ? { reasonLine: card.reasonLine } : {})
  })

  const anchorRaw = card.excerpt?.trim() || card.title.trim()
  const anchor = anchorRaw ? truncateRecallTelemetryAnchor(anchorRaw) : ''

  return {
    memoryItemId: card.id,
    rank,
    ecs,
    ...(card.reasonCodes?.length ? { reasonCodes: card.reasonCodes } : {}),
    ...(anchor ? { anchor } : {})
  }
}

const DEFAULT_EVIDENCE_VISIBILITY_THRESHOLD = 0.35

/**
 * 卡片进入视口后再回调（TTE 仅计用户可见 evidence）。
 * 无 IntersectionObserver 时同步回调，便于单测与旧环境降级。
 */
export function scheduleRecallEvidenceWhenVisible(
  getRoot: () => HTMLElement | null,
  onVisible: () => void,
  options?: { threshold?: number }
): () => void {
  const root = getRoot()
  if (!root || typeof IntersectionObserver === 'undefined') {
    onVisible()
    return () => {}
  }

  let fired = false
  const threshold = options?.threshold ?? DEFAULT_EVIDENCE_VISIBILITY_THRESHOLD
  const observer = new IntersectionObserver(
    entries => {
      if (fired) {
        return
      }
      const entry = entries[0]
      if (entry?.isIntersecting) {
        fired = true
        onVisible()
        observer.disconnect()
      }
    },
    { threshold }
  )

  observer.observe(root)
  return () => observer.disconnect()
}
