import { describe, expect, it } from 'vitest'

import { shouldToastSpeechSilenceStop } from '@/pages/sidepanel/use-composer-speech-dictation'

describe('shouldToastSpeechSilenceStop', () => {
  it('静默停 → 提示', () => {
    expect(shouldToastSpeechSilenceStop(true, 'silence')).toBe(true)
  })

  it('自动提交的静默停 → 不提示（避免「留着」与已发送冲突）', () => {
    expect(shouldToastSpeechSilenceStop(true, 'silence', true)).toBe(false)
  })

  it('手动停 / 取消 → 不提示', () => {
    expect(shouldToastSpeechSilenceStop(true, 'manual')).toBe(false)
    expect(shouldToastSpeechSilenceStop(true, 'cancel')).toBe(false)
  })

  it('非听写结束过渡 → 不提示', () => {
    expect(shouldToastSpeechSilenceStop(false, 'silence')).toBe(false)
    expect(shouldToastSpeechSilenceStop(true, null)).toBe(false)
  })
})
