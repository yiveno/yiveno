/**
 * 语音快捷键主流程：听写 → Recall → 有候选则开列表第一个 / 零候选通知。
 * Recall 直接调 recallService.recallWithClue（不经 Side Panel activeRecall 命名空间）。
 *
 * 手势铁律：异步阶段永不调 sidePanel.open。开面板只允许：
 * - 命令同步前缀（缓存 ready 且麦未授予）
 * - 通知点击
 * - 用户自己按 Alt+Shift+Y / 点工具栏
 *
 * 产品决策：语音快捷键**不设信度门**；首选 = topPick ?? alsoPossible[0]。
 */

import { recallService } from '@/application/recall/recall-service'
import { handleRecordMemoryOpen } from '@/background/handlers/memory-handler'
import { speechRecognitionLangForUiLocale } from '@/core/speech/speech-dictation'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { resolveUiLocale } from '@/core/i18n/ui-locale'
import type { OffscreenSpeechDictationResponse } from '@/core/messaging/offscreen-speech'
import {
  getVoiceCommandCacheSnapshot,
  loadVoiceCommandCache,
  patchVoiceCommandCacheMicGranted
} from '@/infrastructure/browser/voice-command-cache'
import { ensureOffscreenDocumentForUserMedia } from '@/infrastructure/browser/ensure-offscreen-document'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import { openRecallSidePanel } from '@/infrastructure/browser/side-panel'
import { showVoiceRecallNotification } from '@/infrastructure/browser/voice-recall-notification'
import { showVoiceRecallPageOrNotify } from '@/infrastructure/browser/voice-recall-page-feedback'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { writeVoiceMicGranted } from '@/infrastructure/storage/voice-mic-granted-storage'
import { writeVoiceRecallHandoff } from '@/infrastructure/storage/voice-recall-handoff-storage'

/** 听写路径观测（日志 / 真机确认用）。 */
export type VoiceDictationPath = 'offscreen'

function getMessage(key: string, substitutions?: string | string[]): string {
  try {
    return chrome.i18n.getMessage(key, substitutions) || key
  } catch {
    return key
  }
}

/** 解析 UI locale → SpeechRecognition lang。 */
async function resolveSpeechLang(): Promise<string> {
  try {
    const settings = await getUserSettings()
    const locale = resolveUiLocale(settings.uiLocalePreference, chrome.i18n.getUILanguage())
    return speechRecognitionLangForUiLocale(locale)
  } catch {
    return speechRecognitionLangForUiLocale('en')
  }
}

/** offscreen 返回 not_allowed 时置麦授权记忆为 false（不翻转 true→false 以外路径）。 */
async function markMicNotGrantedFromOffscreen(): Promise<void> {
  patchVoiceCommandCacheMicGranted(false)
  await writeVoiceMicGranted(false)
}

/**
 * 仅 offscreen 听写；失败一律通知，绝不调 sidePanel.open。
 */
export async function runVoiceDictationPreferOffscreen(): Promise<
  | { ok: true; transcript: string; dictationPath: VoiceDictationPath }
  | { ok: false; reason: 'unclear' | 'not_allowed' | 'disabled' }
> {
  const lang = await resolveSpeechLang()

  const offscreenReady = await ensureOffscreenDocumentForUserMedia()
  if (!offscreenReady) {
    logger.info('VoiceRecall', 'offscreen 不可用，只通知')
    return { ok: false, reason: 'unclear' }
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      scope: 'offscreen',
      type: 'RUN_SPEECH_DICTATION',
      payload: { lang }
    })) as OffscreenSpeechDictationResponse

    if (response?.ok === true && response.transcript.trim()) {
      logger.info('VoiceRecall', '听写完成', {
        dictationPath: 'offscreen',
        transcriptPreview: response.transcript.slice(0, 80)
      })
      return {
        ok: true,
        transcript: response.transcript.trim(),
        dictationPath: 'offscreen'
      }
    }

    const errorCode = response && 'error' in response ? response.error : 'empty'
    logger.info('VoiceRecall', 'offscreen 听写未成功', { error: errorCode })

    if (errorCode === 'not_allowed') {
      await markMicNotGrantedFromOffscreen()
      return { ok: false, reason: 'not_allowed' }
    }

    // aborted / no_speech / failed / unavailable / empty → unclear 通知
    return { ok: false, reason: 'unclear' }
  } catch (error) {
    logger.warn('VoiceRecall', 'offscreen 听写消息失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { ok: false, reason: 'unclear' }
  }
}

/**
 * 语音快捷键自动打开的首选候选：列表第一个 = topPick ?? alsoPossible[0]。
 * 不设信度门 / 分差门。
 */
export function pickVoiceRecallOpenCandidate(result: RecallResult): RecallMatch | null {
  return result.topPick ?? result.alsoPossible[0] ?? null
}

/**
 * 打开首选候选新标签。
 * 自动打开 ≠ 用户点击确认：不写 open_confirm 正例；仅导航成功后记 memory open。
 */
export async function autoOpenRecallCandidate(
  candidate: RecallMatch,
  heardText: string
): Promise<{ opened: boolean; tabId?: number }> {
  const detailPageUrl = chrome.runtime.getURL('detail.html')
  const openUrl = getMemoryItemOpenHref(candidate.item, { detailPageUrl })

  try {
    const tab = await navigateTabToUrl(openUrl, 'newForegroundTab')
    // 导航成功后才记打开（行为信号）；不写 open_confirm（那是结果卡点击确认语义）
    void handleRecordMemoryOpen({ id: candidate.item.id }).catch(() => {})
    const title =
      candidate.item.type === 'bookmark'
        ? candidate.item.payload.title || openUrl
        : candidate.item.payload.pageTitle || openUrl
    void showVoiceRecallNotification({
      title: title.slice(0, 120) || getMessage('app_name'),
      message: getMessage('voice_recall_notification_opened_body', heardText.slice(0, 80)),
      ...(typeof tab?.id === 'number' ? { tabId: tab.id } : {})
    })
    logger.info('VoiceRecall', '自动打开完成', {
      memoryItemId: candidate.item.id,
      tabId: tab?.id ?? null,
      score: candidate.score
    })
    return { opened: true, ...(typeof tab?.id === 'number' ? { tabId: tab.id } : {}) }
  } catch (error) {
    logger.warn('VoiceRecall', '自动打开导航失败', {
      error: error instanceof Error ? error.message : String(error),
      memoryItemId: candidate.item.id
    })
    return { opened: false }
  }
}

/** 是否为零候选（只通知、不打开）。 */
export function isVoiceRecallEmptyNoMatch(result: RecallResult): boolean {
  return pickVoiceRecallOpenCandidate(result) === null
}

/**
 * 导航失败退路：写 show_result handoff +「候选已备好」通知。
 * 不调 sidePanel.open（异步阶段手势已过期）。
 */
export async function handoffLowConfidenceAndNotify(
  clue: string,
  result: RecallResult
): Promise<void> {
  await writeVoiceRecallHandoff({ kind: 'show_result', clue, result })
  void showVoiceRecallPageOrNotify({
    title: getMessage('app_name'),
    message: getMessage('voice_recall_notification_candidates_ready'),
    openSidePanelOnClick: true
  })
  logger.info('VoiceRecall', '导航失败退路：已写交接并发页内反馈（不开面板）', {
    outcome: result.outcome,
    alsoPossibleCount: result.alsoPossible.length,
    topScore: result.topPick?.score ?? null
  })
}

/** 同步前缀：未授予麦 → 赶手势开面板并写 start_dictation。 */
async function openPanelForMicGrantOnGesture(): Promise<void> {
  // 先调用、后 await：把 open 压在手势同步链上
  const openPromise = openRecallSidePanel()
  try {
    await writeVoiceRecallHandoff({ kind: 'start_dictation' })
  } catch (error) {
    logger.warn('VoiceRecall', '写 start_dictation handoff 失败', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
  try {
    await openPromise
    logger.info('VoiceRecall', '同步前缀已开面板请求麦授权听写')
  } catch (error) {
    logger.warn('VoiceRecall', '同步前缀开面板失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    void showVoiceRecallNotification({
      title: getMessage('app_name'),
      message: getMessage('voice_recall_notification_mic_grant_guide'),
      openSidePanelOnClick: true
    })
  }
}

/** offscreen 听写 → Recall → 有候选即开首选 / 零候选通知（永不 open 面板）。 */
async function runOffscreenRecallFlow(): Promise<void> {
  const dictation = await runVoiceDictationPreferOffscreen()
  if (!dictation.ok) {
    if (dictation.reason === 'not_allowed') {
      void showVoiceRecallNotification({
        title: getMessage('app_name'),
        message: getMessage('voice_recall_notification_mic_grant_guide'),
        openSidePanelOnClick: true
      })
    } else if (dictation.reason === 'unclear') {
      void showVoiceRecallPageOrNotify({
        title: getMessage('app_name'),
        message: getMessage('voice_recall_notification_unclear')
      })
    }
    return
  }

  logger.info('VoiceRecall', '开始 Recall（语音快捷键）', {
    dictationPath: dictation.dictationPath,
    cluePreview: dictation.transcript.slice(0, 80)
  })

  let result: RecallResult
  try {
    result = await recallService.recallWithClue(dictation.transcript, { entry: 'sidepanel' })
  } catch (error) {
    logger.error('VoiceRecall', 'Recall 失败', error)
    void showVoiceRecallPageOrNotify({
      title: getMessage('app_name'),
      message: getMessage('voice_recall_notification_unclear')
    })
    return
  }

  const candidate = pickVoiceRecallOpenCandidate(result)
  if (!candidate) {
    void showVoiceRecallPageOrNotify({
      title: getMessage('app_name'),
      message: getMessage('voice_recall_notification_no_match')
    })
    return
  }

  const open = await autoOpenRecallCandidate(candidate, dictation.transcript)
  if (open.opened) {
    return
  }
  // 导航失败：不写学习信号；交接完整结果
  await handoffLowConfidenceAndNotify(dictation.transcript, result)
}

/**
 * 命令入口。
 * 同步前缀（第一个 await 前）完成分流决策；异步阶段永不 sidePanel.open。
 * 顶层捕获意外异常，命令分发不得再报失败。
 */
export async function handleVoiceRecallOpenCommand(): Promise<void> {
  try {
    const cache = getVoiceCommandCacheSnapshot()

    // —— 同步分流（此块在第一个 await 之前）——
    if (cache.ready && cache.voiceRecallOpenEnabled === false) {
      logger.info('VoiceRecall', '语音快捷键已关（缓存），忽略')
      return
    }

    if (cache.ready && cache.voiceRecallOpenEnabled && cache.micGranted !== true) {
      await openPanelForMicGrantOnGesture()
      return
    }

    if (cache.ready && cache.voiceRecallOpenEnabled && cache.micGranted === true) {
      await runOffscreenRecallFlow()
      return
    }

    // 缓存未 ready：异步补载后只走 offscreen / 通知，禁止开面板
    logger.info('VoiceRecall', '语音命令缓存未 ready，异步补载后仅 offscreen')
    await loadVoiceCommandCache()
    const after = getVoiceCommandCacheSnapshot()
    if (!after.voiceRecallOpenEnabled) {
      logger.info('VoiceRecall', '语音快捷键已关（补载后），忽略')
      return
    }
    await runOffscreenRecallFlow()
  } catch (error) {
    logger.warn('VoiceRecall', '语音快捷键命令意外失败（已吞，不抛命令分发）', {
      error: error instanceof Error ? error.message : String(error)
    })
    void showVoiceRecallPageOrNotify({
      title: getMessage('app_name'),
      message: getMessage('voice_recall_notification_unclear')
    })
  }
}
