/**
 * 用户自带 API Key 的 LLM 客户端
 *
 * 支持 OpenAI / Anthropic Claude / Google Gemini / DeepSeek
 * 请求从用户浏览器直接发往 AI 服务商，不经过产品服务器
 * 隐私优先：书签数据只在用户设备和用户选择的 AI 服务商之间流动
 */
import type {
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMEmbeddingResult,
  LLMProvider
} from '@/types/infrastructure/llm'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 支持的第三方 AI 服务商
 */
export type UserLLMProvider = 'openai' | 'claude' | 'gemini' | 'deepseek'

/**
 * 用户 API Key 配置
 */
export interface UserAPIKeyConfig {
  /** 服务商 */
  provider: UserLLMProvider
  /** API Key */
  apiKey: string
  /** 自定义模型（可选，使用默认模型时留空） */
  model?: string
}

/**
 * 各服务商默认配置
 */
const PROVIDER_DEFAULTS: Record<
  UserLLMProvider,
  { baseUrl: string; completionModel: string; embeddingModel: string }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    completionModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small'
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    completionModel: 'claude-3-haiku-20240307',
    embeddingModel: '' // Claude 暂不支持 embedding，降级到 OpenAI
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    completionModel: 'gemini-2.0-flash',
    embeddingModel: 'text-embedding-004'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    completionModel: 'deepseek-chat',
    embeddingModel: '' // DeepSeek 暂不支持 embedding，降级到 OpenAI
  }
}

/**
 * 将 HTTP 状态码翻译为用户友好的错误信息
 */
function friendlyError(provider: UserLLMProvider, status: number, rawMessage: string): string {
  const providerName: Record<UserLLMProvider, string> = {
    openai: 'OpenAI',
    claude: 'Anthropic Claude',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek'
  }
  const name = providerName[provider]

  // Gemini 特殊处理：区分 AI Studio Key 和 Cloud Console Key
  if (provider === 'gemini') {
    if (status === 400 || status === 404) {
      return `API Key 类型不匹配。请使用 Google AI Studio（aistudio.google.com）申请的 Key（AIza 开头），而非 Google Cloud Console 的 Key`
    }
    if (status === 429) {
      return `请求频率超限或免费额度已用完，请稍后重试。如需更高额度请前往 aistudio.google.com 查看配额`
    }
  }

  // DeepSeek 特殊处理
  if (provider === 'deepseek') {
    if (status === 401) {
      return `DeepSeek API Key 无效或已过期，请前往 platform.deepseek.com 检查您的 Key`
    }
    if (status === 429) {
      return `DeepSeek 请求频率超限或余额不足，请稍后重试或前往 platform.deepseek.com 充值`
    }
  }

  const common: Record<number, string> = {
    401: `API Key 无效或已过期，请检查 ${name} 控制台中的 Key 是否正确`,
    403: `API Key 没有权限，请确认 ${name} 账号已开通 API 访问`,
    429: `请求频率超限或免费额度已用完，请稍后重试或在 ${name} 控制台充值`,
    500: `${name} 服务器内部错误，请稍后重试`,
    503: `${name} 服务暂时不可用，请稍后重试`
  }

  return common[status] ?? `${name} 返回错误 ${status}：${rawMessage}`
}

/**
 * 用户自带 API Key 的 LLM 客户端
 */
export class UserLLMClient {
  private readonly loggerPrefix = 'UserLLMClient'

  /**
   * 从 chrome.storage.local 读取用户 API Key 配置
   */
  async getConfig(): Promise<UserAPIKeyConfig | null> {
    try {
      const result = await chrome.storage.local.get('USER_AI_CONFIG')
      const config = result['USER_AI_CONFIG'] as UserAPIKeyConfig | undefined
      if (!config || !config.apiKey || !config.provider) {
        return null
      }
      return {
        provider: config.provider,
        apiKey: config.apiKey,
        ...(config.model ? { model: config.model } : {})
      }
    } catch (error) {
      logger.warn(this.loggerPrefix, '读取用户 AI 配置失败', error)
      return null
    }
  }

  /**
   * 保存用户 API Key 配置到 chrome.storage.local
   */
  async saveConfig(config: UserAPIKeyConfig): Promise<void> {
    const payload: UserAPIKeyConfig = {
      provider: config.provider,
      apiKey: config.apiKey,
      ...(config.model ? { model: config.model } : {})
    }
    await chrome.storage.local.set({ USER_AI_CONFIG: payload })
    logger.info(this.loggerPrefix, '用户 AI 配置已保存', {
      provider: config.provider
    })
  }

  /**
   * 清除用户 API Key 配置
   */
  async clearConfig(): Promise<void> {
    await chrome.storage.local.remove('USER_AI_CONFIG')
    logger.info(this.loggerPrefix, '用户 AI 配置已清除')
  }

  /**
   * 检查用户是否已配置 AI 服务
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig()
    return config !== null
  }

  /**
   * 通用的 fetch 错误处理
   */
  private async _handleFetchError(response: Response, provider: UserLLMProvider): Promise<never> {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      friendlyError(provider, response.status, err?.error?.message || response.statusText)
    )
  }

  /**
   * 文本补全
   */
  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    const config = await this.getConfig()
    if (!config) {
      throw new Error('未配置 API Key，请在设置页面填写您的 AI 服务商 Key')
    }

    switch (config.provider) {
      case 'openai':
        return this._completeOpenAI(prompt, config, options)
      case 'claude':
        return this._completeClaude(prompt, config, options)
      case 'gemini':
        return this._completeGemini(prompt, config, options)
      case 'deepseek':
        return this._completeDeepSeek(prompt, config, options)
      default:
        throw new Error(`不支持的 AI 服务商: ${config.provider}`)
    }
  }

  /**
   * 生成向量嵌入
   */
  async generateEmbedding(text: string): Promise<LLMEmbeddingResult> {
    const config = await this.getConfig()
    if (!config) {
      throw new Error('未配置 API Key，请在设置页面填写您的 AI 服务商 Key')
    }

    switch (config.provider) {
      case 'openai':
        return this._embeddingOpenAI(text, config)
      case 'gemini':
        return this._embeddingGemini(text, config)
      case 'claude':
        // Claude 不支持 embedding，抛出错误让上层降级
        throw new Error('Claude 暂不支持向量嵌入，请切换到 OpenAI 或 Gemini')
      case 'deepseek':
        // DeepSeek 不支持 embedding，抛出错误让上层降级
        throw new Error('DeepSeek 暂不支持向量嵌入，请切换到 OpenAI 或 Gemini')
      default:
        throw new Error(`不支持的 AI 服务商: ${config.provider}`)
    }
  }

  // ─── OpenAI ───────────────────────────────────────────────────────────────

  private async _sendOpenAICompletion(
    prompt: string,
    config: UserAPIKeyConfig,
    options: LLMCompleteOptions | undefined,
    path: string
  ): Promise<Response> {
    const defaults = PROVIDER_DEFAULTS.openai
    const model = config.model || defaults.completionModel
    const response = await fetch(`${defaults.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens ?? 256,
        temperature: options?.temperature ?? 0.6
      })
    })
    if (!response.ok) await this._handleFetchError(response, 'openai')
    return response
  }

  private async _completeOpenAI(
    prompt: string,
    config: UserAPIKeyConfig,
    options?: LLMCompleteOptions
  ): Promise<LLMCompleteResult> {
    const response = await this._sendOpenAICompletion(prompt, config, options, '/chat/completions')
    const data = await response.json()
    return {
      text: data.choices?.[0]?.message?.content?.trim() || '',
      provider: 'openai' as LLMProvider,
      tokensUsed: data.usage?.total_tokens
    }
  }

  private async _embeddingOpenAI(
    text: string,
    config: UserAPIKeyConfig
  ): Promise<LLMEmbeddingResult> {
    const defaults = PROVIDER_DEFAULTS.openai
    const model = defaults.embeddingModel

    const response = await fetch(`${defaults.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({ model, input: text.trim() })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(
        friendlyError('openai', response.status, err?.error?.message || response.statusText)
      )
    }

    const data = await response.json()
    const vector: number[] = data.data?.[0]?.embedding || []

    if (vector.length === 0) {
      throw new Error('OpenAI 返回的向量为空')
    }

    return {
      vector,
      provider: 'openai' as LLMProvider,
      dimensions: vector.length
    }
  }

  // ─── Claude ───────────────────────────────────────────────────────────────

  private async _sendClaudeCompletion(
    prompt: string,
    config: UserAPIKeyConfig,
    options: LLMCompleteOptions | undefined
  ): Promise<Response> {
    const defaults = PROVIDER_DEFAULTS.claude
    const model = config.model || defaults.completionModel
    const response = await fetch(`${defaults.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens ?? 256,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!response.ok) await this._handleFetchError(response, 'claude')
    return response
  }

  private async _completeClaude(
    prompt: string,
    config: UserAPIKeyConfig,
    options?: LLMCompleteOptions
  ): Promise<LLMCompleteResult> {
    const response = await this._sendClaudeCompletion(prompt, config, options)
    const data = await response.json()
    return {
      text: data.content?.[0]?.text?.trim() || '',
      provider: 'claude' as LLMProvider,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens
    }
  }

  // ─── Gemini ───────────────────────────────────────────────────────────────

  private async _sendGeminiCompletion(
    prompt: string,
    config: UserAPIKeyConfig,
    options: LLMCompleteOptions | undefined
  ): Promise<Response> {
    const defaults = PROVIDER_DEFAULTS.gemini
    const model = config.model || defaults.completionModel
    const response = await fetch(
      `${defaults.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options?.maxTokens ?? 256,
            temperature: options?.temperature ?? 0.6
          }
        })
      }
    )
    if (!response.ok) await this._handleFetchError(response, 'gemini')
    return response
  }

  private async _completeGemini(
    prompt: string,
    config: UserAPIKeyConfig,
    options?: LLMCompleteOptions
  ): Promise<LLMCompleteResult> {
    const response = await this._sendGeminiCompletion(prompt, config, options)
    const data = await response.json()
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '',
      provider: 'gemini' as LLMProvider,
      tokensUsed: data.usageMetadata?.totalTokenCount
    }
  }

  private async _embeddingGemini(
    text: string,
    config: UserAPIKeyConfig
  ): Promise<LLMEmbeddingResult> {
    const defaults = PROVIDER_DEFAULTS.gemini
    const model = defaults.embeddingModel

    const response = await fetch(
      `${defaults.baseUrl}/models/${model}:embedContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text: text.trim() }] }
        })
      }
    )

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(
        friendlyError('gemini', response.status, err?.error?.message || response.statusText)
      )
    }

    const data = await response.json()
    const vector: number[] = data.embedding?.values || []

    if (vector.length === 0) {
      throw new Error('Gemini 返回的向量为空')
    }

    return {
      vector,
      provider: 'gemini' as LLMProvider,
      dimensions: vector.length
    }
  }

  // ─── DeepSeek ─────────────────────────────────────────────────────────────

  private async _sendDeepSeekCompletion(
    prompt: string,
    config: UserAPIKeyConfig,
    options: LLMCompleteOptions | undefined,
    path: string
  ): Promise<Response> {
    const defaults = PROVIDER_DEFAULTS.deepseek
    const model = config.model || defaults.completionModel
    const response = await fetch(`${defaults.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens ?? 256,
        temperature: options?.temperature ?? 0.6
      })
    })
    if (!response.ok) await this._handleFetchError(response, 'deepseek')
    return response
  }

  private async _completeDeepSeek(
    prompt: string,
    config: UserAPIKeyConfig,
    options?: LLMCompleteOptions
  ): Promise<LLMCompleteResult> {
    const response = await this._sendDeepSeekCompletion(
      prompt,
      config,
      options,
      '/chat/completions'
    )
    const data = await response.json()
    return {
      text: data.choices?.[0]?.message?.content?.trim() || '',
      provider: 'deepseek' as LLMProvider,
      tokensUsed: data.usage?.total_tokens
    }
  }
}

/**
 * 单例实例
 */
export const userLLMClient = new UserLLMClient()
