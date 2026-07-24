import { describe, expect, it } from 'vitest'

import { asMdSwitchElement } from './register-material-web'

describe('asMdSwitchElement', () => {
  it('识别 md-switch 元素', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'localName', { value: 'md-switch' })
    expect(asMdSwitchElement(el)).toBe(el)
  })

  it('非 md-switch 返回 null', () => {
    expect(asMdSwitchElement(document.createElement('button'))).toBeNull()
    expect(asMdSwitchElement(null)).toBeNull()
  })
})
