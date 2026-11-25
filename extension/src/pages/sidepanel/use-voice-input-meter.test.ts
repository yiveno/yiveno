import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

describe('useVoiceInputMeter', () => {
  it('听写中静音电平仍持续更新柱高（等待录入起伏）', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: undefined
    })
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(performance.now()), 16) as unknown as number
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id)
    })

    const { useVoiceInputMeter } = await import('@/pages/sidepanel/use-voice-input-meter')
    const active = ref(true)
    const meter = useVoiceInputMeter(active)
    await nextTick()
    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })

    const first = [...meter.barLevels.value]
    await new Promise(resolve => {
      setTimeout(resolve, 80)
    })
    const second = [...meter.barLevels.value]

    expect(meter.ambientOnly.value).toBe(true)
    expect(first).toHaveLength(9)
    expect(second).toHaveLength(9)
    expect(second.some((v, i) => v !== first[i])).toBe(true)

    active.value = false
  })
})
