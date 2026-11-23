import { describe, expect, it } from 'vitest'

import type { ThirdPartyCorpusImportState } from '@/core/memory/third-party-corpus-import-state'
import {
  resolveThirdPartyDeleteMode,
  resolveThirdPartySourceStatusView,
  type ThirdPartyCorpusSummaryView
} from '@/pages/settings/third-party-source-status-copy'

function makeImport(
  overrides: Partial<ThirdPartyCorpusImportState> &
    Pick<ThirdPartyCorpusImportState, 'status' | 'source'>
): ThirdPartyCorpusImportState {
  return {
    importedCount: 0,
    totalCount: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function emptySummary(): ThirdPartyCorpusSummaryView {
  return {
    raindrop: { count: 0, lastImport: null },
    pocket: { count: 0, lastImport: null }
  }
}

describe('resolveThirdPartySourceStatusView', () => {
  it('summary null 且 loading → loading', () => {
    expect(
      resolveThirdPartySourceStatusView({
        summary: null,
        summaryLoading: true,
        source: 'raindrop'
      })
    ).toEqual({ kind: 'loading' })
  })

  it('summary null 且未加载 → summary_failed', () => {
    expect(
      resolveThirdPartySourceStatusView({
        summary: null,
        summaryLoading: false,
        source: 'pocket'
      })
    ).toEqual({ kind: 'summary_failed' })
  })

  it('count 0 且无 lastImport → not_imported', () => {
    expect(
      resolveThirdPartySourceStatusView({
        summary: emptySummary(),
        summaryLoading: false,
        source: 'raindrop'
      })
    ).toEqual({ kind: 'not_imported' })
  })

  it('lastImport failed 且有计数 → failed_import', () => {
    const lastImport = makeImport({
      status: 'failed',
      source: 'raindrop',
      importedCount: 2,
      errorCode: 'THIRD_PARTY_IMPORT_INVALID_FORMAT'
    })
    expect(
      resolveThirdPartySourceStatusView({
        summary: {
          raindrop: { count: 5, lastImport },
          pocket: { count: 0, lastImport: null }
        },
        summaryLoading: false,
        source: 'raindrop'
      })
    ).toEqual({
      kind: 'failed_import',
      count: 5,
      errorCode: 'THIRD_PARTY_IMPORT_INVALID_FORMAT'
    })
  })

  it('lastImport failed 计数 0 / 非法 errorCode → failed_import + null code', () => {
    const lastImport = makeImport({
      status: 'failed',
      source: 'pocket',
      errorCode: 'NOT_A_REAL_CODE'
    })
    expect(
      resolveThirdPartySourceStatusView({
        summary: {
          raindrop: { count: 0, lastImport: null },
          pocket: { count: 0, lastImport }
        },
        summaryLoading: false,
        source: 'pocket'
      })
    ).toEqual({ kind: 'failed_import', count: 0, errorCode: null })
  })

  it('已导入且有上次导入 → imported', () => {
    const lastImport = makeImport({
      status: 'completed',
      source: 'raindrop',
      importedCount: 10,
      finishedAt: '2026-02-01T00:00:00.000Z'
    })
    expect(
      resolveThirdPartySourceStatusView({
        summary: {
          raindrop: { count: 10, lastImport },
          pocket: { count: 0, lastImport: null }
        },
        summaryLoading: false,
        source: 'raindrop'
      })
    ).toEqual({ kind: 'imported', count: 10, lastImport })
  })

  it('已导入无上次导入 → imported + lastImport null', () => {
    expect(
      resolveThirdPartySourceStatusView({
        summary: {
          raindrop: { count: 3, lastImport: null },
          pocket: { count: 0, lastImport: null }
        },
        summaryLoading: false,
        source: 'raindrop'
      })
    ).toEqual({ kind: 'imported', count: 3, lastImport: null })
  })
})

describe('resolveThirdPartyDeleteMode', () => {
  it('count > 0 → items', () => {
    expect(
      resolveThirdPartyDeleteMode({
        summary: {
          raindrop: { count: 4, lastImport: null },
          pocket: { count: 0, lastImport: null }
        },
        source: 'raindrop'
      })
    ).toBe('items')
  })

  it('count 0 + failed lastImport → record', () => {
    expect(
      resolveThirdPartyDeleteMode({
        summary: {
          raindrop: {
            count: 0,
            lastImport: makeImport({
              status: 'failed',
              source: 'raindrop',
              errorCode: 'THIRD_PARTY_IMPORT_INVALID_FORMAT'
            })
          },
          pocket: { count: 0, lastImport: null }
        },
        source: 'raindrop'
      })
    ).toBe('record')
  })

  it('count 0 + completed lastImport → record', () => {
    expect(
      resolveThirdPartyDeleteMode({
        summary: {
          raindrop: { count: 0, lastImport: null },
          pocket: {
            count: 0,
            lastImport: makeImport({
              status: 'completed',
              source: 'pocket',
              importedCount: 0,
              finishedAt: '2026-02-01T00:00:00.000Z'
            })
          }
        },
        source: 'pocket'
      })
    ).toBe('record')
  })

  it('count 0 + null lastImport → none', () => {
    expect(
      resolveThirdPartyDeleteMode({
        summary: emptySummary(),
        source: 'raindrop'
      })
    ).toBe('none')
  })

  it('summary null → none', () => {
    expect(
      resolveThirdPartyDeleteMode({
        summary: null,
        source: 'pocket'
      })
    ).toBe('none')
  })
})
