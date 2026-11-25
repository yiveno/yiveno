/**
 * 语音快捷键麦克风授权记忆（local）。
 * 供 SW 同步分流缓存读取；写入在授权成功/失败时 best-effort。
 */

export const VOICE_MIC_GRANTED_STORAGE_KEY = 'yiveno.voiceMicGranted' as const

/** 写入麦克风授权记忆；失败吞掉，不改变调用方返回值语义。 */
export async function writeVoiceMicGranted(granted: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [VOICE_MIC_GRANTED_STORAGE_KEY]: granted })
  } catch {
    // best-effort
  }
}
