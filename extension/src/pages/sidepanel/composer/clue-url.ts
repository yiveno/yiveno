/**
 * Composer / Side Panel 入口：re-export core 纯文本 URL 工具 + 展示标签。
 * 实现权威在 `@/core/recall/clue-plain-url` 与 `clue-url-display`。
 */

export {
  CLUE_URL_DISPLAY_MAX_CHARS,
  clueUrlLookupKey,
  formatClueUrlDisplayLabel,
  formatClueUrlResolvedTitle,
  resolveClueUrlChipLabel
} from '@/core/recall/clue-url-display'

export {
  formatCluePlainForUserDisplay,
  formatSavedTitleForUserDisplay,
  isClueUrlBoundaryChar,
  normalizeClueUrl,
  parseCluePlainSegments,
  peelTrailingNonUrlBody,
  serializeClueSegmentsToPlain,
  type CluePlainSegment,
  type ParseCluePlainSegmentsOptions
} from '@/core/recall/clue-plain-url'
