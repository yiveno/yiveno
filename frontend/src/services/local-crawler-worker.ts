/**
 * 本地爬虫工作器
 *
 * 职责：发起 HTTP 请求，检测书签是否有效（HTTP 状态码）。
 * 不做 DOM 解析、不提取元数据，只关心链接是否可达。
 *
 * 隐私保护：100% 客户端执行，零数据上传。
 */

import { logger } from '@/infrastructure/logging/logger'
import { TIMEOUT_CONFIG } from '@/config/constants'

// ==================== 类型定义 ====================

export interface CrawlResult {
  success: boolean
  url: string
  httpStatus?: number
  duration: number
  error?: string
  errorType?: 'timeout' | 'cors' | 'network' | 'http_error' | 'unknown'
}

export interface CrawlOptions {
  timeout?: number
}

// ==================== 配置 ====================

const REQUEST_TIMEOUT_MS = TIMEOUT_CONFIG.CRAWLER.REQUEST
const MIN_DOMAIN_INTERVAL_MS = 1000

const DOMAIN_LAST_ACCESS = new Map<string, number>()

// ==================== 工具函数 ====================

function getDomainFromURL(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

async function waitForDomainSlot(domain: string): Promise<void> {
  const lastAccess = DOMAIN_LAST_ACCESS.get(domain) || 0
  const diff = Date.now() - lastAccess
  if (diff < MIN_DOMAIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DOMAIN_INTERVAL_MS - diff))
  }
  DOMAIN_LAST_ACCESS.set(domain, Date.now())
}

function classifyError(error: unknown): CrawlResult['errorType'] {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('aborted') || message.includes('timeout')) return 'timeout'
  if (message.includes('CORS') || message.includes('blocked')) return 'cors'
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return 'network'
  if (/HTTP [45]\d{2}/.test(message)) return 'http_error'
  return 'unknown'
}

// ==================== 核心函数 ====================

/**
 * 检测书签 URL 是否可达
 *
 * 使用 HEAD 请求（降级到 GET），只关心 HTTP 状态码，不下载页面内容。
 *
 * @param url - 目标 URL
 * @param options - 爬取选项
 */
export async function crawlBookmarkLocally(
  url: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const { timeout = REQUEST_TIMEOUT_MS } = options
  const startTime = Date.now()
  const domain = getDomainFromURL(url)

  try {
    await waitForDomainSlot(domain)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    let response: Response
    try {
      // 优先用 HEAD，减少流量
      response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AcuityBookmarks-Extension/1.0'
        }
      })
    } catch {
      // HEAD 被拒绝时降级到 GET
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AcuityBookmarks-Extension/1.0'
        }
      })
    }

    clearTimeout(timeoutId)

    const success = response.status >= 200 && response.status < 400

    logger.debug('LocalCrawler', `${success ? '✅' : '❌'} ${url} → HTTP ${response.status}`)

    return {
      success,
      url: response.url || url,
      httpStatus: response.status,
      duration: Date.now() - startTime
    }
  } catch (error) {
    const errorType = classifyError(error)
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : String(error),
      ...(errorType !== undefined ? { errorType } : {}),
      duration: Date.now() - startTime
    }
  }
}

/** 清理域名访问缓存 */
export function clearCrawlerCache(): void {
  DOMAIN_LAST_ACCESS.clear()
  logger.info('LocalCrawler', '🧹 缓存已清理')
}
