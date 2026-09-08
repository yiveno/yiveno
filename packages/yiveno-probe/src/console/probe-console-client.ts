/**
 * Probe Console → Background（造数 / 清理相关 DEV 消息）。
 * 故意不依赖 frontend background-client；消息 type 与扩展 DEV 契约对齐。
 */

import type { ProbeSeedPayload } from '../presets/seed-presets'

type FailResponse = {
  ok: false
  errorCode?: string
  error?: string
}

export type ProbeSeedRecallResponse =
  | {
      ok: true
      persona: string[]
      bookmarkCount: number
      excerptCount: number
      diversityBookmarkCount: number
      diversityExcerptCount: number
      noiseBookmarkCount: number
      noiseExcerptCount: number
      chromeBookmarkSync: 'all' | 'curated_only'
      indexRebuilt: boolean
      wipedChromeFolders: number
      clearedMemoryCount: number
      probeKeys: string[]
    }
  | FailResponse

export type ProbeCleanupPayload = {
  /** 清噪声 / 多样性层 */
  noiseOrDiversity?: boolean
  /** 清精选探针 */
  curatedProbe?: boolean
  /** 清当前 owner 全部 Memory */
  allMemory?: boolean
  /** 类型过滤 */
  types?: 'all' | 'bookmark' | 'text_excerpt'
  /** 移除 Chrome「Yiveno Probe」文件夹 */
  removeProbeFolder?: boolean
  /** 清空 Chrome 书签根下全部子树 */
  wipeChromeBookmarkChildren?: boolean
}

export type ProbeCleanupResponse =
  | {
      ok: true
      scannedCount: number
      purgedExcerptCount: number
      purgedBookmarkCount: number
      keptCount: number
      removedChromeProbeFolder: boolean
      removedChromeBookmarkNodes: number
      wipedChromeFolders: number
      clearedAllMemory: boolean
      indexRebuilt: boolean
    }
  | FailResponse

async function sendProbeMessage<T>(message: {
  scope: 'background'
  type: string
  payload?: unknown
}): Promise<T> {
  try {
    const response = await chrome.runtime.sendMessage(message)
    if (response === undefined) {
      return {
        ok: false,
        errorCode: 'MESSAGE_DISPATCH_FAILED',
        error: 'Background 无响应'
      } as T
    }
    return response as T
  } catch (error) {
    return {
      ok: false,
      errorCode: 'MESSAGE_DISPATCH_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    } as T
  }
}

export async function probeSeedRecall(
  payload?: Partial<ProbeSeedPayload>
): Promise<ProbeSeedRecallResponse> {
  if (payload === undefined) {
    return sendProbeMessage({
      scope: 'background',
      type: 'DEV_SEED_RECALL_PROBE'
    })
  }
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_SEED_RECALL_PROBE',
    payload
  })
}

/** 按选项批量清理（DEV_PROBE_CLEANUP）。 */
export async function probeCleanup(payload: ProbeCleanupPayload): Promise<ProbeCleanupResponse> {
  return sendProbeMessage({
    scope: 'background',
    type: 'DEV_PROBE_CLEANUP',
    payload
  })
}
