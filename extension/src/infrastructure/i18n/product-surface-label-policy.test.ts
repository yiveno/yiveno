import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  assertProductSurfaceLabelAllowed,
  findProductSurfaceLabelViolation,
  scanEnMessagesForProductSurfaceViolations
} from '@/infrastructure/i18n/product-surface-label-policy'

const enMessagesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../public/_locales/en/messages.json'
)

function loadEnMessages(): Record<string, { message?: string }> {
  return JSON.parse(readFileSync(enMessagesPath, 'utf8')) as Record<string, { message?: string }>
}

describe('product-surface-label-policy', () => {
  it('findProductSurfaceLabelViolation 整词 Search 才命中', () => {
    expect(findProductSurfaceLabelViolation('Search memories')).toBe('Search')
    expect(findProductSurfaceLabelViolation('research notes')).toBeNull()
    expect(findProductSurfaceLabelViolation('Find again')).toBeNull()
  })

  it('assertProductSurfaceLabelAllowed 拒绝 Search', () => {
    expect(() => assertProductSurfaceLabelAllowed('Search memories')).toThrow(/Search/)
    expect(() => assertProductSurfaceLabelAllowed('Find again')).not.toThrow()
  })

  it('scanEnMessagesForProductSurfaceViolations 对全量 en messages 无禁用词', () => {
    const violations = scanEnMessagesForProductSurfaceViolations(loadEnMessages())
    expect(violations).toEqual([])
  })

  it('scanEnMessagesForProductSurfaceViolations 检出违规 key', () => {
    const violations = scanEnMessagesForProductSurfaceViolations({
      ok_key: { message: 'Find it' },
      bad_key: { message: 'Search your library' }
    })
    expect(violations).toEqual([
      {
        key: 'bad_key',
        message: 'Search your library',
        matched: 'Search'
      }
    ])
  })
})
