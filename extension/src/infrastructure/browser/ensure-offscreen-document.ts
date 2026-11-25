/**
 * 确保扩展有一个带 USER_MEDIA 的 offscreen document（语音听写）。
 * 仓库内此前无 createDocument 调用；本文件为 Stage 2 首接线。
 */

import { logger } from '@/infrastructure/logging/logger'

const OFFSCREEN_PATH = 'offscreen.html'

let creating: Promise<void> | null = null

/** 是否已有 offscreen 文档。 */
async function hasOffscreenDocument(): Promise<boolean> {
  if (typeof chrome.offscreen?.hasDocument === 'function') {
    return chrome.offscreen.hasDocument()
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  })
  return contexts.length > 0
}

/**
 * 创建（或复用）offscreen document。
 * @returns true 已就绪；false 创建失败（调用方走面板 fallback）
 */
export async function ensureOffscreenDocumentForUserMedia(): Promise<boolean> {
  try {
    if (await hasOffscreenDocument()) {
      return true
    }
    if (creating) {
      await creating
      return hasOffscreenDocument()
    }
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['USER_MEDIA'],
        justification: 'Run browser speech recognition for the voice find-and-open shortcut.'
      })
      .catch(async error => {
        // 竞态：另一路已建好
        if (await hasOffscreenDocument()) {
          return
        }
        throw error
      })
      .finally(() => {
        creating = null
      })
    await creating
    logger.info('VoiceRecall', 'offscreen document 已就绪', { path: OFFSCREEN_PATH })
    return true
  } catch (error) {
    logger.warn('VoiceRecall', '创建 offscreen document 失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}
