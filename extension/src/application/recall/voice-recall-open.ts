/**
 * 语音快捷键主流程：听写 → Recall → 高置信自动开新标签 / 低置信开面板。
 * Recall 直接调 recallService.recallWithClue（不经 Side Panel activeRecall 命名空间）。
 */

import { recallService } from '@/application/recall/recall-service'
import { handleRecordMemoryOpen } from '@/background/handlers/memory-handler'
import { speechRecognitionLangForUiLocale } from '@/core/speech/speech-dictation'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { shouldAutoOpenRecallResult } from '@/core/recall/recall-auto-open'
import type { RecallResult } from '@/core/recall/recall-result'
import { resolveUiLocale } from '@/core/i18n/ui-locale'
import type { OffscreenSpeechDictationResponse } from '@/core/messaging/offscreen-speech'
import { ensureOffscreenDocumentForUserMedia } from '@/infrastructure/browser/ensure-offscreen-document'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import { openRecallSidePanel } from '@/infrastructure/browser/side-panel'
import { showVoiceRecallNotification } from '@/infrastructure/browser/voice-recall-notification'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { writeVoiceRecallHandoff } from '@/infrastructure/storage/voice-recall-handoff-storage'

/** 听写路径观测（日志 / 真机确认用）。 */
export type VoiceDictationPath = 'offscreen' | 'panel_fallback'

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

/**
 * 首选 offscreen 听写；建文档 / recognition 失败 → 面板 fallback。
 * 判定条件与观测：日志 `VoiceRecall` scope 含 `dictationPath`。
 */
export async function runVoiceDictationPreferOffscreen(): Promise<
  | { ok: true; transcript: string; dictationPath: VoiceDictationPath }
  | { ok: false; reason: 'panel_fallback_started' | 'unclear' | 'disabled' }
> {
  const lang = await resolveSpeechLang()

  const offscreenReady = await ensureOffscreenDocumentForUserMedia()
  if (offscreenReady) {
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

      logger.info('VoiceRecall', 'offscreen 听写未成功，改面板 fallback', {
        error: response && 'error' in response ? response.error : 'empty'
      })

      if (response && 'error' in response && response.error === 'no_speech') {
        return { ok: false, reason: 'unclear' }
      }
    } catch (error) {
      logger.warn('VoiceRecall', 'offscreen 听写消息失败，改面板 fallback', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } else {
    logger.info('VoiceRecall', 'offscreen 不可用，改面板 fallback')
  }

  await writeVoiceRecallHandoff({ kind: 'start_dictation' })
  try {
    await openRecallSidePanel()
  } catch (error) {
    logger.warn('VoiceRecall', '面板 fallback 开壳失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { ok: false, reason: 'unclear' }
  }
  logger.info('VoiceRecall', '已开面板并请求自动听写', { dictationPath: 'panel_fallback' })
  return { ok: false, reason: 'panel_fallback_started' }
}

/**
 * 打开 topPick 新标签。
 * 自动打开 ≠ 用户点击确认：不写 open_confirm 正例；仅导航成功后记 memory open。
 */
export async function autoOpenRecallTopPick(
  result: RecallResult,
  heardText: string
): Promise<{ opened: boolean; tabId?: number }> {
  const top = result.topPick
  if (!top) {
    return { opened: false }
  }
  const detailPageUrl = chrome.runtime.getURL('detail.html')
  const openUrl = getMemoryItemOpenHref(top.item, { detailPageUrl })

  try {
    const tab = await navigateTabToUrl(openUrl, 'newForegroundTab')
    // 导航成功后才记打开（行为信号）；不写 open_confirm（那是结果卡点击确认语义）
    void handleRecordMemoryOpen({ id: top.item.id }).catch(() => {})
    const title =
      top.item.type === 'bookmark'
        ? top.item.payload.title || openUrl
        : top.item.payload.pageTitle || openUrl
    void showVoiceRecallNotification({
      title: title.slice(0, 120) || getMessage('app_name'),
      message: getMessage('voice_recall_notification_opened_body', heardText.slice(0, 80)),
      ...(typeof tab?.id === 'number' ? { tabId: tab.id } : {})
    })
    logger.info('VoiceRecall', '自动打开完成', {
      memoryItemId: top.item.id,
      tabId: tab?.id ?? null,
      score: top.score
    })
    return { opened: true, ...(typeof tab?.id === 'number' ? { tabId: tab.id } : {}) }
  } catch (error) {
    logger.warn('VoiceRecall', '自动打开导航失败', {
      error: error instanceof Error ? error.message : String(error),
      memoryItemId: top.item.id
    })
    return { opened: false }
  }
}

/** 是否为零候选 no_match（只通知、不开面板）。 */
export function isVoiceRecallEmptyNoMatch(result: RecallResult): boolean {
  return (
    result.outcome === 'no_match' && result.alsoPossible.length === 0 && result.topPick === null
  )
}

/** 低置信：把完整 RecallResult 交给面板。 */
export async function handoffLowConfidenceToPanel(
  clue: string,
  result: RecallResult
): Promise<void> {
  await writeVoiceRecallHandoff({ kind: 'show_result', clue, result })
  await openRecallSidePanel()
  logger.info('VoiceRecall', '低置信退路：已开面板并交接完整结果', {
    outcome: result.outcome,
    alsoPossibleCount: result.alsoPossible.length,
    topScore: result.topPick?.score ?? null
  })
}

/**
 * 命令入口：设置关则无动作；听写 → Recall → 门 → 开标签或开面板。
 */
export async function handleVoiceRecallOpenCommand(): Promise<void> {
  const settings = await getUserSettings()
  if (!settings.voiceRecallOpenEnabled) {
    logger.info('VoiceRecall', '语音快捷键已关，忽略')
    return
  }

  const dictation = await runVoiceDictationPreferOffscreen()
  if (!dictation.ok) {
    if (dictation.reason === 'unclear') {
      void showVoiceRecallNotification({
        title: getMessage('app_name'),
        message: getMessage('voice_recall_notification_unclear')
      })
    }
    // panel_fallback_started：面板内继续听写；disabled 不应到这
    return
  }

  logger.info('VoiceRecall', '开始 Recall（语音快捷键）', {
    dictationPath: dictation.dictationPath,
    cluePreview: dictation.transcript.slice(0, 80)
  })

  let result: RecallResult
  try {
    // 直接应用服务；不经 handleRecallWithClue 的 sidepanel activeRecall 命名空间
    result = await recallService.recallWithClue(dictation.transcript, { entry: 'sidepanel' })
  } catch (error) {
    logger.error('VoiceRecall', 'Recall 失败', error)
    void showVoiceRecallNotification({
      title: getMessage('app_name'),
      message: getMessage('voice_recall_notification_unclear')
    })
    return
  }

  if (shouldAutoOpenRecallResult(result)) {
    const open = await autoOpenRecallTopPick(result, dictation.transcript)
    if (open.opened) {
      return
    }
    // 导航失败：不写学习信号；退回面板交完整结果
    await handoffLowConfidenceToPanel(dictation.transcript, result)
    return
  }

  if (isVoiceRecallEmptyNoMatch(result)) {
    void showVoiceRecallNotification({
      title: getMessage('app_name'),
      message: getMessage('voice_recall_notification_no_match')
    })
    return
  }

  // need_a_clue / 分差不足等：有候选 → 面板交接完整 RecallResult
  await handoffLowConfidenceToPanel(dictation.transcript, result)
}
