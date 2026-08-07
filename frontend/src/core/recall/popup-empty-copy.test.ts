import { describe, expect, it } from 'vitest'

import { testTranslateZh } from '@/core/i18n/test-translate-zh'
import { getPopupIdleEmptyCopy, getPopupNoMatchCopy } from '@/core/recall/popup-empty-copy'

describe('popup-empty-copy', () => {
  it('空库 idle 给出 Capture 引导', () => {
    const copy = getPopupIdleEmptyCopy('empty', false, testTranslateZh)
    expect(copy?.title).toBe('你想找什么？')
    expect(copy?.showShortenRetry).toBe(false)
    expect(copy?.body).toContain('划')
  })

  it('有库 idle 不展示空态块', () => {
    expect(getPopupIdleEmptyCopy('ready', false, testTranslateZh)).toBeNull()
  })

  it('空库 no_match 不引导换词为主', () => {
    const copy = getPopupNoMatchCopy(
      {
        library: 'empty',
        clue: '留存',
        canShorten: true
      },
      testTranslateZh
    )
    expect(copy.title).toBe('还没有保存的内容')
    expect(copy.showShortenRetry).toBe(false)
    expect(copy.body).toContain('线索')
  })

  it('有库 no_match 可缩短再试', () => {
    const copy = getPopupNoMatchCopy(
      {
        library: 'ready',
        clue: '留存分析很长的线索',
        canShorten: true
      },
      testTranslateZh
    )
    expect(copy.title).toContain('没找到')
    expect(copy.showShortenRetry).toBe(true)
  })
})
