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
  it('findProductSurfaceLabelViolation 命中 search 动词形态，research 不命中', () => {
    expect(findProductSurfaceLabelViolation('Search memories')).toBe('Search')
    expect(findProductSurfaceLabelViolation('she searches the library')).toBe('searches')
    expect(findProductSurfaceLabelViolation('I only searched the first part')).toBe('searched')
    expect(findProductSurfaceLabelViolation('still searching')).toBe('searching')
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
      bad_key: { message: 'Search your library' },
      searched_key: {
        message: 'That clue was long, so I only searched the first part.'
      }
    })
    expect(violations).toEqual([
      {
        key: 'bad_key',
        message: 'Search your library',
        matched: 'Search'
      },
      {
        key: 'searched_key',
        message: 'That clue was long, so I only searched the first part.',
        matched: 'searched'
      }
    ])
  })
})
