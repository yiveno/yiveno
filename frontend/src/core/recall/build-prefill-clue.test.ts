import { describe, expect, it } from 'vitest'

import {
  buildCaptureSavedPreview,
  buildRecallPrefillClue,
  CAPTURE_SAVED_PREVIEW_SAFETY_MAX,
  RECALL_PREFILL_CLUE_MAX
} from '@/core/recall/build-prefill-clue'

describe('build-prefill-clue', () => {
  it('buildRecallPrefillClue 压缩空白并按业务上限截断', () => {
    expect(buildRecallPrefillClue('  a   b  ')).toBe('a b')
    expect(buildRecallPrefillClue('')).toBeNull()
    expect(buildRecallPrefillClue('   ')).toBeNull()
    const long = '字'.repeat(RECALL_PREFILL_CLUE_MAX + 5)
    const clue = buildRecallPrefillClue(long)
    expect(clue?.endsWith('…')).toBe(true)
    expect(clue?.length).toBe(RECALL_PREFILL_CLUE_MAX)
  })

  it('buildCaptureSavedPreview 中长文保留（CSS line-clamp 负责可见截断）', () => {
    expect(buildCaptureSavedPreview('短句')).toBe('短句')
    const mid = 'a'.repeat(80)
    expect(buildCaptureSavedPreview(mid)).toBe(mid)
  })

  it('buildCaptureSavedPreview 仅病态超长才安全截断', () => {
    const long = 'a'.repeat(CAPTURE_SAVED_PREVIEW_SAFETY_MAX + 3)
    expect(buildCaptureSavedPreview(long).length).toBe(CAPTURE_SAVED_PREVIEW_SAFETY_MAX)
    expect(buildCaptureSavedPreview(long).endsWith('…')).toBe(true)
  })
})
