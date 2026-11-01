/**
 * 听写态电平：AnalyserNode 跟麦克风能量；失败 / 降动态时回退氛围动画。
 * 仅驱动 UI 波形，不参与转写。
 */

import { onUnmounted, ref, watch, type Ref } from 'vue'

import { logger } from '@/infrastructure/logging/logger'

const BAR_COUNT = 9

export type UseVoiceInputMeterResult = {
  /** 0..1 综合电平 */
  level: Ref<number>
  /** 各柱高度比例 0..1（已含相位，可直接绑 height） */
  barLevels: Ref<readonly number[]>
  /** true = 无真实麦电平，用氛围假波形 */
  ambientOnly: Ref<boolean>
}

/**
 * @param active 为 true 时开麦取样；false 时释放
 */
export function useVoiceInputMeter(active: Ref<boolean>): UseVoiceInputMeterResult {
  const level = ref(0)
  const barLevels = ref<readonly number[]>(Array.from({ length: BAR_COUNT }, () => 0.18))
  const ambientOnly = ref(true)

  let stream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let rafId = 0
  let ambientRafId = 0
  let phase = 0
  let startGeneration = 0

  function setBarsFromLevel(nextLevel: number, timeSec: number): void {
    const clamped = Math.min(1, Math.max(0, nextLevel))
    level.value = clamped
    const next: number[] = []
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const wave = 0.5 + 0.5 * Math.sin(timeSec * 6.2 + i * 0.72)
      const midBoost = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2 + 0.01)
      const base = 0.12 + midBoost * 0.1
      const driven = base + clamped * (0.35 + midBoost * 0.45) * (0.55 + wave * 0.45)
      next.push(Math.min(1, Math.max(0.08, driven)))
    }
    barLevels.value = next
  }

  function stopAmbient(): void {
    if (ambientRafId !== 0) {
      cancelAnimationFrame(ambientRafId)
      ambientRafId = 0
    }
  }

  function runAmbient(): void {
    stopAmbient()
    ambientOnly.value = true
    const tick = (now: number) => {
      phase = now / 1000
      // 轻氛围：无麦时仍有起伏，避免「死线」
      const breath = 0.22 + 0.14 * (0.5 + 0.5 * Math.sin(phase * 2.4))
      setBarsFromLevel(breath, phase)
      ambientRafId = requestAnimationFrame(tick)
    }
    ambientRafId = requestAnimationFrame(tick)
  }

  function stopMeterLoop(): void {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  function releaseHardware(): void {
    stopMeterLoop()
    if (analyser) {
      try {
        analyser.disconnect()
      } catch {
        // 已断开
      }
      analyser = null
    }
    if (audioContext) {
      void audioContext.close().catch(() => {
        // 关闭失败可忽略
      })
      audioContext = null
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      stream = null
    }
  }

  function stopAll(): void {
    startGeneration += 1
    releaseHardware()
    stopAmbient()
    level.value = 0
    barLevels.value = Array.from({ length: BAR_COUNT }, () => 0.18)
    ambientOnly.value = true
  }

  function startMeterLoop(): void {
    if (!analyser) {
      return
    }
    const data = new Uint8Array(analyser.fftSize)
    const tick = (now: number) => {
      if (!analyser) {
        return
      }
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i += 1) {
        const sample = ((data[i] ?? 128) - 128) / 128
        sum += sample * sample
      }
      const rms = Math.sqrt(sum / data.length)
      // 说话音量通常偏小，放大后钳位
      const boosted = Math.min(1, rms * 4.2)
      setBarsFromLevel(boosted, now / 1000)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  async function startHardware(generation: number): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      runAmbient()
      return
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })
      if (generation !== startGeneration) {
        for (const track of nextStream.getTracks()) {
          track.stop()
        }
        return
      }
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) {
        for (const track of nextStream.getTracks()) {
          track.stop()
        }
        runAmbient()
        return
      }
      stopAmbient()
      stream = nextStream
      audioContext = new AudioContextCtor()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      if (generation !== startGeneration) {
        releaseHardware()
        return
      }
      const source = audioContext.createMediaStreamSource(stream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)
      ambientOnly.value = false
      startMeterLoop()
      logger.info('SidePanel', '听写电平取样已启动')
    } catch (error) {
      logger.warn('SidePanel', '听写电平取样失败，改用氛围波形', {
        error: error instanceof Error ? error.message : String(error)
      })
      releaseHardware()
      if (generation === startGeneration) {
        runAmbient()
      }
    }
  }

  watch(
    active,
    isActive => {
      if (isActive) {
        startGeneration += 1
        const generation = startGeneration
        runAmbient()
        void startHardware(generation)
        return
      }
      stopAll()
    },
    { immediate: true }
  )

  onUnmounted(() => {
    stopAll()
  })

  return { level, barLevels, ambientOnly }
}
