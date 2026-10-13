import { describe, expect, it } from 'vitest'

import { interpretKeyboardCommand } from '@/core/ui/keyboard-command'

describe('keyboard-command', () => {
  it('方向键与回车映射为通用意图', () => {
    expect(interpretKeyboardCommand({ key: 'ArrowDown' })).toEqual({
      type: 'navigate',
      direction: 'down'
    })
    expect(interpretKeyboardCommand({ key: 'ArrowUp' })).toEqual({
      type: 'navigate',
      direction: 'up'
    })
    expect(interpretKeyboardCommand({ key: 'ArrowLeft' })).toEqual({
      type: 'navigate',
      direction: 'left'
    })
    expect(interpretKeyboardCommand({ key: 'ArrowRight' })).toEqual({
      type: 'navigate',
      direction: 'right'
    })
    expect(interpretKeyboardCommand({ key: 'Enter' })).toEqual({ type: 'confirm' })
  })

  it('IME / 修饰键 Enter / 其它键为 none', () => {
    expect(interpretKeyboardCommand({ key: 'Enter', metaKey: true })).toEqual({ type: 'none' })
    expect(interpretKeyboardCommand({ key: 'Enter', isComposing: true })).toEqual({ type: 'none' })
    expect(interpretKeyboardCommand({ key: 'a' })).toEqual({ type: 'none' })
  })
})
