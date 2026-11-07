import type { ParseGoldSlots } from '@/core/recall/eval/parse-gold-cases'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

function sortedCopy(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function sameStringSet(actual: string[], expected: string[]): boolean {
  const a = sortedCopy(actual)
  const b = sortedCopy(expected)
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}

function formatList(values: string[]): string {
  return values.length === 0 ? '[]' : `[${values.join(', ')}]`
}

/** 将解析结果与金标槽位对比；返回失败原因列表（空 = 通过）。 */
export function diffParseGoldSlots(parsed: ParsedRecallClue, expect: ParseGoldSlots): string[] {
  const failures: string[] = []

  if (expect.timeLabel !== undefined) {
    const actualLabel = parsed.timeRange?.label ?? null
    if (actualLabel !== expect.timeLabel) {
      failures.push(`timeLabel 期望 ${String(expect.timeLabel)}，实际 ${String(actualLabel)}`)
    }
  }

  if (expect.objectTypes !== undefined) {
    const actual = parsed.objectTypes ?? []
    if (expect.objectTypes === null) {
      if (actual.length > 0) {
        failures.push(`objectTypes 期望无，实际 ${formatList(actual)}`)
      }
    } else if (!sameStringSet(actual, expect.objectTypes)) {
      failures.push(
        `objectTypes 期望 ${formatList(expect.objectTypes)}，实际 ${formatList(actual)}`
      )
    }
  }

  if (expect.behaviorHints !== undefined) {
    const actual = parsed.behaviorHints ?? []
    if (expect.behaviorHints === null) {
      if (actual.length > 0) {
        failures.push(`behaviorHints 期望无，实际 ${formatList(actual)}`)
      }
    } else if (!sameStringSet(actual, expect.behaviorHints)) {
      failures.push(
        `behaviorHints 期望 ${formatList(expect.behaviorHints)}，实际 ${formatList(actual)}`
      )
    }
  }

  if (expect.noteHint !== undefined) {
    const actual = parsed.noteHint === true
    if (actual !== expect.noteHint) {
      failures.push(`noteHint 期望 ${String(expect.noteHint)}，实际 ${String(actual)}`)
    }
  }

  const terms = parsed.contentTerms

  if (expect.contentTermsMustInclude !== undefined) {
    const missing = expect.contentTermsMustInclude.filter(term => !terms.includes(term))
    if (missing.length > 0) {
      failures.push(`contentTerms 缺少 ${formatList(missing)}（实际 ${formatList(terms)}）`)
    }
  }

  if (expect.contentTermsMustExclude !== undefined) {
    const leaked = expect.contentTermsMustExclude.filter(term => terms.includes(term))
    if (leaked.length > 0) {
      failures.push(`contentTerms 不应含 ${formatList(leaked)}（实际 ${formatList(terms)}）`)
    }
  }

  if (expect.contentTermsExact === true) {
    const required = expect.contentTermsMustInclude ?? []
    if (!sameStringSet(terms, required)) {
      failures.push(`contentTerms 须精确等于 ${formatList(required)}，实际 ${formatList(terms)}`)
    }
  }

  const excludeTerms = parsed.excludeContentTerms ?? []

  if (expect.excludeContentTermsEmpty === true) {
    if (excludeTerms.length > 0) {
      failures.push(`excludeContentTerms 期望空，实际 ${formatList(excludeTerms)}`)
    }
  }

  if (expect.excludeContentTermsMustInclude !== undefined) {
    const missing = expect.excludeContentTermsMustInclude.filter(
      term => !excludeTerms.includes(term)
    )
    if (missing.length > 0) {
      failures.push(
        `excludeContentTerms 缺少 ${formatList(missing)}（实际 ${formatList(excludeTerms)}）`
      )
    }
  }

  if (expect.excludeContentTermsMustExclude !== undefined) {
    const leaked = expect.excludeContentTermsMustExclude.filter(term => excludeTerms.includes(term))
    if (leaked.length > 0) {
      failures.push(
        `excludeContentTerms 不应含 ${formatList(leaked)}（实际 ${formatList(excludeTerms)}）`
      )
    }
  }

  if (expect.excludeContentTermsExact === true) {
    const required = expect.excludeContentTermsMustInclude ?? []
    if (!sameStringSet(excludeTerms, required)) {
      failures.push(
        `excludeContentTerms 须精确等于 ${formatList(required)}，实际 ${formatList(excludeTerms)}`
      )
    }
  }

  if (expect.confidence !== undefined && parsed.confidence !== expect.confidence) {
    failures.push(`confidence 期望 ${expect.confidence}，实际 ${parsed.confidence}`)
  }

  return failures
}
