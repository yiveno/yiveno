/**
 * 语音快捷键命令的 SW 内存缓存。
 * 供 `handleVoiceRecallOpenCommand` 在第一个 await 前同步分流（开面板须赶手势链）。
 * 生产路径禁止绕过本缓存直读 storage 做同步决策。
 */

import { parseUserSettings, USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import { VOICE_MIC_GRANTED_STORAGE_KEY } from '@/infrastructure/storage/voice-mic-granted-storage'
import { logger } from '@/infrastructure/logging/logger'

/** 内存快照（同步可读）。 */
export type VoiceCommandCacheSnapshot = {
  /** 是否已完成至少一次预载 */
  ready: boolean
  /** 设置：语音快捷键开关 */
  voiceRecallOpenEnabled: boolean
  /**
   * 麦克风授权记忆。
   * true = 已知授予；false = 已知拒绝；null = 未知（从未写入）。
   * 同步分流：`!== true` 走开面板授权路径。
   */
  micGranted: boolean | null
}

const cache: VoiceCommandCacheSnapshot = {
  ready: false,
  voiceRecallOpenEnabled: true,
  micGranted: null
}

let storageListenerRegistered = false
let loadInFlight: Promise<void> | null = null

/** 同步读取内存快照（命令同步前缀专用）。 */
export function getVoiceCommandCacheSnapshot(): VoiceCommandCacheSnapshot {
  return {
    ready: cache.ready,
    voiceRecallOpenEnabled: cache.voiceRecallOpenEnabled,
    micGranted: cache.micGranted
  }
}

/** 仅测试：写入内存缓存。 */
export function setVoiceCommandCacheForTests(partial: Partial<VoiceCommandCacheSnapshot>): void {
  if (typeof partial.ready === 'boolean') {
    cache.ready = partial.ready
  }
  if (typeof partial.voiceRecallOpenEnabled === 'boolean') {
    cache.voiceRecallOpenEnabled = partial.voiceRecallOpenEnabled
  }
  if (partial.micGranted === true || partial.micGranted === false || partial.micGranted === null) {
    cache.micGranted = partial.micGranted
  }
}

/** 仅测试：重置缓存与监听注册标记。 */
export function resetVoiceCommandCacheForTests(): void {
  cache.ready = false
  cache.voiceRecallOpenEnabled = true
  cache.micGranted = null
  loadInFlight = null
  storageListenerRegistered = false
}

/** 麦克风授权结果立刻写进内存（不必等 storage.onChanged）。 */
export function patchVoiceCommandCacheMicGranted(granted: boolean): void {
  cache.micGranted = granted
}

/**
 * 从 storage 预载 / 刷新缓存。
 * 注册命令监听时异步调用；未 ready 时命令路径也可 await 补载（仍禁止开面板）。
 */
export async function loadVoiceCommandCache(): Promise<void> {
  if (loadInFlight) {
    await loadInFlight
    return
  }
  loadInFlight = (async () => {
    try {
      const bag = await chrome.storage.local.get([
        USER_SETTINGS_STORAGE_KEY,
        VOICE_MIC_GRANTED_STORAGE_KEY
      ])
      const settings = parseUserSettings(bag[USER_SETTINGS_STORAGE_KEY])
      cache.voiceRecallOpenEnabled = settings.voiceRecallOpenEnabled
      const micRaw = bag[VOICE_MIC_GRANTED_STORAGE_KEY]
      if (micRaw === true) {
        cache.micGranted = true
      } else if (micRaw === false) {
        cache.micGranted = false
      } else {
        cache.micGranted = null
      }
      cache.ready = true
      logger.info('VoiceRecall', '语音命令缓存已预载', {
        voiceRecallOpenEnabled: cache.voiceRecallOpenEnabled,
        micGranted: cache.micGranted
      })
    } catch (error) {
      logger.warn('VoiceRecall', '语音命令缓存预载失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      // 保持 ready=false，命令走「未 ready」分支
    } finally {
      loadInFlight = null
    }
  })()
  await loadInFlight
}

/** storage.onChanged：设置 / 麦授权变更时同步内存。 */
function handleVoiceCommandCacheStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== 'local') {
    return
  }
  if (Object.prototype.hasOwnProperty.call(changes, USER_SETTINGS_STORAGE_KEY)) {
    const next = changes[USER_SETTINGS_STORAGE_KEY]?.newValue
    const settings = parseUserSettings(next)
    cache.voiceRecallOpenEnabled = settings.voiceRecallOpenEnabled
    cache.ready = true
  }
  if (Object.prototype.hasOwnProperty.call(changes, VOICE_MIC_GRANTED_STORAGE_KEY)) {
    const next = changes[VOICE_MIC_GRANTED_STORAGE_KEY]?.newValue
    if (next === true) {
      cache.micGranted = true
    } else if (next === false) {
      cache.micGranted = false
    } else if (next === undefined) {
      cache.micGranted = null
    }
    cache.ready = true
  }
}

/** 注册 storage 监听并异步预载（幂等）。 */
export function ensureVoiceCommandCacheWarm(): void {
  if (!storageListenerRegistered) {
    storageListenerRegistered = true
    chrome.storage.onChanged.addListener(handleVoiceCommandCacheStorageChanged)
  }
  void loadVoiceCommandCache()
}
