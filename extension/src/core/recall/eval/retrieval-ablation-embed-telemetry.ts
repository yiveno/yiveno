/**
 * L2 消融 · Embedding 请求可观测性（纯记录；失败须抛错，禁止空向量续算）。
 */

export interface EmbedCallRecord {
  /** 本批文本条数 */
  textCount: number
  /** 上游返回的 model 字符串 */
  model: string
  /** 向量维度 */
  dim: number
  /** 耗时 ms */
  latencyMs: number
  outcome: 'ok' | 'error'
  errorCode?: string
}

export interface EmbedTelemetrySummary {
  callCount: number
  okCount: number
  errorCount: number
  totalTexts: number
  modelsSeen: string[]
  latencyMsP50: number | null
  latencyMsMax: number | null
  lastErrorCode: string | null
}

export function createEmbedTelemetryCollector(): {
  records: EmbedCallRecord[]
  record: (entry: EmbedCallRecord) => void
  summarize: () => EmbedTelemetrySummary
} {
  const records: EmbedCallRecord[] = []
  return {
    records,
    record: entry => {
      records.push(entry)
    },
    summarize: () => {
      const ok = records.filter(item => item.outcome === 'ok')
      const err = records.filter(item => item.outcome === 'error')
      const latencies = ok.map(item => item.latencyMs).sort((a, b) => a - b)
      const modelsSeen = [...new Set(ok.map(item => item.model))]
      return {
        callCount: records.length,
        okCount: ok.length,
        errorCount: err.length,
        totalTexts: records.reduce((sum, item) => sum + item.textCount, 0),
        modelsSeen,
        latencyMsP50:
          latencies.length === 0 ? null : latencies[Math.floor((latencies.length - 1) / 2)]!,
        latencyMsMax: latencies.length === 0 ? null : latencies[latencies.length - 1]!,
        lastErrorCode: err.length > 0 ? (err[err.length - 1]!.errorCode ?? 'unknown') : null
      }
    }
  }
}

/** 负例：期望 miss@K 时的误报率（目标不该进前 K 却进了）。 */
export interface NegativeFalsePositiveStats {
  /** 负例条数 */
  caseCount: number
  /** 误报条数（目标进了前 K） */
  falsePositiveCount: number
  /** falsePositiveCount / caseCount；无负例时 null */
  falsePositiveRate: number | null
  kDefault: number
}

export function summarizeNegativeFalsePositives(
  rows: readonly { falsePositive: boolean }[]
): NegativeFalsePositiveStats {
  const caseCount = rows.length
  const falsePositiveCount = rows.filter(item => item.falsePositive).length
  return {
    caseCount,
    falsePositiveCount,
    falsePositiveRate: caseCount === 0 ? null : falsePositiveCount / caseCount,
    kDefault: 10
  }
}
