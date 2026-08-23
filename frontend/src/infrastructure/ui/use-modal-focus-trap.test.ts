import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bindModalFocusTrap,
  getFocusableElements,
  handleTabTrap,
  resetModalFocusStateForTest,
  restoreFocus
} from '@/infrastructure/ui/use-modal-focus-trap'

describe('use-modal-focus-trap', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetModalFocusStateForTest()
  })

  afterEach(() => {
    resetModalFocusStateForTest()
  })

  it('getFocusableElements 收集 button 与 textarea', () => {
    const container = document.createElement('div')
    container.innerHTML =
      '<button type="button">A</button><button type="button" disabled>B</button><textarea></textarea>'
    document.body.appendChild(container)

    const focusable = getFocusableElements(container)
    expect(focusable).toHaveLength(2)
    expect(focusable[0]?.textContent).toBe('A')
  })

  it('Tab 在末项时循环到首项', () => {
    const container = document.createElement('div')
    container.innerHTML = '<button type="button">A</button><button type="button">B</button>'
    document.body.appendChild(container)
    const [first, last] = getFocusableElements(container)
    last?.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    handleTabTrap(event, container)

    expect(preventDefault).toHaveBeenCalled()
    expect(document.activeElement).toBe(first)
  })

  it('bindModalFocusTrap 关闭后还原焦点', () => {
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.textContent = 'open'
    document.body.appendChild(trigger)
    trigger.focus()

    const container = document.createElement('div')
    container.innerHTML = '<button type="button">inside</button>'
    document.body.appendChild(container)

    const release = bindModalFocusTrap(container)
    expect(document.activeElement?.textContent).toBe('inside')

    release()
    expect(document.activeElement).toBe(trigger)
  })
})
