/**
 * Pro 托管 LLM 客户端
 *
 * 通过 otterSage 后端代理 DeepSeek，配额由服务端控制。
 */

import { API_CONFIG } from '@/config/constants'
import { getSupabaseAccessToken } from '@/infrastructure/auth/supabase-access-token'
import { logger } from '@/infrastructure/logging/logger'
import type { LLMCompleteOptions, LLMCompleteResult } from '@/types/infrastructure/llm'

export interface HostedQuotaInfo {
  model: string
  used: number
  limit: number
  remaining: number
  monthKey: string
}

interface HostedCompleteResponse {
  text: string
  provider: 'hosted'
  model: string
  tokensUsed?: number
  quota?: {
    used: number
    limit: number
    remaining: number
  }
  error?: string
}

/**
 * 将 fetch 网络错误转为可操作的提示（本地 Worker 未启动等）
 */
function formatHostedFetchError(error: unknown): Error {
  const apiBase = API_CONFIG.API_BASE
  const isLocalApi = apiBase.includes('localhost') || apiBase.includes('127.0.0.1')

  if (error instanceof TypeError && isLocalApi) {
    return new Error(
      `无法连接本地 API（${apiBase}）。请运行「cd backend && bun run dev」，或在 .env.development.local 设置 VITE_API_BASE_URL=https://api.ottersage.com 后执行 bun run env:sync:dev 并重建扩展`
    )
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('托管 AI 网络请求失败，请检查网络或 API 配置')
}

interface HostedQuotaResponse extends HostedQuotaInfo {
  error?: string
}

/**
 * Pro 托管 LLM 客户端
 */
export class HostedLLMClient {
  private readonly loggerPrefix = 'HostedLLMClient'
  private cachedQuota: HostedQuotaInfo | null = null

  /**
   * 检查是否具备调用托管 LLM 的前置条件（已登录）
   */
  async canAttemptHosted(): Promise<boolean> {
    const token = await getSupabaseAccessToken()
    return Boolean(token)
  }

  /**
   * 查询服务端配额（同时验证 Pro 资格）
   */
  async fetchQuota(forceRefresh = false): Promise<HostedQuotaInfo | null> {
    if (!forceRefresh && this.cachedQuota) {
      return this.cachedQuota
    }

    const token = await getSupabaseAccessToken()
    if (!token) {
      return null
    }

    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/api/ai/hosted/quota`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as HostedQuotaResponse
      this.cachedQuota = {
        model: data.model,
        used: data.used,
        limit: data.limit,
        remaining: data.remaining,
        monthKey: data.monthKey
      }
      return this.cachedQuota
    } catch (error) {
      logger.warn(this.loggerPrefix, '查询托管配额失败', error)
      return null
    }
  }

  /**
   * 清除配额缓存
   */
  clearQuotaCache(): void {
    this.cachedQuota = null
  }

  /**
   * 文本补全
   */
  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    const token = await getSupabaseAccessToken()
    if (!token) {
      throw new Error('请先登录后使用 otterSage 托管 AI')
    }

    let response: Response
    try {
      response = await fetch(`${API_CONFIG.API_BASE}/api/ai/hosted/complete`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt,
          maxTokens: options?.maxTokens,
          temperature: options?.temperature
        })
      })
    } catch (error) {
      throw formatHostedFetchError(error)
    }

    const data = (await response.json().catch(() => ({}))) as HostedCompleteResponse

    if (response.status === 403) {
      throw new Error('托管 AI 仅限 Pro 用户使用，请升级订阅')
    }

    if (response.status === 429) {
      const quota = data.quota
      const limit = quota?.limit ?? '本月'
      throw new Error(`本月托管 AI 调用次数已达上限（${limit} 次），可配置自己的 API Key 继续使用`)
    }

    if (!response.ok || !data.text) {
      throw new Error(data.error || '托管 AI 调用失败，请稍后重试')
    }

    if (data.quota) {
      this.cachedQuota = {
        model: data.model,
        used: data.quota.used,
        limit: data.quota.limit,
        remaining: data.quota.remaining,
        monthKey: this.cachedQuota?.monthKey ?? ''
      }
    } else {
      this.clearQuotaCache()
    }

    return {
      text: data.text,
      provider: 'hosted',
      ...(data.tokensUsed !== undefined ? { tokensUsed: data.tokensUsed } : {})
    }
  }
}

export const hostedLLMClient = new HostedLLMClient()
