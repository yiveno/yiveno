/**
 * P0-1（Recall Correctness）回归：hyphen / underscore 形态变体召回。
 *
 * 修复前：「react-native」作为单一 token，与条目 compact 后「reactnative」/「react native」
 * 互不 substring 命中 → CONFIRMED 0 match。
 *
 * 修复后：query「react-native」通过 `splitHyphenUnderscoreVariants` 同时生成
 * 「react」「native」「reactnative」「react native」四个 term，与「React Native docs」条目
 * 正常召回。
 */
import { describe, expect, it } from 'vitest'
import {
  compactRecallText,
  filterMemoryItemsByKeyword,
  splitHyphenUnderscoreVariants,
  tokenizeRecallClueDetailed
} from '@/core/recall/keyword-filter'
import { extractDocumentIndexTokens } from '@/core/recall/extract-document-index-tokens'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'

const fixedNow = (): string => '2026-07-22T06:00:00.000Z'

describe('splitHyphenUnderscoreVariants', () => {
  it('无 hyphen / underscore 时不产生变体', () => {
    expect(splitHyphenUnderscoreVariants('react')).toEqual([])
    expect(splitHyphenUnderscoreVariants('')).toEqual([])
  })

  it('ASCII 词字符之间折 hyphen 为空格', () => {
    expect(splitHyphenUnderscoreVariants('react-native')).toEqual(['react native', 'reactnative'])
  })

  it('ASCII 词字符之间折 underscore 为空格', () => {
    expect(splitHyphenUnderscoreVariants('css_grid')).toEqual(['css grid', 'cssgrid'])
  })

  it('混合 hyphen 与 underscore', () => {
    expect(splitHyphenUnderscoreVariants('react-native_mvc')).toEqual([
      'react native mvc',
      'reactnativemvc'
    ])
  })

  it('host 形式（含点的段）保留 URL 边界', () => {
    // host 段含点（.dev）→ '.' 邻接 '-'：不折为空白
    // spaced form: "www.react native.dev"（保留 .dev 边界）
    // compact form: "www.reactnative.dev"（保留 .dev 边界）
    const variants = splitHyphenUnderscoreVariants('www.react-native.dev')
    expect(variants).toContain('www.react native.dev')
    expect(variants).toContain('www.reactnative.dev')
  })

  it('起始 / 末尾 hyphen 不动', () => {
    expect(splitHyphenUnderscoreVariants('-leading')).toEqual([])
    expect(splitHyphenUnderscoreVariants('trailing-')).toEqual([])
  })

  it('CJK 在一侧时不参与折（避免破坏中文术语）', () => {
    // '白'(CJK) 在 '-' 左侧：不是 ASCII alnum → 不折
    expect(splitHyphenUnderscoreVariants('李白-poem')).toEqual([])
    // 'p'(ASCII) 在 '-' 右侧：但 '白' 在 '-' 左侧 → 整体不折
    expect(splitHyphenUnderscoreVariants('poem-李白')).toEqual([])
  })
})

describe('tokenizeRecallClueDetailed 含 hyphen', () => {
  it('「react-native」拆分得 react + native + 形态变体', () => {
    const tokens = tokenizeRecallClueDetailed('react-native').map(t => t.token)
    expect(tokens).toContain('react')
    expect(tokens).toContain('native')
    expect(tokens).toContain('react-native') // 保留原 term（向后兼容）
    expect(tokens).toContain('reactnative')
    expect(tokens).toContain('react native')
  })

  it('「css_grid」拆分得 css + grid + 形态变体', () => {
    const tokens = tokenizeRecallClueDetailed('css_grid').map(t => t.token)
    expect(tokens).toContain('css')
    expect(tokens).toContain('grid')
    expect(tokens).toContain('css_grid')
    expect(tokens).toContain('cssgrid')
    expect(tokens).toContain('css grid')
  })
})

describe('recall 召回：hyphen / underscore 形态对齐', () => {
  it('CONFIRMED FIX: 「react-native」召回「React Native docs」', () => {
    const reactNative = createBookmarkMemoryItem({
      ownerId: '11111111-1111-4111-8111-111111111111',
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      now: fixedNow,
      payload: {
        title: 'React Native docs',
        url: 'https://reactnative.dev/'
      }
    })
    const matches = filterMemoryItemsByKeyword([reactNative], 'react-native', { minScore: 1 })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]?.item.id).toBe(reactNative.id)
  })

  it('「css_grid」召回「CSS Grid Layout」', () => {
    const cssGrid = createBookmarkMemoryItem({
      ownerId: '11111111-1111-4111-8111-111111111111',
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      now: fixedNow,
      payload: {
        title: 'CSS Grid Layout',
        url: 'https://css-tricks.com/snippets/css/complete-guide-grid/'
      }
    })
    const matches = filterMemoryItemsByKeyword([cssGrid], 'css_grid', { minScore: 1 })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]?.item.id).toBe(cssGrid.id)
  })

  it('「next-js」召回「Next.js App Router」', () => {
    const nextjs = createBookmarkMemoryItem({
      ownerId: '11111111-1111-4111-8111-111111111111',
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      now: fixedNow,
      payload: {
        title: 'Next.js App Router',
        url: 'https://nextjs.org/docs/app'
      }
    })
    const matches = filterMemoryItemsByKeyword([nextjs], 'next-js', { minScore: 1 })
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]?.item.id).toBe(nextjs.id)
  })

  it('倒排索引写入 hyphen 形态变体：query「reactnative」命中条目 compact 后「reactnative」', () => {
    const reactNative = createBookmarkMemoryItem({
      ownerId: '11111111-1111-4111-8111-111111111111',
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      now: fixedNow,
      payload: {
        title: 'React Native docs',
        url: 'https://reactnative.dev/'
      }
    })
    const tokens = extractDocumentIndexTokens(reactNative)
    expect(tokens).toContain('react')
    expect(tokens).toContain('native')
    expect(tokens).toContain('reactnative') // compact 后的形态进入倒排
  })
})

describe('compactRecallText 行为保持', () => {
  it('不变：仅抹空白', () => {
    expect(compactRecallText('React Native')).toBe('reactnative')
    expect(compactRecallText('react-native')).toBe('react-native')
    expect(compactRecallText('react_native')).toBe('react_native')
  })
})
