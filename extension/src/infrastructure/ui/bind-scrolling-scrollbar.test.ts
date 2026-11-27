/**
 * 滚动条 is-scrolling 绑定：scroll 加类，超时移除。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SCROLLING_SCROLLBAR_CLASS,
  SCROLLING_SCROLLBAR_HIDE_MS,
  bindScrollingScrollbarIndicator
} from '@/infrastructure/ui/bind-scrolling-scrollbar'

describe('bindScrollingScrollbarIndicator', () => {
  let unbind: (() => void) | null = null
  let scroller: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    scroller = document.createElement('div')
    document.body.appendChild(scroller)
    unbind = bindScrollingScrollbarIndicator(document)
  })

  afterEach(() => {
    unbind?.()
    unbind = null
    scroller.remove()
    vi.useRealTimers()
  })

  it('scroll 事件给目标加 is-scrolling，超时后移除', () => {
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(scroller.classList.contains(SCROLLING_SCROLLBAR_CLASS)).toBe(true)
    vi.advanceTimersByTime(SCROLLING_SCROLLBAR_HIDE_MS)
    expect(scroller.classList.contains(SCROLLING_SCROLLBAR_CLASS)).toBe(false)
  })

  it('连续 scroll 会重置隐藏计时', () => {
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    vi.advanceTimersByTime(SCROLLING_SCROLLBAR_HIDE_MS - 100)
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    vi.advanceTimersByTime(SCROLLING_SCROLLBAR_HIDE_MS - 100)
    expect(scroller.classList.contains(SCROLLING_SCROLLBAR_CLASS)).toBe(true)
    vi.advanceTimersByTime(100)
    expect(scroller.classList.contains(SCROLLING_SCROLLBAR_CLASS)).toBe(false)
  })
})
