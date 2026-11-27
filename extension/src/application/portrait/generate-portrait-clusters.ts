/**
 * 画像待确认项语义聚类：生成 → 校验 →（失败纠正重试一次）→ 缓存。
 * 两次校验不过 / 无 completer / 调用失败 → 回退共现聚类。
 */

import { clusterPendingInferences } from '@/core/portrait/cluster-pending-inferences'
import {
  buildPortraitClusterMessages,
  buildPortraitClusterSystemPrompt
} from '@/core/portrait/portrait-cluster-prompt'
import {
  buildPortraitFactSignature,
  type PortraitFactSignaturePart
} from '@/core/portrait/portrait-narrative-signature'
import {
  validatePortraitClusters,
  type PortraitClusterPartitionCluster
} from '@/core/portrait/validate-portrait-clusters'
import type { UiLocaleId } from '@/core/i18n/ui-locale'
import { recordNlgGateOutcome } from '@/core/recall/understand/nlg-gate-metrics'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import { createHostedClueUnderstandApiCompleter } from '@/infrastructure/ai/hosted-clue-understand-api-client'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import {
  readPortraitClusterCache,
  writePortraitClusterCache
} from '@/infrastructure/storage/portrait-cluster-cache-storage'
import { logger } from '@/infrastructure/logging/logger'

/** 聚类输入（与摘要 pending 项对齐）。 */
export type PortraitClusterGenerateItem = {
  factId: string
  value: string
  credibility: number
  state: string
  sourceNoteRefs: readonly string[]
}

export type GeneratePortraitClustersInput = {
  items: readonly PortraitClusterGenerateItem[]
  locale: UiLocaleId
  /** 单测注入；缺省走 registry 或扩展页现建 hosted completer */
  complete?: LlmChatCompleter | null
}

export type GeneratePortraitClustersResult = {
  clusters: PortraitClusterPartitionCluster[]
  source: 'cache' | 'llm' | 'cooccurrence'
  signature: string
}

/** 待确认事实签名（factId+state；批准/忽略后变化）。 */
export function buildPortraitClusterSignature(
  items: readonly PortraitClusterGenerateItem[]
): string {
  const parts: PortraitFactSignaturePart[] = items.map(item => ({
    factId: item.factId,
    state: item.state,
    inPortrait: false
  }))
  return buildPortraitFactSignature(parts, buildPortraitClusterSystemPrompt())
}

/** 共现回退：label 取簇内最高 credibility 的 value。 */
export function cooccurrencePartitionFromItems(
  items: readonly PortraitClusterGenerateItem[]
): PortraitClusterPartitionCluster[] {
  const raw = clusterPendingInferences(
    items.map(item => ({
      factId: item.factId,
      value: item.value,
      credibility: item.credibility,
      sourceNoteRefs: item.sourceNoteRefs
    }))
  )
  return raw.map(cluster => ({
    label: cluster.label,
    items: cluster.items.map(row => row.value)
  }))
}

async function resolveCompleter(
  injected?: LlmChatCompleter | null
): Promise<LlmChatCompleter | null> {
  if (injected !== undefined) {
    return injected
  }
  const fromRegistry = getClueLlmCompleter()
  if (fromRegistry) {
    return fromRegistry
  }
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    return null
  }
  const bearer = await getWorkerApiAccessToken()
  if (!bearer) {
    return null
  }
  return createHostedClueUnderstandApiCompleter(async () => getWorkerApiAccessToken())
}

async function completeOnce(
  complete: LlmChatCompleter,
  values: readonly string[],
  correctionReasons?: string[]
): Promise<string | null> {
  const messages = buildPortraitClusterMessages(
    values,
    correctionReasons ? { correctionReasons } : undefined
  )
  try {
    const raw = await complete(messages, { taskKind: 'portrait_cluster' })
    const text = raw.trim()
    return text || null
  } catch (error) {
    logger.info('Portrait', '画像语义聚类 LLM 调用失败，回退共现', {
      message: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * 生成语义划分：缓存 → LLM（校验+最多一次纠正）→ 共现回退。
 */
export async function generatePortraitClusters(
  input: GeneratePortraitClustersInput
): Promise<GeneratePortraitClustersResult> {
  const items = [...input.items]
  const signature = buildPortraitClusterSignature(items)
  const fallback = cooccurrencePartitionFromItems(items)

  if (items.length === 0) {
    return { clusters: [], source: 'cooccurrence', signature }
  }

  if (signature) {
    const cached = await readPortraitClusterCache(signature, input.locale)
    if (cached) {
      return { clusters: cached, source: 'cache', signature }
    }
  }

  const complete = await resolveCompleter(input.complete)
  if (!complete) {
    return { clusters: fallback, source: 'cooccurrence', signature }
  }

  const values = items.map(item => item.value)
  const first = await completeOnce(complete, values)
  if (!first) {
    return { clusters: fallback, source: 'cooccurrence', signature }
  }

  const firstCheck = validatePortraitClusters(first, values)
  if (firstCheck.ok) {
    await writePortraitClusterCache(signature, input.locale, firstCheck.clusters)
    recordNlgGateOutcome('portrait_cluster', 'accepted')
    return { clusters: firstCheck.clusters, source: 'llm', signature }
  }

  recordNlgGateOutcome('portrait_cluster', 'rejected:partition')
  logger.info('Portrait', '画像语义聚类首次校验未过，纠正重试', {
    reasons: firstCheck.reasons
  })

  const second = await completeOnce(complete, values, firstCheck.reasons)
  if (!second) {
    return { clusters: fallback, source: 'cooccurrence', signature }
  }
  const secondCheck = validatePortraitClusters(second, values)
  if (secondCheck.ok) {
    await writePortraitClusterCache(signature, input.locale, secondCheck.clusters)
    recordNlgGateOutcome('portrait_cluster', 'accepted')
    return { clusters: secondCheck.clusters, source: 'llm', signature }
  }

  logger.info('Portrait', '画像语义聚类二次校验未过，回退共现且不缓存', {
    reasons: secondCheck.reasons
  })
  recordNlgGateOutcome('portrait_cluster', 'rejected:partition')
  return { clusters: fallback, source: 'cooccurrence', signature }
}
