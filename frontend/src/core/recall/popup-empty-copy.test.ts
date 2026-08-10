import { describe, expect, it } from 'vitest'

import { testTranslateZh } from '@/core/i18n/test-translate-zh'
import { getPopupIdleEmptyCopy, getPopupNoMatchCopy } from '@/core/recall/popup-empty-copy'

/** 冷启动文案不得出现的助理 / 跑题措辞。 */
const FORBIDDEN = /了解你|喜欢什么类型|我会记住|全能|助手|帮你决定|随便聊聊/

describe('popup-empty-copy', () => {
  it('空库 idle：先存痕迹，再找回', () => {
    const copy = getPopupIdleEmptyCopy('empty', false, testTranslateZh)
    expect(copy?.title).toBe('先留下一点痕迹')
    expect(copy?.showShortenRetry).toBe(false)
    expect(copy?.body).toMatch(/划|选区/)
    expect(copy?.body).toMatch(/找/)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('空库导入中 idle：可并行划存', () => {
    const copy = getPopupIdleEmptyCopy('empty', true, testTranslateZh)
    expect(copy?.title).toBe('先留下一点痕迹')
    expect(copy?.body).toMatch(/导入/)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('有库 idle 不展示空态块（欢迎文案由 Popup 回落 welcome keys）', () => {
    expect(getPopupIdleEmptyCopy('ready', false, testTranslateZh)).toBeNull()
  })

  it('空库 no_match：诚实无痕迹 + Capture，非换词为主', () => {
    const copy = getPopupNoMatchCopy(
      {
        library: 'empty',
        clue: '我以前最喜欢听的歌',
        canShorten: true
      },
      testTranslateZh
    )
    expect(copy.title).toBe('还没有保存的内容')
    expect(copy.showShortenRetry).toBe(false)
    expect(copy.body).toMatch(/痕迹|摘录|备注/)
    expect(copy.body).not.toMatch(FORBIDDEN)
  })

  it('有库 no_match：导向补线索或划存，非助理人设', () => {
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
    expect(copy.body).toMatch(/痕迹|划存|备注/)
    expect(copy.body).not.toMatch(FORBIDDEN)
  })

  it('R1 冷启动文案矩阵：欢迎语仍是找东西，不是助理', () => {
    expect(testTranslateZh('popup_welcome_title')).toBe('你想找什么？')
    expect(testTranslateZh('popup_welcome_body')).toMatch(/存过|找回/)
    expect(testTranslateZh('popup_welcome_body')).not.toMatch(FORBIDDEN)
  })
})
