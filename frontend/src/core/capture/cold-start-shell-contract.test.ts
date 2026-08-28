/**
 * §5.8 冷启动 Recall 壳契约（自动化 must）。
 * 手工真机步骤仍见产品文档 §5.8 A/B/C；此处锁文案与 Capture-first 闸门。
 */
import { describe, expect, it } from 'vitest'

import {
  shouldOpenGettingStartedOnInstall,
  shouldShowCaptureFirstRecallShell
} from '@/core/capture/install-onboarding'
import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  getRecallShellIdleEmptyCopy,
  getRecallShellNoMatchCopy
} from '@/core/recall/recall-shell-empty-copy'

/** §5.8 A：禁止助理人设 / 偏好建档 / 缺槽问卷口吻。 */
const FORBIDDEN_ASSISTANT_TONE =
  /get to know you|what you like|i['’]ll remember|assistant|decide for you|chat casually|tell me what you prefer/i

/** §5.8 A：空库 no_match 禁止追问芯片式补救（缩短再试等）。 */
const FORBIDDEN_NO_MATCH_RESCUE = /shorten|retry with a shorter|try a different query/i

function allColdStartCopyStrings(): string[] {
  const idleVariants = [
    getRecallShellIdleEmptyCopy('empty', false, testTranslateEn),
    getRecallShellIdleEmptyCopy('empty', true, testTranslateEn),
    getRecallShellIdleEmptyCopy('ready', false, testTranslateEn, { captureFirst: true }),
    getRecallShellIdleEmptyCopy('ready', true, testTranslateEn, { captureFirst: true })
  ].filter((copy): copy is NonNullable<typeof copy> => copy !== null)

  const noMatchVariants = [
    getRecallShellNoMatchCopy(
      { library: 'empty', clue: 'the song I used to love' },
      testTranslateEn
    ),
    getRecallShellNoMatchCopy({ library: 'ready', clue: 'poem I saved yesterday' }, testTranslateEn)
  ]

  const welcome = [testTranslateEn('popup_welcome_title'), testTranslateEn('popup_welcome_body')]

  return [
    ...idleVariants.flatMap(copy => [copy.title, copy.body]),
    ...noMatchVariants.flatMap(copy => [copy.title, copy.body]),
    ...welcome
  ]
}

describe('cold-start-shell-contract §5.8', () => {
  it('must：全部冷启动壳文案无助理人设 / 偏好建档口吻', () => {
    for (const text of allColdStartCopyStrings()) {
      expect(text, text).not.toMatch(FORBIDDEN_ASSISTANT_TONE)
    }
  })

  it('must：空库 no_match 诚实终局，无缩短再试类补救', () => {
    const copy = getRecallShellNoMatchCopy(
      { library: 'empty', clue: 'the song I used to love' },
      testTranslateEn
    )
    expect(copy.title).toBe('Nothing saved yet')
    expect(copy.body).toMatch(/trace|excerpt|note/i)
    expect(`${copy.title} ${copy.body}`).not.toMatch(FORBIDDEN_NO_MATCH_RESCUE)
  })

  it('must：Capture-first 闸门与空态文案一致（§5.8 安装引导）', () => {
    const showCaptureFirst = shouldShowCaptureFirstRecallShell({
      excerptCaptureCount: 0,
      installOnboardingDone: false
    })
    expect(showCaptureFirst).toBe(true)

    const copy = getRecallShellIdleEmptyCopy('ready', false, testTranslateEn, {
      captureFirst: showCaptureFirst
    })
    expect(copy?.title).toBe('Save a line first')
    expect(copy?.body).toMatch(/getting started|highlight/i)
  })

  it('must：install 才打开 Getting Started，update 不自动打开', () => {
    expect(shouldOpenGettingStartedOnInstall('install')).toBe(true)
    expect(shouldOpenGettingStartedOnInstall('update')).toBe(false)
  })

  it('must：有摘录或引导完成后不再 Capture-first', () => {
    expect(
      shouldShowCaptureFirstRecallShell({ excerptCaptureCount: 1, installOnboardingDone: false })
    ).toBe(false)
    expect(
      shouldShowCaptureFirstRecallShell({ excerptCaptureCount: 0, installOnboardingDone: true })
    ).toBe(false)
  })
})
