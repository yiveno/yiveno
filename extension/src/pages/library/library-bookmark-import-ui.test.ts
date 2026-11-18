import { describe, expect, it } from 'vitest'

import {
  isLibraryBookmarkImportFailed,
  isLibraryBookmarkImporting,
  resolveLibraryBookmarkRetryBlockedReason
} from '@/pages/library/library-bookmark-import-ui'

describe('isLibraryBookmarkImporting', () => {
  it('running / pending 为真', () => {
    expect(isLibraryBookmarkImporting('running')).toBe(true)
    expect(isLibraryBookmarkImporting('pending')).toBe(true)
  })

  it('completed / failed / 空 为假', () => {
    expect(isLibraryBookmarkImporting('completed')).toBe(false)
    expect(isLibraryBookmarkImporting('failed')).toBe(false)
    expect(isLibraryBookmarkImporting(null)).toBe(false)
    expect(isLibraryBookmarkImporting(undefined)).toBe(false)
  })
})

describe('isLibraryBookmarkImportFailed', () => {
  it('failed → true', () => {
    expect(isLibraryBookmarkImportFailed('failed')).toBe(true)
  })

  it('running / pending / completed → false', () => {
    expect(isLibraryBookmarkImportFailed('running')).toBe(false)
    expect(isLibraryBookmarkImportFailed('pending')).toBe(false)
    expect(isLibraryBookmarkImportFailed('completed')).toBe(false)
  })
})

describe('resolveLibraryBookmarkRetryBlockedReason', () => {
  it('false → ingest_off', () => {
    expect(resolveLibraryBookmarkRetryBlockedReason(false)).toBe('ingest_off')
  })

  it('true → null', () => {
    expect(resolveLibraryBookmarkRetryBlockedReason(true)).toBe(null)
  })

  it('undefined → null（fail-open）', () => {
    expect(resolveLibraryBookmarkRetryBlockedReason(undefined)).toBe(null)
  })
})
