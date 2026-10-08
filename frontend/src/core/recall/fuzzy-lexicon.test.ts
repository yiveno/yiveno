import { describe, expect, it } from 'vitest'
import { getFuzzyVariants, fuzzyExpandQuery } from '@/core/recall/fuzzy-lexicon'

describe('fuzzy-lexicon', () => {
  describe('getFuzzyVariants', () => {
    it('原始 query 在结果首位（归一化后）', () => {
      const variants = getFuzzyVariants('React hooks', 8)
      expect(variants[0]).toBe('react hooks')
    })

    it('js → javascript 展开', () => {
      const variants = getFuzzyVariants('js tutorial', 8)
      expect(variants).toContain('javascript tutorial')
    })

    it('ts → typescript 展开', () => {
      const variants = getFuzzyVariants('ts config', 8)
      expect(variants).toContain('typescript config')
    })

    it('fe → frontend 展开', () => {
      const variants = getFuzzyVariants('fe framework', 8)
      expect(variants).toContain('frontend framework')
    })

    it('recat → react 展开（技术词 typo 纠错）', () => {
      const variants = getFuzzyVariants('recat tutorial', 8)
      expect(variants).toContain('react tutorial')
    })

    it('大小写归一化：React Hooks → JS 展开', () => {
      const variants = getFuzzyVariants('JS FRAMEWORK', 8)
      expect(variants).toContain('javascript framework')
    })

    it('无映射 token 保持不变', () => {
      const variants = getFuzzyVariants('foobar', 8)
      expect(variants).toContain('foobar')
    })

    it('超过 maxExpand 限制取前 N 条', () => {
      // js tutorial 两 token，各自有映射
      const variants = getFuzzyVariants('js ts', 2)
      expect(variants.length).toBeLessThanOrEqual(3) // 原始 + ≤2 展开
    })

    it('去重：相同展开结果不重复', () => {
      // js → javascript，ts → typescript；但两者可能展开相同
      const variants = getFuzzyVariants('js tutorial', 8)
      const unique = new Set(variants)
      expect(variants.length).toBe(unique.size)
    })
  })

  describe('fuzzyExpandQuery', () => {
    it('单 token 展开为规范形式', () => {
      const result = fuzzyExpandQuery('js', 8)
      expect(result).toContain('javascript')
    })

    it('两 token 短 query 生成多组合', () => {
      const result = fuzzyExpandQuery('js tutorial', 8)
      expect(result.some(v => v.includes('javascript'))).toBe(true)
    })

    it('三 token 以上仅返回归一化，不做组合爆炸', () => {
      const result = fuzzyExpandQuery('js typescript react tutorial', 8)
      expect(result).toHaveLength(1)
    })

    it('空 query 返回空', () => {
      expect(fuzzyExpandQuery('', 8)).toEqual([])
    })
  })
})
