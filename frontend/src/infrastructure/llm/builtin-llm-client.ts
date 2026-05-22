/**
 * Chrome 内置 LLM 客户端
 *
 * 用于调用 Chrome 浏览器内置的 Gemini Nano 模型
 * 需要 Chrome 127+ 并启用相关 flags
 */
import type {
  BuiltInLLMAPI,
  LLMCapability,
  LLMCompleteOptions,
  LLMCompleteResult
} from '@/types/infrastructure/llm'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Chrome 内置 LLM 客户端
 */
export class BuiltInLLMClient {
  private readonly loggerPrefix = 'BuiltInLLMClient'

  /**
   * 检测 Chrome 内置 LLM 是否可用
   */
  async detectCapability(): Promise<LLMCapability> {
    // Service Worker 环境检查
    if (typeof window === 'undefined') {
      return {
        available: false,
        provider: 'builtin',
        reason: 'Service Worker 环境不支持 window.ai API',
        features: {
          textCompletion: false,
          embedding: false,
          maxTokens: 0,
          streaming: false
        }
      }
    }

    // 检查 API 是否存在
    if (!('ai' in window)) {
      return {
        available: false,
        provider: 'builtin',
        reason: '需要 Chrome 127+ 版本并在 chrome://flags 中启用相关功能',
        features: {
          textCompletion: false,
          embedding: false,
          maxTokens: 0,
          streaming: false
        }
      }
    }

    const ai = window.ai as BuiltInLLMAPI | undefined

    if (!ai) {
      return {
        available: false,
        provider: 'builtin',
        reason: 'window.ai 对象未定义',
        features: {
          textCompletion: false,
          embedding: false,
          maxTokens: 0,
          streaming: false
        }
      }
    }

    // 检查是否可以创建会话
    try {
      const status = await ai.canCreateTextSession()

      if (status === 'readily') {
        logger.info(this.loggerPrefix, 'Chrome 内置 LLM 可用', { status })
        return {
          available: true,
          provider: 'builtin',
          features: {
            textCompletion: true,
            embedding: false, // 内置 LLM 可能不支持 embedding
            maxTokens: 2048, // Gemini Nano 的限制
            streaming: true
          }
        }
      }

      // 其他状态
      return {
        available: false,
        provider: 'builtin',
        reason: `模型状态: ${status}`,
        features: {
          textCompletion: false,
          embedding: false,
          maxTokens: 0,
          streaming: false
        }
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '检测内置 LLM 时出错', error)
      return {
        available: false,
        provider: 'builtin',
        reason: String(error),
        features: {
          textCompletion: false,
          embedding: false,
          maxTokens: 0,
          streaming: false
        }
      }
    }
  }

  /**
   * 检查内置 LLM 是否可用
   */
  async isAvailable(): Promise<boolean> {
    const capability = await this.detectCapability()
    return capability.available
  }

  /**
   * 文本补全
   */
  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    const capability = await this.detectCapability()

    if (!capability.available) {
      throw new Error(`Chrome 内置 LLM 不可用: ${capability.reason || '未知原因'}`)
    }

    const ai = window.ai as BuiltInLLMAPI

    try {
      const session = await ai.createTextSession()

      // 如果有流式输出选项，使用流式接口
      if (options?.streaming) {
        const stream = session.promptStreaming(prompt)
        let fullText = ''

        for await (const chunk of stream) {
          fullText += chunk
        }

        return {
          text: fullText,
          provider: 'builtin'
        }
      }

      // 标准补全
      const text = await session.prompt(prompt)

      return {
        text,
        provider: 'builtin'
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '内置 LLM 补全失败', { error, prompt })
      throw new Error(`内置 LLM 补全失败: ${String(error)}`)
    }
  }

  /**
   * 获取用户启用指南
   */
  getEnableGuide(): {
    title: string
    steps: string[]
    requirements: {
      chromeVersion: string
      storage: string
      gpu: string
      platform: string
    }
  } {
    return {
      title: '启用 Chrome 内置 AI（免费、本地处理）',
      steps: [
        '1. 在地址栏输入 chrome://flags/#prompt-api-for-gemini-nano',
        '2. 设置为 "Enabled"',
        '3. 在地址栏输入 chrome://flags/#optimization-guide-on-device-model',
        '4. 设置为 "Enabled BypassPerfRequirement"',
        '5. 重启浏览器',
        '6. 访问 chrome://components/ 检查模型下载状态',
        '7. 点击 "Optimization Guide On Device Model" 的 "Check for update"',
        '8. 等待模型下载完成（约 22GB）'
      ],
      requirements: {
        chromeVersion: '127+',
        storage: '22GB 可用空间',
        gpu: '4GB 显存',
        platform: '桌面端'
      }
    }
  }
}

/**
 * 单例实例
 */
export const builtInLLMClient = new BuiltInLLMClient()
