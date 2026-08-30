import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dismissToast,
  resetAppToastStateForTests,
  showAppToast,
  useAppToast
} from '@/infrastructure/ui/use-app-toast'

describe('useAppToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAppToastStateForTests()
  })

  afterEach(() => {
    resetAppToastStateForTests()
    vi.useRealTimers()
  })

  it('展示 success toast 并在默认时长后自动消失', () => {
    const { toasts, success } = useAppToast()
    success('Copied to clipboard')

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]?.tone).toBe('success')
    expect(toasts.value[0]?.message).toBe('Copied to clipboard')

    vi.advanceTimersByTime(3200)
    expect(toasts.value).toHaveLength(0)
  })

  it('空文案不展示', () => {
    const { toasts } = useAppToast()
    const id = showAppToast({ tone: 'info', message: '   ' })
    expect(id).toBe(-1)
    expect(toasts.value).toHaveLength(0)
  })

  it('手动 dismiss 会清掉定时器', () => {
    const { toasts } = useAppToast()
    const id = showAppToast({ tone: 'error', message: 'Failed' })
    dismissToast(id)
    expect(toasts.value).toHaveLength(0)

    vi.advanceTimersByTime(5000)
    expect(toasts.value).toHaveLength(0)
  })

  it('warning tone 可入队', () => {
    const { toasts, warning } = useAppToast()
    warning('Sync paused')

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]?.tone).toBe('warning')
    expect(toasts.value[0]?.message).toBe('Sync paused')
  })

  it('最多保留 3 条可见 toast', () => {
    const { toasts } = useAppToast()
    showAppToast({ tone: 'info', message: 'one' })
    showAppToast({ tone: 'info', message: 'two' })
    showAppToast({ tone: 'info', message: 'three' })
    showAppToast({ tone: 'info', message: 'four' })

    expect(toasts.value.map(item => item.message)).toEqual(['two', 'three', 'four'])
  })
})
