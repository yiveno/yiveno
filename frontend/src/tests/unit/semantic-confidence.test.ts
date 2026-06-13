import { describe, expect, it } from 'vitest'
import {
  passesSemanticConfidenceGate,
  passesSemanticDistributionGate,
  pickTopScoredWithinBand,
  resolveSemanticMinGap,
  SEMANTIC_CONFIDENCE_MIN_SCORE,
  SEMANTIC_SUPPLEMENT_MIN_GAP
} from '@/core/filter/semantic-confidence'

describe('semantic-confidence', () => {
  it('Top1 未达最低分时拒绝', () => {
    expect(
      passesSemanticConfidenceGate(
        [{ score: 0.73 }, { score: 0.7 }],
        SEMANTIC_CONFIDENCE_MIN_SCORE,
        0.08
      )
    ).toBe(false)
  })

  it('仅 Top1 达分时允许（无合理第二候选）', () => {
    expect(
      passesSemanticConfidenceGate(
        [{ score: 0.85 }, { score: 0.72 }],
        SEMANTIC_CONFIDENCE_MIN_SCORE,
        0.08
      )
    ).toBe(true)
  })

  it('密集高分簇（乱码查询）分布检验不通过', () => {
    expect(
      passesSemanticDistributionGate([{ score: 0.95 }, { score: 0.93 }, { score: 0.91 }])
    ).toBe(false)
  })

  it('e5 实测分布（听歌）Top 相对池均值突出', () => {
    const realisticPool = [
      { score: 0.778 },
      { score: 0.761 },
      { score: 0.742 },
      { score: 0.715 },
      { score: 0.702 },
      { score: 0.698 },
      { score: 0.691 },
      { score: 0.688 },
      { score: 0.685 },
      { score: 0.682 },
      { score: 0.68 },
      { score: 0.68 },
      { score: 0.68 },
      { score: 0.68 },
      { score: 0.68 }
    ]

    expect(passesSemanticDistributionGate(realisticPool)).toBe(true)
    expect(
      passesSemanticConfidenceGate(
        realisticPool,
        SEMANTIC_CONFIDENCE_MIN_SCORE,
        SEMANTIC_SUPPLEMENT_MIN_GAP
      )
    ).toBe(true)
  })

  it('Top1/Top2 均达分但领先不足时拒绝（双候选密集簇）', () => {
    expect(
      passesSemanticConfidenceGate(
        [{ score: 0.92 }, { score: 0.9 }],
        SEMANTIC_CONFIDENCE_MIN_SCORE,
        SEMANTIC_SUPPLEMENT_MIN_GAP
      )
    ).toBe(false)
  })

  it('Top1 明显领先时通过', () => {
    expect(
      passesSemanticConfidenceGate(
        [{ score: 0.94 }, { score: 0.82 }],
        SEMANTIC_CONFIDENCE_MIN_SCORE,
        SEMANTIC_SUPPLEMENT_MIN_GAP
      )
    ).toBe(true)
  })

  it('小库缩放领先幅度要求', () => {
    expect(resolveSemanticMinGap(15, 0.08)).toBe(0.03)
    expect(resolveSemanticMinGap(50, 0.08)).toBe(0.05)
  })

  it('pickTopScoredWithinBand 仅保留置信簇内条目', () => {
    const picked = pickTopScoredWithinBand(
      [{ score: 0.91 }, { score: 0.84 }, { score: 0.83 }],
      SEMANTIC_CONFIDENCE_MIN_SCORE,
      0.05,
      2
    )

    expect(picked.map(item => item.score)).toEqual([0.91])
  })
})
