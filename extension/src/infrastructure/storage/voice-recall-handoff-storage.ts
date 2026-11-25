/**
 * 语音快捷键 → Side Panel 交接（session，消费一次）。
 * - start_dictation：命令同步前缀开面板请求麦授权听写
 * - show_result：低置信退路；面板由通知点击 / 用户手势打开后消费渲染
 */

import type { RecallResult } from '@/core/recall/recall-result'

export const VOICE_RECALL_HANDOFF_SESSION_KEY = 'yiveno.voiceRecallHandoff'

/** 语音快捷键面板交接载荷。 */
export type VoiceRecallHandoffPayload =
  | {
      /** offscreen 失败 → 开面板并自动点麦 */
      kind: 'start_dictation'
    }
  | {
      /** 分差不足 / need_a_clue / no_match → 开面板展示完整结果 */
      kind: 'show_result'
      clue: string
      result: RecallResult
    }

/** 写入交接（覆盖旧值）。 */
export async function writeVoiceRecallHandoff(payload: VoiceRecallHandoffPayload): Promise<void> {
  await chrome.storage.session.set({ [VOICE_RECALL_HANDOFF_SESSION_KEY]: payload })
}

/** 读取并清除交接。 */
export async function consumeVoiceRecallHandoff(): Promise<VoiceRecallHandoffPayload | null> {
  const bag = await chrome.storage.session.get(VOICE_RECALL_HANDOFF_SESSION_KEY)
  await chrome.storage.session.remove(VOICE_RECALL_HANDOFF_SESSION_KEY)
  const raw = bag[VOICE_RECALL_HANDOFF_SESSION_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (record.kind === 'start_dictation') {
    return { kind: 'start_dictation' }
  }
  if (record.kind === 'show_result' && typeof record.clue === 'string' && record.result) {
    return {
      kind: 'show_result',
      clue: record.clue,
      result: record.result as RecallResult
    }
  }
  return null
}
