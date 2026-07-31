/**
 * 注册线索理解 LLM completer。
 * 默认走 Cloudflare（Worker 持有 DEEPSEEK_API_KEY）；
 * 若配置了 yiveno.dev.clueLlm 则优先生开直连（仅本地调试）。
 */

import { setClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import { createClueUnderstandApiCompleter } from '@/infrastructure/ai/clue-understand-api-client'
import { readDevClueLlmConfig } from '@/infrastructure/ai/dev-clue-llm-config'
import { logger } from '@/infrastructure/logging/logger'
import { createOpenAiCompatibleCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

/** 启动时挂载线索 LLM。 */
export async function refreshClueLlmCompleterFromDevConfig(): Promise<void> {
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

  setClueLlmCompleter(createClueUnderstandApiCompleter())
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
  logger.info('ClueLlm', '已启用 Cloudflare 线索理解代理（/api/ai/clue/complete）', {
    apiBase,
    endpoint: `${String(apiBase).replace(/\/$/, '')}/api/ai/clue/complete`,
    buildMode: import.meta.env.MODE,
    isDev: import.meta.env.DEV
  })
}
