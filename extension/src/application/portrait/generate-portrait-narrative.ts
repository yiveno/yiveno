/**
 * 画像摘要 LLM 自然语言组装：生成 → 校验 →（失败则纠正重试一次）→ 缓存。
 * 失败 / 超时 / 配额 / 空 / 超长 2× / 两次校验不过 → 回退确定性 summaryText，不报错。
 */

import {
  buildPortraitNarrativeContentPoints,
  buildPortraitNarrativeMessages,
  type PortraitNarrativeContentPoints
} from '@/core/portrait/portrait-narrative-prompt'
import type { PortraitSummaryGroup } from '@/core/portrait/build-portrait-summary'
import type { PortraitSummaryViewModel } from '@/core/portrait/render-portrait-summary'
import {
  measurePortraitNarrativeLength,
  portraitNarrativeLengthLimit,
  validatePortraitNarrative
} from '@/core/portrait/validate-portrait-narrative'
import type { UiLocaleId } from '@/core/i18n/ui-locale'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import { createHostedClueUnderstandApiCompleter } from '@/infrastructure/ai/hosted-clue-understand-api-client'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import {
  readPortraitNarrativeCache,
  writePortraitNarrativeCache
} from '@/infrastructure/storage/portrait-narrative-cache-storage'
import { logger } from '@/infrastructure/logging/logger'

export type GeneratePortraitNarrativeInput = {
  view: PortraitSummaryViewModel
  locale: UiLocaleId
  /** 单测注入；缺省走 registry 或扩展页现建 hosted completer */
  complete?: LlmChatCompleter | null
}

export type GeneratePortraitNarrativeResult = {
  text: string
  source: 'cache' | 'llm' | 'deterministic'
}

/** 从视图模型抽取内容点。 */
export function contentPointsFromPortraitView(
  view: PortraitSummaryViewModel,
  locale: UiLocaleId
): PortraitNarrativeContentPoints {
  const groupOrder: PortraitSummaryGroup[] = [
    'verified',
    'corroborated',
    'unconfirmed',
    'contested'
  ]
  const groups = groupOrder
    .map(key => {
      const group = view.groups.find(g => g.key === key)
      if (!group) {
        return null
      }
      const sorted = [...group.items].sort((a, b) => b.credibility - a.credibility)
      return {
        key,
        values: sorted.map(i => i.value).slice(0, 5),
        total: group.items.length
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  const contested = view.groups.find(g => g.key === 'contested')
  return buildPortraitNarrativeContentPoints({
    locale,
    groups,
    pendingValues: view.pendingInferences.map(p => p.value),
    contestedValues: contested?.items.map(i => i.value) ?? []
  })
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
  points: PortraitNarrativeContentPoints,
  correctionReasons?: string[]
): Promise<string | null> {
  const messages = buildPortraitNarrativeMessages(
    points,
    correctionReasons ? { correctionReasons } : undefined
  )
  try {
    const raw = await complete(messages, { taskKind: 'portrait_narrative' })
    const text = raw.trim()
    if (!text) {
      return null
    }
    const limit = portraitNarrativeLengthLimit(points.locale)
    if (measurePortraitNarrativeLength(text, points.locale) > limit * 2) {
      logger.info('Portrait', '画像叙事 LLM 输出超长 2×，回退确定性文案', {
        locale: points.locale,
        limit
      })
      return null
    }
    return text
  } catch (error) {
    logger.info('Portrait', '画像叙事 LLM 调用失败，回退确定性文案', {
      message: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * 生成画像总述：缓存命中 → LLM（校验+最多一次纠正）→ 确定性 summaryText。
 */
export async function generatePortraitNarrative(
  input: GeneratePortraitNarrativeInput
): Promise<GeneratePortraitNarrativeResult> {
  const { view, locale } = input
  const fallback = view.summaryText
  if (view.empty) {
    return { text: '', source: 'deterministic' }
  }

  const signature = view.factSignature
  if (signature) {
    const cached = await readPortraitNarrativeCache(signature, locale)
    if (cached) {
      return { text: cached, source: 'cache' }
    }
  }

  const complete = await resolveCompleter(input.complete)
  if (!complete) {
    return { text: fallback, source: 'deterministic' }
  }

  const points = contentPointsFromPortraitView(view, locale)
  const first = await completeOnce(complete, points)
  if (!first) {
    return { text: fallback, source: 'deterministic' }
  }

  const firstCheck = validatePortraitNarrative(first, points, locale)
  if (firstCheck.ok) {
    if (signature) {
      await writePortraitNarrativeCache(signature, locale, first)
    }
    return { text: first, source: 'llm' }
  }

  logger.info('Portrait', '画像叙事首次校验未过，纠正重试', {
    reasons: firstCheck.reasons
  })

  const second = await completeOnce(complete, points, firstCheck.reasons)
  if (!second) {
    return { text: fallback, source: 'deterministic' }
  }
  const secondCheck = validatePortraitNarrative(second, points, locale)
  if (secondCheck.ok) {
    if (signature) {
      await writePortraitNarrativeCache(signature, locale, second)
    }
    return { text: second, source: 'llm' }
  }

  logger.info('Portrait', '画像叙事二次校验未过，回退确定性文案且不缓存', {
    reasons: secondCheck.reasons
  })
  return { text: fallback, source: 'deterministic' }
}
