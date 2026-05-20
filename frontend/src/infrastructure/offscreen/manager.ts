/**
 * Offscreen Document 管理器
 *
 * 职责：
 * - 管理 Chrome Offscreen Document 的生命周期
 * - 提供与 Offscreen Document 通信的统一接口
 * - 处理 DOM 解析等需要 DOM 环境的任务
 *
 * 架构说明：
 * - Service Worker 无法直接访问 DOM
 * - 通过 Offscreen Document 提供 DOM 解析能力
 * - 使用消息传递与 Offscreen Document 通信
 *
 * ⚠️ 注意：此文件是 infrastructure 层的实现
 * background/offscreen-manager.ts 从此处 re-export
 */

import { logger } from '@/infrastructure/logging/logger'

export type OffscreenReason = 'DOM_SCRAPING' | 'WEB_WORKER' | 'TESTING'
export type OffscreenTaskType = 
  | 'PARSE_HTML' 
  | 'SEARCH_QUERY' 
  | 'SEARCH_INIT' 
  | 'EMBEDDING_EMBED' 
  | 'EMBEDDING_EMBED_BATCH' 
  | 'EMBEDDING_IS_AVAILABLE' 
  | 'SEMANTIC_SEARCH'
  | 'GET_FOLDER_RECOMMENDATIONS'

interface OffscreenRequest<TPayload = unknown> {
  type: OffscreenTaskType
  payload?: TPayload
}

interface OffscreenResponse<TResult = unknown> {
  ok: boolean
  result?: TResult
  error?: string
}

/** Offscreen 页面路径 */
const OFFSCREEN_URL = 'offscreen.html'
const DEFAULT_TIMEOUT = 5000

let ensuringDocument: Promise<boolean> | null = null
let requestCounter = 1

function createError(message: string, cause?: unknown): Error {
  if (cause instanceof Error) {
    const err = new Error(message)
    err.stack = cause.stack
    return err
  }
  return new Error(message)
}

export async function ensureOffscreenDocument(
  reason: OffscreenReason = 'DOM_SCRAPING'
): Promise<boolean> {
  if (!chrome.offscreen?.createDocument) {
    logger.warn(
      'OffscreenManager',
      '当前环境不支持 chrome.offscreen API，无法创建 Offscreen Document'
    )
    return false
  }

  try {
    if (typeof chrome.offscreen.hasDocument === 'function') {
      const hasDoc = await chrome.offscreen.hasDocument()
      if (hasDoc) {
        logger.debug('OffscreenManager', '✅ Offscreen Document 已存在')
        return true
      }
    }
  } catch (error) {
    logger.debug('OffscreenManager', '检测 Offscreen 文档失败', error)
  }

  if (!ensuringDocument) {
    logger.info('OffscreenManager', `🔄 开始创建 Offscreen Document，原因: ${reason}`)
    ensuringDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['DOM_SCRAPING'],
        justification: `AcuityBookmarks needs to perform ${reason} tasks in the background.`
      })
      .then(async () => {
        logger.info(
          'OffscreenManager',
          `✅ Offscreen Document 已创建，原因: ${reason}`
        )
        
        // 等待 Offscreen Document 加载并验证其可用性
        logger.info('OffscreenManager', '⏱️ 等待 Offscreen Document 加载...')
        
        // 尝试 ping Offscreen Document，最多等待 3 秒
        const maxAttempts = 30 // 30 次 × 100ms = 3 秒
        for (let i = 0; i < maxAttempts; i++) {
          try {
            // 发送 ping 消息
            const response = await new Promise<{ ok: boolean }>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Ping timeout')), 200)
              
              chrome.runtime.sendMessage(
                { __offscreenRequest__: true, type: 'PING' },
                (pingResponse) => {
                  clearTimeout(timer)
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message))
                  } else {
                    resolve(pingResponse || { ok: false })
                  }
                }
              )
            })
            
            if (response.ok) {
              logger.info('OffscreenManager', `✅ Offscreen Document 已就绪 (尝试 ${i + 1}/${maxAttempts})`)
              return
            }
          } catch (_error) {
            // 继续等待
            logger.debug('OffscreenManager', `⏳ Ping 失败，继续等待... (${i + 1}/${maxAttempts})`)
          }
          
          // 等待 100ms 后重试
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // 超时，但不抛出错误，让后续请求自己处理
        logger.warn('OffscreenManager', '⚠️ Offscreen Document 可能未完全加载，但继续尝试')
      })
      .then(() => true)
      .catch(error => {
        const errorInfo: {
          error: string
          stack?: string
          errorType: string
        } = {
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error
        }
        
        if (error instanceof Error && error.stack) {
          errorInfo.stack = error.stack
        }
        
        logger.error(
          'OffscreenManager',
          '❌ 无法创建 Offscreen Document',
          errorInfo
        )
        return false
      })
      .finally(() => {
        ensuringDocument = null
      })
  }

  return ensuringDocument
}

export async function dispatchOffscreenRequest<
  TResult = unknown,
  TPayload = unknown
>(
  request: OffscreenRequest<TPayload>,
  options: { timeout?: number } = {}
): Promise<TResult> {
  const reason: OffscreenReason =
    request.type === 'PARSE_HTML' ? 'DOM_SCRAPING' : 'WEB_WORKER'
  
  logger.info('OffscreenManager', `📤 准备发送 Offscreen 请求: ${request.type}`)
  
  const ready = await ensureOffscreenDocument(reason)
  if (!ready) {
    const error = 'Offscreen Document 不可用'
    logger.error('OffscreenManager', `❌ ${error}`)
    throw createError(error)
  }

  logger.info('OffscreenManager', `✅ Offscreen Document 已就绪，发送请求: ${request.type}`)

  const reqId = requestCounter++
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  return new Promise<TResult>((resolve, reject) => {
    const requestType = (request.type ?? 'unknown') as OffscreenTaskType

    const payload = {
      __offscreenRequest__: true,
      reqId,
      type: requestType,
      payload: request.payload
    }

    logger.info('OffscreenManager', `📨 发送消息到 Offscreen Document`, {
      type: requestType,
      reqId,
      hasPayload: !!request.payload
    })

    const timer = setTimeout(() => {
      logger.error('OffscreenManager', `⏱️ Offscreen 请求超时: ${requestType}`)
      reject(createError(`Offscreen 请求超时 (${requestType})`))
    }, timeout)

    const MAX_RETRY = 3
    let retryCount = 0

    const send = () => {
      chrome.runtime.sendMessage(
        payload,
        (response?: OffscreenResponse<TResult>) => {
          const lastError = chrome.runtime.lastError
          if (lastError) {
            const message = lastError.message ?? ''
            logger.warn('OffscreenManager', `⚠️ chrome.runtime.lastError: ${message}`, {
              retryCount,
              maxRetry: MAX_RETRY
            })
            
            if (
              message.includes('Receiving end does not exist') &&
              retryCount < MAX_RETRY
            ) {
              retryCount += 1
              const baseDelay = 50
              const retryDelay = Math.min(
                baseDelay * Math.pow(2, retryCount - 1),
                1000
              )
              logger.info('OffscreenManager', `🔄 重试 Offscreen 请求 (${retryCount}/${MAX_RETRY})，延迟 ${retryDelay}ms`)
              setTimeout(send, retryDelay)
              return
            }
            clearTimeout(timer)
            logger.error('OffscreenManager', `❌ Offscreen 请求失败: ${message}`)
            reject(createError(message || 'Offscreen 返回失败'))
            return
          }

          if (!response) {
            clearTimeout(timer)
            logger.error('OffscreenManager', '❌ Offscreen 响应为空')
            reject(createError('Offscreen 响应为空'))
            return
          }

          clearTimeout(timer)
          if (response.ok) {
            logger.info('OffscreenManager', `✅ Offscreen 请求成功: ${requestType}`)
            resolve(response.result as TResult)
          } else {
            logger.error('OffscreenManager', `❌ Offscreen 返回错误: ${response.error}`)
            reject(createError(response.error || 'Offscreen 返回失败'))
          }
        }
      )
    }

    send()
  })
}

export async function disposeOffscreenDocument(): Promise<void> {
  try {
    if (chrome.offscreen?.closeDocument) {
      await chrome.offscreen.closeDocument()
      logger.info('OffscreenManager', '🧹 Offscreen Document 已关闭')
    }
  } catch (error) {
    logger.warn('OffscreenManager', '关闭 Offscreen Document 失败', error)
  }
}

export const OffscreenManager = {
  ensureOffscreenDocument,
  dispatchOffscreenRequest,
  disposeOffscreenDocument
}

export type { OffscreenRequest, OffscreenResponse }
