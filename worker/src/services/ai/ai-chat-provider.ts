/**
 * Worker 侧聊天补全 Provider 抽象。
 * Handler 只依赖本接口；具体厂商由 AI_PROVIDER 选择（默认 deepseek）。
 */

import type { AiChatTaskKind } from '../../config/ai-task-kind'
import type { Env } from '../../types/env'
import { AiProviderError } from './ai-provider-error'
import { deepseekAiChatProvider } from './deepseek-ai-chat-provider'
import { gatewayCompatAiChatProvider } from './gateway-compat-ai-chat-provider'

/** 聊天消息角色。 */
export type AiChatRole = 'system' | 'user' | 'assistant'

export type AiChatMessage = {
  role: AiChatRole
  content: string
}

/** 路由优先级：交互路径 vs 后台批处理。 */
export type AiChatRequestPriority = 'interactive' | 'background'

/** 统一补全请求（任务无关）。 */
export type AiChatCompleteRequest = {
  /** 无 messages 时使用的单轮 user 文本 */
  prompt?: string
  messages?: AiChatMessage[]
  maxTokens?: number
  temperature?: number
  /** 关闭思考链（结构化 JSON 场景建议 true） */
  disableThinking?: boolean
  /**
   * 上游模型名（由 handler 经 resolveHostedModelForTask 注入）。
   * 缺省时 provider 回退 resolveHostedModel(env)。
   */
  model?: string
  /**
   * 路由上下文（Batch 2）：taskKind / priority / requestId。
   * Provider adapter 忽略；由 resolveAiChatCompleter 消费。
   */
  taskKind?: AiChatTaskKind
  /** 缺省 interactive */
  priority?: AiChatRequestPriority
  /** 可选关联 id（决策日志） */
  requestId?: string
}

/** 统一补全结果。 */
export type AiChatCompleteResult = {
  text: string
  model: string
  /** Provider 稳定 id，如 deepseek */
  providerId: string
  /** 合计 token（兼容旧字段；缺省不推算）。 */
  tokensUsed?: number
  /** prompt 侧 token；上游未返回则缺省。 */
  promptTokens?: number
  /** completion 侧 token；上游未返回则缺省。 */
  completionTokens?: number
  /** 路由尝试次数（Batch 2；single 缺省可不填） */
  attempts?: number
  /** 回退原因（Batch 2 quota 模式预留） */
  fallbackReason?: string
}

/**
 * 可插拔聊天补全实现。
 * - isConfigured：Secret / 绑定是否齐全
 * - complete：发起上游调用
 */
export interface AiChatProvider {
  readonly id: string
  isConfigured(env: Env): boolean
  complete(env: Env, request: AiChatCompleteRequest): Promise<AiChatCompleteResult>
}

/**
 * 从 env 解析当前 Provider（未知值抛错，避免静默落到错误上游）。
 * 未设置或空字符串 → deepseek。
 */
export function resolveAiChatProvider(env: Env): AiChatProvider {
  const raw = (env.AI_PROVIDER ?? 'deepseek').trim().toLowerCase()
  switch (raw) {
    case '':
    case 'deepseek':
      return deepseekAiChatProvider
    case 'gateway-compat':
      return gatewayCompatAiChatProvider
    default:
      throw new AiProviderError({
        kind: 'misconfigured',
        providerId: 'unknown',
        causeMessage: `ai_provider_unsupported:${raw}`
      })
  }
}

/** 当前 Provider 是否已配置可用。 */
export function isAiChatProviderConfigured(env: Env): boolean {
  try {
    return resolveAiChatProvider(env).isConfigured(env)
  } catch {
    return false
  }
}
