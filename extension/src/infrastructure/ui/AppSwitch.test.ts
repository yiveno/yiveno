import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AppSwitch 样式契约', () => {
  it('thumb 位移用 transform，避免 left 触发布局', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'AppSwitch.vue'), 'utf8')
    expect(source).toContain('transform: translateX(0)')
    expect(source).toContain('transform: translateX(20px)')
    expect(source).not.toMatch(/transition:\s*left\b/)
    expect(source).not.toMatch(/left:\s*24px/)
  })
})
