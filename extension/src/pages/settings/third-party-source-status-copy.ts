import {
  ThirdPartyCorpusImportErrorCodeSchema,
  type ThirdPartyCorpusImportErrorCode,
  type ThirdPartyCorpusImportState
} from '@/core/memory/third-party-corpus-import-state'
import type { ThirdPartyCorpusSource } from '@/core/memory/third-party-corpus-source'

/** 单来源摘要（Settings third_party 状态行）。 */
export type ThirdPartySourceSummaryView = {
  count: number
  lastImport: ThirdPartyCorpusImportState | null
}

/** 两来源摘要（与 fetchThirdPartyCorpusSummary.sources 对齐）。 */
export type ThirdPartyCorpusSummaryView = {
  raindrop: ThirdPartySourceSummaryView
  pocket: ThirdPartySourceSummaryView
}

/** 第三方来源状态 → Settings 展示 view（文案由 composable 渲染）。 */
export type ThirdPartySourceStatusView =
  | { kind: 'loading' }
  | { kind: 'summary_failed' }
  | { kind: 'not_imported' }
  | {
      kind: 'failed_import'
      count: number
      errorCode: ThirdPartyCorpusImportErrorCode | null
    }
  | { kind: 'imported'; count: number; lastImport: ThirdPartyCorpusImportState | null }

/**
 * 将第三方摘要 + 加载态解析为单来源状态 view。
 * summary null + loading → loading；null + 未加载 → summary_failed。
 */
export function resolveThirdPartySourceStatusView(args: {
  summary: ThirdPartyCorpusSummaryView | null
  summaryLoading: boolean
  source: ThirdPartyCorpusSource
}): ThirdPartySourceStatusView {
  const { summary, summaryLoading, source } = args
  if (summary == null) {
    return summaryLoading ? { kind: 'loading' } : { kind: 'summary_failed' }
  }
  const sourceSummary = summary[source]
  if (sourceSummary.count === 0 && sourceSummary.lastImport == null) {
    return { kind: 'not_imported' }
  }
  const lastImport = sourceSummary.lastImport
  if (lastImport?.status === 'failed') {
    const parsed = ThirdPartyCorpusImportErrorCodeSchema.safeParse(lastImport.errorCode)
    return {
      kind: 'failed_import',
      count: sourceSummary.count,
      errorCode: parsed.success ? parsed.data : null
    }
  }
  return {
    kind: 'imported',
    count: sourceSummary.count,
    lastImport
  }
}

/** 第三方删除按钮模式：有条目 / 仅清导入记录 / 不可删。 */
export type ThirdPartyDeleteMode = 'items' | 'record' | 'none'

/**
 * 按摘要判定删除可用性与文案模式。
 * summary null → none；count > 0 → items；count 0 且有 lastImport → record；否则 none。
 */
export function resolveThirdPartyDeleteMode(args: {
  summary: ThirdPartyCorpusSummaryView | null
  source: ThirdPartyCorpusSource
}): ThirdPartyDeleteMode {
  const { summary, source } = args
  if (summary == null) {
    return 'none'
  }
  const sourceSummary = summary[source]
  if (sourceSummary.count > 0) {
    return 'items'
  }
  if (sourceSummary.lastImport != null) {
    return 'record'
  }
  return 'none'
}
