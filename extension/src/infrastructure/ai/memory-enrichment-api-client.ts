/**
 * Capture enrichment：经 Cloudflare Worker 拉取结构化提议（扩展不持有 API Key）。
 * 调用方负责 mergeMemoryClueEnrichment 后写 IndexedDB；本模块不落库。
 */

import {
  parseMemoryEnrichmentProposal,
  type MemoryEnrichmentProposal
} from '@/core/memory/memory-enrichment-proposal'
import type { MemoryClueEnrichment } from '@/core/memory/enrich-memory-clues'
import { resolveApiBaseUrl } from '@/infrastructure/ai/clue-understand-api-client'
import { logger } from '@/infrastructure/logging/logger'

export type MemoryEnrichmentCompleteInput = {
  title?: string
  text?: string
  url?: string
  domain?: string
  note?: string
  ruleHints?: Pick<MemoryClueEnrichment, 'tags' | 'keywords' | 'entities'>
}

export type MemoryEnrichmentCompleteResult = {
  proposal: MemoryEnrichmentProposal
  model?: string
  providerId?: string
  tokensUsed?: number
}

type EnrichmentApiResponse = {
  proposal?: unknown
  error?: string
  model?: string
  providerId?: string
  tokensUsed?: number
}

/**
 * 请求 `/api/ai/enrichment/complete`；失败抛错，由调用方降级规则-only。
 */
export async function requestMemoryEnrichmentProposal(
  input: MemoryEnrichmentCompleteInput,
  apiBaseUrl: string = resolveApiBaseUrl()
): Promise<MemoryEnrichmentCompleteResult> {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/enrichment/complete`

  logger.info('MemoryEnrichment', '提议请求开始', {
    url,
    titlePreview: input.title?.slice(0, 48),
    hasRuleHints: Boolean(input.ruleHints)
  })
  const startedAt = Date.now()

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
  } catch (error) {
    logger.error('MemoryEnrichment', '提议请求网络失败', {
      url,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  const payload = (await response.json().catch(() => ({}))) as EnrichmentApiResponse
  if (!response.ok) {
    logger.warn('MemoryEnrichment', '提议请求非 2xx', {
      url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      error: payload.error ?? response.statusText
    })
    throw new Error(payload.error || response.statusText || 'enrichment_complete_failed')
  }

  const proposal = parseMemoryEnrichmentProposal(payload.proposal)
  if (!proposal) {
    logger.warn('MemoryEnrichment', '提议响应未通过 Zod', {
      url,
      durationMs: Date.now() - startedAt,
      model: payload.model
    })
    throw new Error('enrichment_proposal_invalid')
  }

  logger.info('MemoryEnrichment', '提议请求成功', {
    url,
    status: response.status,
    durationMs: Date.now() - startedAt,
    model: payload.model,
    providerId: payload.providerId,
    tokensUsed: payload.tokensUsed,
    keywordCount: proposal.keywords?.length ?? 0,
    entityCount: proposal.entities?.length ?? 0,
    hasSummary: Boolean(proposal.summary)
  })

  return {
    proposal,
    ...(payload.model !== undefined ? { model: payload.model } : {}),
    ...(payload.providerId !== undefined ? { providerId: payload.providerId } : {}),
    ...(payload.tokensUsed !== undefined ? { tokensUsed: payload.tokensUsed } : {})
  }
}
