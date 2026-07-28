import { describe, expect, it } from 'vitest'

import {
  buildCaptureSavedPreview,
  buildRecallPrefillClue,
  CAPTURE_SAVED_PREVIEW_MAX,
  RECALL_PREFILL_CLUE_MAX
} from '@/core/recall/build-prefill-clue'

describe('build-prefill-clue', () => {
  it('buildRecallPrefillClue 压缩空白并截断', () => {
    expect(buildRecallPrefillClue('  a   b  ')).toBe('a b')
    expect(buildRecallPrefillClue('')).toBeNull()
    expect(buildRecallPrefillClue('   ')).toBeNull()
    const long = '字'.repeat(RECALL_PREFILL_CLUE_MAX + 5)
    const clue = buildRecallPrefillClue(long)
    expect(clue?.endsWith('…')).toBe(true)
    expect(clue?.length).toBe(RECALL_PREFILL_CLUE_MAX)
  })

  it('buildCaptureSavedPreview 截断预览', () => {
    expect(buildCaptureSavedPreview('短句')).toBe('短句')
    const long = 'a'.repeat(CAPTURE_SAVED_PREVIEW_MAX + 3)
    expect(buildCaptureSavedPreview(long).length).toBe(CAPTURE_SAVED_PREVIEW_MAX)
  })
})
