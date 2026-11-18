import { describe, expect, it } from 'vitest'

import {
  isLibraryBookmarkImportFailed,
  isLibraryBookmarkImporting
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
