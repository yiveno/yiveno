/**
 * Prompt 版本哈希稳定性。
 */

import { describe, expect, it } from 'vitest'

import { hashPromptSystemMaterial } from '@/core/ai/prompt-system-hash'

describe('hashPromptSystemMaterial', () => {
  it('相同文案 → 相同哈希', () => {
    expect(hashPromptSystemMaterial('alpha')).toBe(hashPromptSystemMaterial('alpha'))
  })

  it('文案变化 → 哈希不同', () => {
    expect(hashPromptSystemMaterial('alpha')).not.toBe(hashPromptSystemMaterial('alpha!'))
  })

  it('输出为 8 位小写 hex', () => {
    expect(hashPromptSystemMaterial('x')).toMatch(/^[0-9a-f]{8}$/)
  })
})
