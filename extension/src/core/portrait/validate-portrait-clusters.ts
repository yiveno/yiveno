/**
 * 画像语义簇划分校验（纯函数）。
 * 划分须覆盖输入集合；单成员 label===value；多成员 label 为概括而非照抄。
 */

import { parseJsonObjectFromLlmText } from '@/core/recall/understand/extract-llm-json'

/** 单簇（校验通过后的规范化形）。 */
export type PortraitClusterPartitionCluster = {
  label: string
  items: string[]
}

export type PortraitClusterValidateOk = {
  ok: true
  clusters: PortraitClusterPartitionCluster[]
}

export type PortraitClusterValidateFail = {
  ok: false
  reasons: string[]
}

export type PortraitClusterValidateResult = PortraitClusterValidateOk | PortraitClusterValidateFail

/** 计量 label 单位：含汉字按去空白字符数；否则按空白分词。 */
export function measurePortraitClusterLabelUnits(label: string): number {
  const trimmed = label.trim()
  if (!trimmed) {
    return 0
  }
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed.replace(/\s+/g, '').length
  }
  return trimmed.split(/\s+/).filter(Boolean).length
}

function fail(reasons: string[]): PortraitClusterValidateFail {
  return { ok: false, reasons }
}

/**
 * 校验 LLM 原文是否构成输入 value 集合的合法划分。
 * @param rawText 模型原文（允许围栏 JSON）
 * @param inputValues 权威输入集合（可含重复 value 时按多重集合？此处按唯一 value；调用方保证唯一）
 */
export function validatePortraitClusters(
  rawText: string,
  inputValues: readonly string[]
): PortraitClusterValidateResult {
  const inputSet = new Set(inputValues)
  if (inputSet.size !== inputValues.length) {
    return fail(['输入 value 存在重复'])
  }

  let parsed: unknown
  try {
    parsed = parseJsonObjectFromLlmText(rawText)
  } catch {
    return fail(['JSON 无法解析'])
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail(['根须为对象'])
  }
  const clustersRaw = (parsed as { clusters?: unknown }).clusters
  if (!Array.isArray(clustersRaw)) {
    return fail(['缺少 clusters 数组'])
  }
  if (clustersRaw.length > inputValues.length) {
    return fail(['簇数超过输入项数'])
  }

  const seen = new Set<string>()
  const normalized: PortraitClusterPartitionCluster[] = []
  const reasons: string[] = []

  for (let i = 0; i < clustersRaw.length; i += 1) {
    const row = clustersRaw[i]
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      reasons.push(`簇[${i}] 形非法`)
      continue
    }
    const labelRaw = (row as { label?: unknown }).label
    const itemsRaw = (row as { items?: unknown }).items
    if (typeof labelRaw !== 'string' || !labelRaw.trim()) {
      reasons.push(`簇[${i}] label 为空`)
      continue
    }
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      reasons.push(`簇[${i}] items 为空`)
      continue
    }
    const items: string[] = []
    for (const v of itemsRaw) {
      if (typeof v !== 'string' || !v.trim()) {
        reasons.push(`簇[${i}] 含非字符串项`)
        continue
      }
      const value = v.trim()
      if (!inputSet.has(value)) {
        reasons.push(`发明项:${value}`)
        continue
      }
      if (seen.has(value)) {
        reasons.push(`重复项:${value}`)
        continue
      }
      seen.add(value)
      items.push(value)
    }
    if (items.length === 0) {
      reasons.push(`簇[${i}] 无有效成员`)
      continue
    }
    const label = labelRaw.trim()
    if (items.length === 1) {
      if (label !== items[0]) {
        reasons.push(`单成员簇 label 须等于 value（${items[0]}）`)
        continue
      }
    } else {
      if (measurePortraitClusterLabelUnits(label) > 12) {
        reasons.push(`多成员簇 label 过长:${label}`)
        continue
      }
      if (items.includes(label)) {
        reasons.push(`多成员簇 label 不得照抄成员:${label}`)
        continue
      }
    }
    normalized.push({ label, items })
  }

  if (reasons.length > 0) {
    return fail(reasons)
  }

  for (const value of inputValues) {
    if (!seen.has(value)) {
      reasons.push(`遗漏项:${value}`)
    }
  }
  if (reasons.length > 0) {
    return fail(reasons)
  }

  return { ok: true, clusters: normalized }
}
