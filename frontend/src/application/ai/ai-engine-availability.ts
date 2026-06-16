/**
 * AI 引擎 UI 可用性（展示入口 / 开关，不发起托管配额请求）
 */

import { userLLMClient } from '@/infrastructure/llm/user-llm-client'

export interface AiEngineUiReadyInput {
  /** 是否已配置用户自带 API Key */
  hasApiKey: boolean
  /** 是否为有效 Pro 订阅 */
  isPro: boolean
  /** 是否已登录 Supabase */
  isLoggedIn: boolean
}

/**
 * 是否应在 UI 展示/启用 Pro 托管 LLM 相关能力
 *
 * 与设置页「功能开关」一致：Pro + 登录即可，不依赖 quota 接口是否可达。
 */
export function isAiEngineUiReady(input: AiEngineUiReadyInput): boolean {
  if (input.hasApiKey) return true
  return input.isPro && input.isLoggedIn
}

/**
 * 检测 AI 引擎 UI 是否可用（含 API Key 探测）
 */
export async function detectAiEngineUiReady(
  input: Omit<AiEngineUiReadyInput, 'hasApiKey'>
): Promise<boolean> {
  const hasApiKey = await userLLMClient.isConfigured()
  return isAiEngineUiReady({ ...input, hasApiKey })
}
