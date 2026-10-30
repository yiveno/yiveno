/**
 * 区分 parse-gold 失败属于 L1（Schema/解析）还是 L2（槽位 expect）。
 * 依赖 `runParseGoldAsync` 对抛错使用「解析失败:」/「解析跳过:」前缀。
 */

/** 单条用例失败分层。 */
export type ParseGoldFailureKind =
  | 'none' // 通过
  | 'schema' // L1：JSON/Zod/网络等解析失败
  | 'slot' // L2：解析成功但槽位不符金标
  | 'skip' // 鉴权失败后跳过，未调用模型

/**
 * 根据 passed + detail 判定失败种类。
 * 通过 → none；「解析跳过:」→ skip；「解析失败:」→ schema；其余失败 → slot。
 */
export function classifyParseGoldFailure(input: {
  passed: boolean
  detail: string
}): ParseGoldFailureKind {
  if (input.passed) {
    return 'none'
  }
  const detail = input.detail.trim()
  if (detail.startsWith('解析跳过:')) {
    return 'skip'
  }
  if (detail.startsWith('解析失败:')) {
    return 'schema'
  }
  return 'slot'
}
