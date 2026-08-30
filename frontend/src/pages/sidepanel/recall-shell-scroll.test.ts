import { describe, expect, it, vi } from 'vitest'

import {
  createRecallShellScrollListener,
  isRecallShellNearBottom,
  scheduleRecallShellScrollToBottom
} from '@/pages/sidepanel/recall-shell-scroll'

describe('recall-shell-scroll', () => {
  it('isRecallShellNearBottom 在距底 threshold 内为 true', () => {
    const element = {
      scrollHeight: 1000,
      scrollTop: 850,
      clientHeight: 100
    } as HTMLElement
    expect(isRecallShellNearBottom(element, 96)).toBe(true)
    expect(isRecallShellNearBottom(element, 40)).toBe(false)
  })

  it('createRecallShellScrollListener 合并 scroll 到 rAF', () => {
    const callbacks: FrameRequestCallback[] = []
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback)
      return callbacks.length
    })

    const onStick = vi.fn()
    const listener = createRecallShellScrollListener(onStick)
    const element = document.createElement('div')
    Object.defineProperty(element, 'scrollHeight', { value: 500 })
    Object.defineProperty(element, 'scrollTop', { value: 450 })
    Object.defineProperty(element, 'clientHeight', { value: 100 })

    listener({ target: element } as Event)
    listener({ target: element } as Event)

    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(0)
    expect(onStick).toHaveBeenCalledTimes(1)
    expect(onStick).toHaveBeenCalledWith(true)

    raf.mockRestore()
  })

  it('scheduleRecallShellScrollToBottom 仅在黏底时滚到底', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0)
      return 1
    })

    const element = document.createElement('div')
    Object.defineProperty(element, 'scrollHeight', {
      value: 800,
      writable: true,
      configurable: true
    })
    Object.defineProperty(element, 'scrollTop', { value: 0, writable: true, configurable: true })
    Object.defineProperty(element, 'clientHeight', { value: 200 })

    scheduleRecallShellScrollToBottom(
      () => element,
      () => false
    )
    expect(element.scrollTop).toBe(0)

    scheduleRecallShellScrollToBottom(
      () => element,
      () => true
    )
    expect(element.scrollTop).toBe(800)
  })
})
