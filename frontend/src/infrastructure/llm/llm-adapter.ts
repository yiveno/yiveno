/**
 * LLM 统一适配器
 *
 * Provider 优先级：
 * 1. 用户自带 API Key（OpenAI / Claude / Gemini / DeepSeek）- 隐私最优，数据不经过产品服务器
 * 2. Chrome Built-in LLM - 极端 fallback（覆盖率低，功能受限）
 *
 * 降级策略：
 * 用户有 Key → 直接调第三方 API
 * 用户无 Key → Chrome Built-in（如果可用）
 * 两者都不可用 → 抛出错误，上层降级到本地 Fuse.js 搜索
 */
import type {
  LLMProvider,
  LLMTask,
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMCapability
} from '@/types/infrastructure/llm'
import { builtInLLMClient } from './builtin-llm-client'
import { userLLMClient } from './user-llm-client'
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

    // 1. 用户自带 API Key（最高优先级）
    const userConfigured = await userLLMClient.isConfigured()
    const userConfig = userConfigured ? await userLLMClient.getConfig() : null
    capabilities.push({
      available: userConfigured,
      provider: (userConfig?.provider as LLMProvider) || 'openai',
      ...(!userConfigured ? { reason: '未配置 API Key，请在设置页面填写' } : {}),
      features: {
        textCompletion: true,
        embedding: userConfig?.provider !== 'claude' && userConfig?.provider !== 'deepseek',
        maxTokens: 128000,
        streaming: false
      }
    })

    // 2. Chrome 内置 LLM（极端 fallback）
    const builtinCapability = await builtInLLMClient.detectCapability()
    capabilities.push(builtinCapability)

    this.cachedCapabilities = capabilities
    return capabilities
  }

  /**
   * 清除能力缓存（用户更新 Key 后调用）
   */
  clearCapabilitiesCache(): void {
    this.cachedCapabilities = null
  }

  /**
   * 选择最优 LLM 提供者
   *
   * 优先级：用户 Key > Built-in
   */
  async selectProvider(_task: LLMTask): Promise<LLMProvider> {
    // 优先使用用户自带 Key
    const userConfigured = await userLLMClient.isConfigured()
    if (userConfigured) {
      const config = await userLLMClient.getConfig()
      return (config?.provider as LLMProvider) || 'openai'
    }

    // 最后尝试 Built-in
    const builtinAvailable = await builtInLLMClient.isAvailable()
    if (builtinAvailable) {
      return 'builtin'
    }

    // 全部不可用，返回 openai 让调用方处理错误
    return 'openai'
  }

  /**
   * 统一的文本补全接口
   */
  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    const task: LLMTask = {
      type: 'categorize',
      complexity: prompt.length < 500 ? 'simple' : 'complex',
      dataSize: prompt.length
    }

    const provider = await this.selectProvider(task)

    if (import.meta.env.DEV) {
      logger.info(this.loggerPrefix, '使用 LLM 提供者', { provider })
    }

    // 1. 用户自带 Key
    const userConfigured = await userLLMClient.isConfigured()
    if (userConfigured) {
      try {
        return await userLLMClient.complete(prompt, options)
      } catch (error) {
        logger.warn(this.loggerPrefix, '用户 Key 调用失败', error)
        throw error
      }
    }

    // 2. Chrome Built-in LLM（极端 fallback）
    try {
      const builtinAvailable = await builtInLLMClient.isAvailable()
      if (builtinAvailable) {
        return await builtInLLMClient.complete(prompt, options)
      }
    } catch (error) {
      logger.error(this.loggerPrefix, 'Built-in LLM 也失败', error)
    }

    throw new Error(
      '没有可用的 AI 服务。请在设置页面配置您的 API Key（支持 OpenAI / Claude / Gemini / DeepSeek）'
    )
  }

  /**
   * 检查是否有可用的 AI 服务
   */
  async hasAvailableProvider(): Promise<boolean> {
    const userConfigured = await userLLMClient.isConfigured()
    if (userConfigured) return true

    return await builtInLLMClient.isAvailable()
  }

  /**
   * 获取当前使用的 provider 描述（用于 UI 展示）
   */
  async getCurrentProviderLabel(): Promise<string> {
    const userConfigured = await userLLMClient.isConfigured()
    if (userConfigured) {
      const config = await userLLMClient.getConfig()
      const labels: Record<string, string> = {
        openai: 'OpenAI',
        claude: 'Anthropic Claude',
        gemini: 'Google Gemini',
        deepseek: 'DeepSeek'
      }
      return labels[config?.provider || ''] || '用户自定义'
    }

    return '未配置'
  }

  /**
   * 检查 Chrome 内置 LLM 是否可用
   */
  async isBuiltInLLMAvailable(): Promise<boolean> {
    return await builtInLLMClient.isAvailable()
  }

  /**
   * 获取 Chrome 内置 LLM 启用指南
   */
  getBuiltInLLMGuide() {
    return builtInLLMClient.getEnableGuide()
  }
}

/**
 * 单例实例
 */
export const llmAdapter = new LLMAdapter()
