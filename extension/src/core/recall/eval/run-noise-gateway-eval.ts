import {
  NOISE_GATEWAY_HAND_CASES,
  type NoiseGatewayCase,
  type NoiseGatewayGate
} from '@/core/recall/eval/noise-gateway-cases'
import { buildSynthNoiseGatewayCases } from '@/core/recall/eval/build-synth-noise-gateway-cases'
import { selectClueProcessingDisposition } from '@/core/recall/understand/select-clue-processing-disposition'

/** 单条用例结果。 */
export interface NoiseGatewayEvalCaseResult {
  caseId: string
  gate: NoiseGatewayGate
  clue: string
  passed: boolean
  detail: string
  actualDisposition: ReturnType<typeof selectClueProcessingDisposition>['disposition']
  actualRejectReason: ReturnType<typeof selectClueProcessingDisposition>['rejectReason']
}

/** 汇总指标。 */
export interface NoiseGatewayEvalReport {
  must: { total: number; passed: number; failed: NoiseGatewayEvalCaseResult[] }
  stretch: { total: number; passed: number; failed: NoiseGatewayEvalCaseResult[] }
  cases: NoiseGatewayEvalCaseResult[]
}

/** 判定单条期望。 */
export function judgeNoiseGatewayCase(
  evalCase: NoiseGatewayCase
): Omit<NoiseGatewayEvalCaseResult, 'caseId' | 'gate' | 'clue'> {
  const actual = selectClueProcessingDisposition(evalCase.clue)
  const { expect } = evalCase

  if (expect.disposition === 'proceed') {
    const passed = actual.disposition === 'proceed'
    return {
      passed,
      detail: passed
        ? '正确放行'
        : `期望 proceed，实际 reject_noise(${actual.rejectReason ?? 'null'})`,
      actualDisposition: actual.disposition,
      actualRejectReason: actual.rejectReason
    }
  }

  const dispositionOk = actual.disposition === 'reject_noise'
  const reasonOk = actual.rejectReason === expect.rejectReason
  const passed = dispositionOk && reasonOk
  return {
    passed,
    detail: passed
      ? `正确拒绝(${expect.rejectReason})`
      : `期望 reject_noise(${expect.rejectReason})，实际 ${actual.disposition}(${actual.rejectReason ?? 'null'})`,
    actualDisposition: actual.disposition,
    actualRejectReason: actual.rejectReason
  }
}

/**
 * 组装默认评测集：人手噪音金标 + 合成硬噪音。
 * 不再并入 PARSE_GOLD_CASES（定死口语批跑已退役；理解试跑走 `nlu:try`）。
 */
export function buildNoiseGatewayEvalCases(): NoiseGatewayCase[] {
  const synth = buildSynthNoiseGatewayCases({ seed: 20260731, countPerFamily: 24 })
  return [...NOISE_GATEWAY_HAND_CASES, ...synth]
}

/**
 * 对线索集跑一轮噪音网关 eval（只测 Gate A，不扫库、不调 LLM）。
 */
export function runNoiseGatewayEval(
  cases: NoiseGatewayCase[] = buildNoiseGatewayEvalCases()
): NoiseGatewayEvalReport {
  const caseResults: NoiseGatewayEvalCaseResult[] = cases.map(evalCase => {
    const judged = judgeNoiseGatewayCase(evalCase)
    return {
      caseId: evalCase.id,
      gate: evalCase.gate,
      clue: evalCase.clue,
      ...judged
    }
  })

  const mustCases = caseResults.filter(item => item.gate === 'must')
  const stretchCases = caseResults.filter(item => item.gate === 'stretch')

  return {
    must: {
      total: mustCases.length,
      passed: mustCases.filter(item => item.passed).length,
      failed: mustCases.filter(item => !item.passed)
    },
    stretch: {
      total: stretchCases.length,
      passed: stretchCases.filter(item => item.passed).length,
      failed: stretchCases.filter(item => !item.passed)
    },
    cases: caseResults
  }
}
