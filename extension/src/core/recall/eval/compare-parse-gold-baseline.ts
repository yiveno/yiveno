/**
 * parse-gold LLM 相对基线快照的门禁比较（纯函数 · 不接生产路径）。
 *
 * 口径：基线里已登记的 must 回归 = 已知残差（不挡）；**新增** must 回归才红。
 * 进步（基线失败、本次通过）只汇报，不挡门禁。
 */

/** 从快照 JSON 抽出门禁所需字段（宽松校验，失败抛错）。 */
export type ParseGoldBaselineSnapshot = {
  schemaVersion: number
  model: string
  mustRegressedByLlm: string[]
  llmMustScore: string | null
}

export type ParseGoldBaselineCompareResult = {
  baselineModel: string
  baselineMustRegressed: string[]
  currentMustRegressed: string[]
  /** 相对基线新增的 must 回归（应挡门禁） */
  newRegressions: string[]
  /** 基线有、本次已过（进步，不挡） */
  healed: string[]
  /** 仍落在基线已知残差内 */
  knownResidual: string[]
  /** newRegressions 为空则 true */
  passed: boolean
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`基线快照缺少数组字段：${label}`)
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(`基线快照 ${label} 含非字符串项`)
    }
    out.push(item)
  }
  return out
}

/**
 * 从 parse-gold LLM JSON 报告（schemaVersion≥2）提取 must 回归清单。
 */
export function extractParseGoldBaselineSnapshot(raw: unknown): ParseGoldBaselineSnapshot {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('基线快照不是 JSON 对象')
  }
  const root = raw as Record<string, unknown>
  const schemaVersion = root.schemaVersion
  if (typeof schemaVersion !== 'number' || schemaVersion < 2) {
    throw new Error(
      `基线快照 schemaVersion 须 ≥2（含 mustRegressedByLlm）；实际=${String(schemaVersion)}`
    )
  }
  const model = root.model
  if (typeof model !== 'string' || !model.trim()) {
    throw new Error('基线快照缺少 model')
  }
  const layers = root.layers
  if (typeof layers !== 'object' || layers === null) {
    throw new Error('基线快照缺少 layers')
  }
  const l2 = (layers as Record<string, unknown>).L2_parse_gold
  if (typeof l2 !== 'object' || l2 === null) {
    throw new Error('基线快照缺少 layers.L2_parse_gold')
  }
  const l2Rec = l2 as Record<string, unknown>
  const mustRegressedByLlm = asStringArray(l2Rec.mustRegressedByLlm, 'mustRegressedByLlm')
  const llm = l2Rec.llm
  let llmMustScore: string | null = null
  if (typeof llm === 'object' && llm !== null) {
    const must = (llm as Record<string, unknown>).must
    if (typeof must === 'string') {
      llmMustScore = must
    }
  }
  return {
    schemaVersion,
    model: model.trim(),
    mustRegressedByLlm,
    llmMustScore
  }
}

/**
 * 对照基线比较本次 must 回归集合。
 */
export function compareMustRegressionsToBaseline(input: {
  currentMustRegressedByLlm: readonly string[]
  baseline: ParseGoldBaselineSnapshot
}): ParseGoldBaselineCompareResult {
  const baselineSet = new Set(input.baseline.mustRegressedByLlm)
  const current = [...input.currentMustRegressedByLlm]
  const currentSet = new Set(current)

  const newRegressions = current.filter(id => !baselineSet.has(id)).sort()
  const knownResidual = current.filter(id => baselineSet.has(id)).sort()
  const healed = input.baseline.mustRegressedByLlm.filter(id => !currentSet.has(id)).sort()

  return {
    baselineModel: input.baseline.model,
    baselineMustRegressed: [...input.baseline.mustRegressedByLlm].sort(),
    currentMustRegressed: [...current].sort(),
    newRegressions,
    healed,
    knownResidual,
    passed: newRegressions.length === 0
  }
}

/** 控制台摘要（中文）。 */
export function formatParseGoldBaselineCompareSummary(
  result: ParseGoldBaselineCompareResult,
  opts?: { baselinePath?: string; baselineMustScore?: string | null }
): string {
  const pathNote = opts?.baselinePath ? ` path=${opts.baselinePath}` : ''
  const scoreNote = opts?.baselineMustScore ? ` baselineMust=${opts.baselineMustScore}` : ''
  const lines = [
    `[parse-gold:llm] vs baseline: model=${result.baselineModel}${scoreNote}${pathNote}`,
    `  known residual: ${result.knownResidual.length ? result.knownResidual.join(', ') : '(none)'}`,
    `  healed: ${result.healed.length ? result.healed.join(', ') : '(none)'}`,
    `  new regressions: ${result.newRegressions.length ? result.newRegressions.join(', ') : '(none)'}`,
    `  gate: ${result.passed ? 'PASS (no new must regressions)' : 'FAIL (new must regressions)'}`
  ]
  return lines.join('\n')
}
