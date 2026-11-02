import { describe, expect, it, vi } from 'vitest'

import {
  createRecallShellScrollListener,
  isRecallShellNearBottom,
  isRecallShellNearTop,
  readRecallShellScrollState,
  resolveRecallShellScrollJumpDirection,
  scheduleRecallShellScrollChildToStart,
  scheduleRecallShellScrollToBottom,
  scrollRecallShellChildToStart,
  scrollRecallShellToBottom,
  scrollRecallShellToTop
} from '@/pages/sidepanel/recall-shell-scroll'

describe('recall-shell-scroll', () => {
  it('readRecallShellScrollState 区分贴顶 / 贴底 / 可滚', () => {
    const mid = {
      scrollHeight: 1000,
      scrollTop: 400,
      clientHeight: 200
    }
    expect(readRecallShellScrollState(mid, 96)).toEqual({
      nearTop: false,
      nearBottom: false,
      canScroll: true
    })

    const nearBottom = {
      scrollHeight: 1000,
      scrollTop: 850,
      clientHeight: 100
    }
    expect(isRecallShellNearBottom(nearBottom, 96)).toBe(true)
    expect(isRecallShellNearBottom(nearBottom, 40)).toBe(false)

    const nearTop = {
      scrollHeight: 1000,
      scrollTop: 20,
      clientHeight: 200
    }
    expect(isRecallShellNearTop(nearTop, 96)).toBe(true)
    expect(isRecallShellNearTop(nearTop, 10)).toBe(false)

    const short = {
      scrollHeight: 100,
      scrollTop: 0,
      clientHeight: 200
    }
    expect(readRecallShellScrollState(short)).toEqual({
      nearTop: true,
      nearBottom: true,
      canScroll: false
    })
  })

  it('createRecallShellScrollListener 合并 scroll 到 rAF 并上报完整态', () => {
    const callbacks: FrameRequestCallback[] = []
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback)
      return callbacks.length
    })

    const onState = vi.fn()
    const listener = createRecallShellScrollListener(onState)
    const element = document.createElement('div')
    Object.defineProperty(element, 'scrollHeight', { value: 500 })
    Object.defineProperty(element, 'scrollTop', { value: 450 })
    Object.defineProperty(element, 'clientHeight', { value: 100 })

    listener({ target: element } as unknown as Event)
    listener({ target: element } as unknown as Event)

    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(0)
    expect(onState).toHaveBeenCalledTimes(1)
    expect(onState).toHaveBeenCalledWith({
      nearTop: false,
      nearBottom: true,
      canScroll: true
    })

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

  it('resolveRecallShellScrollJumpDirection 未贴底优先 down、贴底 up', () => {
    expect(
      resolveRecallShellScrollJumpDirection({
        nearTop: true,
        nearBottom: false,
        canScroll: true
      })
    ).toBe('down')
    expect(
      resolveRecallShellScrollJumpDirection({
        nearTop: false,
        nearBottom: false,
        canScroll: true
      })
    ).toBe('down')
    expect(
      resolveRecallShellScrollJumpDirection({
        nearTop: false,
        nearBottom: true,
        canScroll: true
      })
    ).toBe('up')
    expect(
      resolveRecallShellScrollJumpDirection({
        nearTop: true,
        nearBottom: true,
        canScroll: false
      })
    ).toBeNull()
  })

  it('scrollRecallShellToTop / ToBottom 直接写 scrollTop', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'scrollHeight', { value: 900, configurable: true })
    Object.defineProperty(element, 'scrollTop', { value: 300, writable: true, configurable: true })

    scrollRecallShellToTop(element)
    expect(element.scrollTop).toBe(0)

    scrollRecallShellToBottom(element)
    expect(element.scrollTop).toBe(900)

    scrollRecallShellToTop(null)
    scrollRecallShellToBottom(null)
  })

  it('scrollRecallShellChildToStart 把子元素对齐到容器顶（含 offset）', () => {
    const scrollElement = document.createElement('div')
    const child = document.createElement('div')
    Object.defineProperty(scrollElement, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(scrollElement, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(scrollElement, 'scrollTop', {
      value: 100,
      writable: true,
      configurable: true
    })
    scrollElement.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
    child.getBoundingClientRect = () =>
      ({
        top: 80,
        bottom: 160,
        left: 0,
        right: 100,
        width: 100,
        height: 80,
        x: 0,
        y: 80,
        toJSON: () => ({})
      }) as DOMRect

    scrollRecallShellChildToStart(scrollElement, child, 8)
    // delta = 80 - 0 - 8 = 72 → scrollTop 100+72=172
    expect(scrollElement.scrollTop).toBe(172)

    scrollRecallShellChildToStart(null, child)
    scrollRecallShellChildToStart(scrollElement, null)
  })

  it('scheduleRecallShellScrollChildToStart 仅在 shouldRun 时对齐', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0)
      return 1
    })

    const scrollElement = document.createElement('div')
    const child = document.createElement('div')
    Object.defineProperty(scrollElement, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(scrollElement, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(scrollElement, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true
    })
    scrollElement.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
    child.getBoundingClientRect = () =>
      ({
        top: 40,
        bottom: 120,
        left: 0,
        right: 100,
        width: 100,
        height: 80,
        x: 0,
        y: 40,
        toJSON: () => ({})
      }) as DOMRect

    scheduleRecallShellScrollChildToStart(
      () => scrollElement,
      () => child,
      () => false
    )
    expect(scrollElement.scrollTop).toBe(0)

    scheduleRecallShellScrollChildToStart(
      () => scrollElement,
      () => child,
      () => true,
      0
    )
    expect(scrollElement.scrollTop).toBe(40)
  })

  it('scheduleRecallShellScrollChildToStart 子节点晚到时会重试', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback)
      return callbacks.length
    })

    const scrollElement = document.createElement('div')
    const child = document.createElement('div')
    Object.defineProperty(scrollElement, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(scrollElement, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(scrollElement, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true
    })
    scrollElement.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
    child.getBoundingClientRect = () =>
      ({
        top: 50,
        bottom: 130,
        left: 0,
        right: 100,
        width: 100,
        height: 80,
        x: 0,
        y: 50,
        toJSON: () => ({})
      }) as DOMRect

    let ready = false
    scheduleRecallShellScrollChildToStart(
      () => scrollElement,
      () => (ready ? child : null),
      () => true,
      0,
      3
    )

    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(0)
    expect(scrollElement.scrollTop).toBe(0)
    expect(callbacks).toHaveLength(2)

    ready = true
    callbacks[1]?.(0)
    expect(scrollElement.scrollTop).toBe(50)
  })
})
