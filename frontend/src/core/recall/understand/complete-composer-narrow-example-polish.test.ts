import { describe, expect, it, vi } from 'vitest'

import { completeComposerNarrowExamplePolishWithLlm } from '@/core/recall/understand/complete-composer-narrow-example-polish'

describe('completeComposerNarrowExamplePolishWithLlm', () => {
  it('门禁通过后返回润色展示串', async () => {
    const complete = vi.fn(async () => JSON.stringify({ examples: ['Eloquent JavaScript', 'MDN'] }))
    const gated = await completeComposerNarrowExamplePolishWithLlm({
      selectedExamples: ['eloquentjavascript', 'mdn'],
      candidateTextPreviews: ['Eloquent JavaScript · eloquentjavascript.net', 'MDN Web Docs'],
      candidateCorpusTexts: ['Eloquent JavaScript', 'MDN Web Docs'],
      complete
    })
    expect(gated).toEqual(['Eloquent JavaScript', 'MDN'])
    expect(complete).toHaveBeenCalledOnce()
  })

  it('造词被门禁打回选定原词', async () => {
    const complete = vi.fn(async () => JSON.stringify({ examples: ['frontend', 'react'] }))
    const gated = await completeComposerNarrowExamplePolishWithLlm({
      selectedExamples: ['history', 'mdn'],
      candidateCorpusTexts: ['JavaScript history', 'MDN'],
      complete
    })
    expect(gated).toEqual(['history', 'mdn'])
  })

  it('空选定直接返回空数组且不调 completer', async () => {
    const complete = vi.fn(async () => '{"examples":[]}')
    await expect(
      completeComposerNarrowExamplePolishWithLlm({
        selectedExamples: ['  ', ''],
        complete
      })
    ).resolves.toEqual([])
    expect(complete).not.toHaveBeenCalled()
  })
})
