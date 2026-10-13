import { optionalProp } from '@/core/common/optional-props'

/** 选区上下文最大长度（字符）。 */
export const TEXT_EXCERPT_CONTEXT_MAX_LENGTH = 80 as const

/** MemoryItem 选区正文最大长度。 */
export const TEXT_EXCERPT_SELECTED_TEXT_MAX_LENGTH = 10_000 as const

export interface NormalizedTextExcerptSelection {
  selectedText: string
  contextBefore?: string
  contextAfter?: string
}

/** 规范化并截断选区文本。 */
export function normalizeTextExcerptSelection(input: {
  selectedText: string
  contextBefore?: string
  contextAfter?: string
}): NormalizedTextExcerptSelection | null {
  const selectedText = input.selectedText.trim()
  if (!selectedText) {
    return null
  }

  return {
    selectedText: selectedText.slice(0, TEXT_EXCERPT_SELECTED_TEXT_MAX_LENGTH),
    ...optionalProp('contextBefore', trimContextSnippet(input.contextBefore)),
    ...optionalProp('contextAfter', trimContextSnippet(input.contextAfter))
  }
}

function trimContextSnippet(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }
  return trimmed.slice(0, TEXT_EXCERPT_CONTEXT_MAX_LENGTH)
}
