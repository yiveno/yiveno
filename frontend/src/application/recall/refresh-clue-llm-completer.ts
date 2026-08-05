/**
 * 注册线索理解 LLM completer。
 * 优先级：关 AI → 空；开发直连 → 直连；Pro+登录 → hosted；
 * 开发构建非 Pro → clue IP 配额代理；正式 Free → 规则。
 */

import { setClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import { createClueUnderstandApiCompleter } from '@/infrastructure/ai/clue-understand-api-client'
import { createHostedClueUnderstandApiCompleter } from '@/infrastructure/ai/hosted-clue-understand-api-client'
import { readDevClueLlmConfig } from '@/infrastructure/ai/dev-clue-llm-config'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { isProActiveFromSnapshot } from '@/infrastructure/identity/subscription-service'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'
import { createOpenAiCompatibleCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

/** 启动时 / AI 开关 / 订阅刷新后挂载线索 LLM。 */
export async function refreshClueLlmCompleterFromDevConfig(): Promise<void> {
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    setClueLlmCompleter(null)
    logger.info('ClueLlm', '用户已关闭 AI 功能，线索理解降级为规则')
    return
  }

  const config = await readDevClueLlmConfig()
  if (config) {
    setClueLlmCompleter(
      createOpenAiCompatibleCompleter({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl ?? 'https://api.deepseek.com',
        model: config.model ?? 'deepseek-chat',
        temperature: 0,
        maxTokens: 400,
        disableThinking: true
      })
    )
    logger.info('ClueLlm', '已启用开发用直连线索理解 LLM（绕过 Cloudflare）', {
      model: config.model ?? 'deepseek-chat'
    })
    return
  }

  if (await isProActiveFromSnapshot()) {
    const session = await getAuthSession()
    if (session?.accessToken) {
      setClueLlmCompleter(
        createHostedClueUnderstandApiCompleter(async () => {
          const latest = await getAuthSession()
          return latest?.accessToken ?? null
        })
      )
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
      logger.info('ClueLlm', '已启用 Pro 托管线索理解（/api/ai/hosted/complete）', {
        apiBase,
        endpoint: `${String(apiBase).replace(/\/$/, '')}/api/ai/hosted/complete`
      })
      return
    }
  }

  // 开发构建：无 Pro 时仍可用 IP 配额 clue 代理（正式 Free = 规则）
  if (import.meta.env.DEV) {
    setClueLlmCompleter(createClueUnderstandApiCompleter())
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
    logger.info('ClueLlm', '开发模式：非 Pro 走 /api/ai/clue/complete（IP 日配额）', {
      apiBase
    })
    return
  }

  setClueLlmCompleter(null)
  logger.info('ClueLlm', '非 Pro 或未登录，线索理解降级为规则（正式路径需 Pro 托管）')
}
