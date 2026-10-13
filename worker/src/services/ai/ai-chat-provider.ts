/**
 * Worker 侧聊天补全 Provider 抽象。
 * Handler 只依赖本接口；具体厂商由 AI_PROVIDER 选择（默认 deepseek）。
 */

import type { Env } from '../../types/env'
import { deepseekAiChatProvider } from './deepseek-ai-chat-provider'

/** 聊天消息角色。 */
export type AiChatRole = 'system' | 'user' | 'assistant'

export type AiChatMessage = {
  role: AiChatRole
  content: string
}

/** 统一补全请求（任务无关）。 */
export type AiChatCompleteRequest = {
  /** 无 messages 时使用的单轮 user 文本 */
  prompt?: string
  messages?: AiChatMessage[]
  maxTokens?: number
  temperature?: number
  /** 关闭思考链（结构化 JSON 场景建议 true） */
  disableThinking?: boolean
}

/** 统一补全结果。 */
export type AiChatCompleteResult = {
  text: string
  model: string
  /** Provider 稳定 id，如 deepseek */
  providerId: string
  tokensUsed?: number
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
    default:
      throw new Error(`ai_provider_unsupported:${raw}`)
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
