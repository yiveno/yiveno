import { describe, expect, it } from 'vitest'

import { isLibraryBookmarkImporting } from '@/pages/library/library-bookmark-import-ui'

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
