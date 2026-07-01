/**
 * LLM 统一适配器
 *
 * Provider 优先级：
 * 1. 用户自带 API Key（OpenAI / Claude / Gemini / DeepSeek）- 隐私最优
 * 2. Pro 托管 LLM（DeepSeek V4 Flash）- 默认开箱即用
 */
import type {
  LLMProvider,
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMCapability
} from '@/types/infrastructure/llm'
import { hostedLLMClient } from './hosted-llm-client'
import { userLLMClient } from './user-llm-client'
import { detectAiEngineUiReady } from '@/application/ai/ai-engine-availability'
import { logger } from '@/infrastructure/logging/logger'

/**
 * LLM 适配器
 */
export class LLMAdapter {
  private readonly loggerPrefix = 'LLMAdapter'
  private cachedCapabilities: LLMCapability[] | null = null

  /**
   * 检测所有可用的 LLM 提供者
   */
  async detectCapabilities(): Promise<LLMCapability[]> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities
    }

    const capabilities: LLMCapability[] = []

    const userConfigured = await userLLMClient.isConfigured()
    const userConfig = userConfigured ? await userLLMClient.getConfig() : null
    capabilities.push({
      available: userConfigured,
      provider: (userConfig?.provider as LLMProvider) || 'openai',
      ...(!userConfigured ? { reason: '未配置 API Key' } : {}),
      features: {
        textCompletion: true,
        embedding: userConfig?.provider !== 'claude' && userConfig?.provider !== 'deepseek',
        maxTokens: 128000,
        streaming: false
      }
    })

    const hostedQuota = await hostedLLMClient.fetchQuota()
    capabilities.push({
      available: hostedQuota !== null,
      provider: 'hosted',
      ...(!hostedQuota ? { reason: '需要 Pro 订阅并登录' } : {}),
      features: {
        textCompletion: true,
        embedding: false,
        maxTokens: 128000,
        streaming: false
      }
    })

    this.cachedCapabilities = capabilities
    return capabilities
  }

  /**
   * 清除能力缓存（用户更新 Key 或配额变化后调用）
   */
  clearCapabilitiesCache(): void {
    this.cachedCapabilities = null
    hostedLLMClient.clearQuotaCache()
  }

  /**
   * 选择最优 LLM 提供者
   */
  async selectProvider(): Promise<LLMProvider> {
    if (await userLLMClient.isConfigured()) {
      const config = await userLLMClient.getConfig()
      return (config?.provider as LLMProvider) || 'openai'
    }

    if (await hostedLLMClient.canAttemptHosted()) {
      return 'hosted'
    }

    return 'hosted'
  }

  /**
   * 统一的文本补全接口
   */
  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    const provider = await this.selectProvider()

    if (import.meta.env.DEV) {
      logger.info(this.loggerPrefix, '使用 LLM 提供者', { provider })
    }

    if (await userLLMClient.isConfigured()) {
      try {
        return await userLLMClient.complete(prompt, options)
      } catch (error) {
        logger.warn(this.loggerPrefix, '用户 Key 调用失败', error)
        throw error
      }
    }

    try {
      return await hostedLLMClient.complete(prompt, options)
    } catch (error) {
      logger.error(this.loggerPrefix, '托管 LLM 调用失败', error)
      throw error
    }
  }

  /**
   * 检查是否有可用的 AI 服务（UI 入口用，不依赖 quota 接口）
   */
  async hasAvailableProvider(options?: {
    isPro?: boolean
    isLoggedIn?: boolean
  }): Promise<boolean> {
    if (options?.isPro !== undefined && options?.isLoggedIn !== undefined) {
      return detectAiEngineUiReady({
        isPro: options.isPro,
        isLoggedIn: options.isLoggedIn
      })
    }

    if (await userLLMClient.isConfigured()) {
      return true
    }

    return hostedLLMClient.canAttemptHosted()
  }

  /**
   * 获取当前使用的 provider 描述（用于 UI 展示）
   */
  async getCurrentProviderLabel(): Promise<string> {
    if (await userLLMClient.isConfigured()) {
      const config = await userLLMClient.getConfig()
      const labels: Record<string, string> = {
        openai: 'OpenAI',
        claude: 'Anthropic Claude',
        gemini: 'Google Gemini',
        deepseek: 'DeepSeek'
      }
      return labels[config?.provider || ''] || '用户自定义'
    }

    const quota = await hostedLLMClient.fetchQuota()
    if (quota) {
      return `Yiveno 托管 · ${quota.model}`
    }

    return '未配置'
  }
}

/**
 * 单例实例
 */
export const llmAdapter = new LLMAdapter()
