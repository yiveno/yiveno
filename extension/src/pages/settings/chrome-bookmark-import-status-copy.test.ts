import { describe, expect, it } from 'vitest'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { resolveChromeBookmarkImportStatusView } from '@/pages/settings/chrome-bookmark-import-status-copy'

function makeState(
  overrides: Partial<ChromeBookmarkImportState> & Pick<ChromeBookmarkImportState, 'status'>
): ChromeBookmarkImportState {
  return {
    importedCount: 0,
    ...overrides
  }
}

describe('resolveChromeBookmarkImportStatusView', () => {
  it('state 为 null 且查询成功 → none', () => {
    expect(resolveChromeBookmarkImportStatusView(null, true)).toEqual({ kind: 'none' })
  })

  it('查询失败 → query_failed（透传 errorCode；无则 null）', () => {
    expect(resolveChromeBookmarkImportStatusView(null, false, 'IMPORT_STATUS_READ_FAILED')).toEqual(
      {
        kind: 'query_failed',
        errorCode: 'IMPORT_STATUS_READ_FAILED'
      }
    )
    expect(resolveChromeBookmarkImportStatusView(null, false)).toEqual({
      kind: 'query_failed',
      errorCode: null
    })
  })

  it('running 且有总数 → running + totalCount', () => {
    expect(
      resolveChromeBookmarkImportStatusView(
        makeState({ status: 'running', importedCount: 12, totalCount: 80 }),
        true
      )
    ).toEqual({ kind: 'running', importedCount: 12, totalCount: 80 })
  })

  it('running/pending 无总数或 total≤0 → totalCount null', () => {
    expect(
      resolveChromeBookmarkImportStatusView(
        makeState({ status: 'running', importedCount: 3 }),
        true
      )
    ).toEqual({ kind: 'running', importedCount: 3, totalCount: null })
    expect(
      resolveChromeBookmarkImportStatusView(
        makeState({ status: 'pending', importedCount: 0, totalCount: 0 }),
        true
      )
    ).toEqual({ kind: 'running', importedCount: 0, totalCount: null })
  })

  it('completed → completed', () => {
    expect(
      resolveChromeBookmarkImportStatusView(
        makeState({ status: 'completed', importedCount: 42 }),
        true
      )
    ).toEqual({ kind: 'completed', importedCount: 42 })
  })

  it('failed 有 code → failed + errorCode', () => {
    expect(
      resolveChromeBookmarkImportStatusView(
        makeState({
          status: 'failed',
          importedCount: 1,
          errorCode: 'BOOKMARK_IMPORT_READ_FAILED'
        }),
        true
      )
    ).toEqual({ kind: 'failed', errorCode: 'BOOKMARK_IMPORT_READ_FAILED' })
  })

  it('failed 无 code → failed + null', () => {
    expect(
      resolveChromeBookmarkImportStatusView(makeState({ status: 'failed', importedCount: 0 }), true)
    ).toEqual({ kind: 'failed', errorCode: null })
  })
})
