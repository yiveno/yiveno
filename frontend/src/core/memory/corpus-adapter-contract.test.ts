import { describe, expect, it } from 'vitest'

import {
  BuiltinCorpusSourceSchema,
  CorpusAdapterStageSchema,
  CorpusQualityGateDecisionSchema,
  THIRD_PARTY_CORPUS_ADMISSION_CHECKS
} from '@/core/memory/corpus-adapter-contract'

describe('corpus-adapter-contract', () => {
  it('内建源仅摘录与书签', () => {
    expect(BuiltinCorpusSourceSchema.options).toEqual(['text_excerpt', 'bookmark'])
  })

  it('质量门禁三态齐全', () => {
    expect(CorpusQualityGateDecisionSchema.options).toEqual(['accept', 'weak', 'reject'])
  })

  it('管道阶段口径齐全', () => {
    expect(CorpusAdapterStageSchema.options).toEqual(['auth', 'fetch', 'map', 'gate', 'write'])
  })

  it('第三方准入清单覆盖命题/门禁/主链/边界', () => {
    expect(THIRD_PARTY_CORPUS_ADMISSION_CHECKS).toEqual(
      expect.arrayContaining([
        'proposition_before_after_recall',
        'quality_gate_min_anchor',
        'same_recall_pipeline',
        'not_notes_product',
        'acceptance_must_or_manual'
      ])
    )
    expect(THIRD_PARTY_CORPUS_ADMISSION_CHECKS).toHaveLength(10)
  })
})
