/**
 * Composer 入口：只 re-export pages 实际用到的 core URL 工具。
 * 实现权威在 `@/core/recall/clue-plain-url` 与 `clue-url-display`。
 */

export { formatClueUrlDisplayLabel } from '@/core/recall/clue-url-display'

export {
  formatCluePlainForUserDisplay,
  normalizeClueUrl,
  parseCluePlainSegments,
  type CluePlainSegment,
  type ParseCluePlainSegmentsOptions
} from '@/core/recall/clue-plain-url'
