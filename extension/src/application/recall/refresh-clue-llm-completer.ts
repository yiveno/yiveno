/**
 * 注册线索理解 LLM completer。
 * 优先级：关 AI → 空；开发直连 → 直连；已登录 → hosted（Free/Pro 配额分档）；
 * 开发构建未登录 → clue IP 配额代理；正式未登录 → 规则。
 */

import {
  setClueLlmCompleter,
  setClueLlmCompleterDetailed
} from '@/application/recall/clue-llm-completer-registry'
import {
  createClueUnderstandApiCompleter,
  createClueUnderstandApiCompleterDetailed
} from '@/infrastructure/ai/clue-understand-api-client'
import {
  createHostedClueUnderstandApiCompleter,
  createHostedClueUnderstandApiCompleterDetailed
} from '@/infrastructure/ai/hosted-clue-understand-api-client'
import { readDevClueLlmConfig } from '@/infrastructure/ai/dev-clue-llm-config'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'
import {
  createOpenAiCompatibleCompleter,
  createOpenAiCompatibleCompleterDetailed
} from '@/core/recall/understand/parse-recall-clue-with-llm'

/** 启动时 / AI 开关 / 订阅刷新后挂载线索 LLM。 */
export async function refreshClueLlmCompleterFromDevConfig(): Promise<void> {
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    setClueLlmCompleter(null)
    setClueLlmCompleterDetailed(null)
    logger.info('ClueLlm', '用户已关闭 AI 功能，线索理解降级为规则')
    return
  }

  const config = await readDevClueLlmConfig()
  if (config) {
    const shared = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.deepseek.com',
      model: config.model ?? 'deepseek-chat',
      temperature: 0,
      maxTokens: 400,
      disableThinking: true
    }
    setClueLlmCompleter(createOpenAiCompatibleCompleter(shared))
    setClueLlmCompleterDetailed(createOpenAiCompatibleCompleterDetailed(shared))
    logger.info('ClueLlm', '已启用开发用直连线索理解 LLM（绕过 Cloudflare）', {
      model: config.model ?? 'deepseek-chat'
    })
    return
  }

  // 有 device token（或迁移窗口旧 access）→ hosted；无则匿名 rules / DEV IP
  const bearer = await getWorkerApiAccessToken()
  if (bearer) {
    const accessTokenProvider = async () => getWorkerApiAccessToken()
    setClueLlmCompleter(createHostedClueUnderstandApiCompleter(accessTokenProvider))
    setClueLlmCompleterDetailed(createHostedClueUnderstandApiCompleterDetailed(accessTokenProvider))
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
    logger.info('ClueLlm', '已启用托管线索理解（/api/ai/hosted/complete，登录 Free/Pro 配额）', {
      apiBase,
      endpoint: `${String(apiBase).replace(/\/$/, '')}/api/ai/hosted/complete`
    })
    return
  }

  // 开发构建：未登录仍可用 IP 配额 clue 代理
  if (import.meta.env.DEV) {
    setClueLlmCompleter(createClueUnderstandApiCompleter())
    setClueLlmCompleterDetailed(createClueUnderstandApiCompleterDetailed())
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
    logger.info('ClueLlm', '开发模式：未登录走 /api/ai/clue/complete（IP 日配额）', {
      apiBase
    })
    return
  }

  setClueLlmCompleter(null)
  setClueLlmCompleterDetailed(null)
  logger.info('ClueLlm', '未登录，线索理解降级为规则（正式托管须登录）')
}
