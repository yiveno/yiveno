import { describe, expect, it } from 'vitest'

import { getPopupIdleEmptyCopy, getPopupNoMatchCopy } from '@/core/recall/popup-empty-copy'

describe('popup-empty-copy', () => {
  it('空库 idle 给出 Capture 引导', () => {
    const copy = getPopupIdleEmptyCopy('empty', false)
    expect(copy?.title).toBe('还没有可找回的记忆')
    expect(copy?.showShortenRetry).toBe(false)
    expect(copy?.body).toContain('书签')
  })

  it('有库 idle 不展示空态块', () => {
    expect(getPopupIdleEmptyCopy('ready', false)).toBeNull()
  })

  it('空库 no_match 不引导换词为主', () => {
    const copy = getPopupNoMatchCopy({
      library: 'empty',
      clue: '留存',
      canShorten: true
    })
    expect(copy.title).toBe('记忆库还是空的')
    expect(copy.showShortenRetry).toBe(false)
    expect(copy.body).toContain('换词暂时帮不上忙')
  })

  it('有库 no_match 可缩短再试', () => {
    const copy = getPopupNoMatchCopy({
      library: 'ready',
      clue: '留存分析很长的线索',
      canShorten: true
    })
    expect(copy.title).toContain('没找到')
    expect(copy.showShortenRetry).toBe(true)
  })
})
