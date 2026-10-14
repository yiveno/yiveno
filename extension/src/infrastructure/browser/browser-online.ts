/**
 * 浏览器在线态：Side Panel 壳级离线条 + SW 离线跳过线索 LLM。
 * UI 用 window；Background 用 SW global——各自订阅，不经 message 同步。
 */

/** 当前是否在线。无 navigator 时保守视为在线（避免误永久离线）。 */
export function readBrowserOnline(): boolean {
  const nav = globalThis.navigator
  if (!nav || typeof nav.onLine !== 'boolean') {
    return true
  }
  return nav.onLine
}

/**
 * 订阅 online / offline。返回取消订阅函数。
 * @param listener 新的在线态（true=在线）
 */
export function subscribeBrowserOnline(listener: (online: boolean) => void): () => void {
  const onOnline = (): void => {
    listener(true)
  }
  const onOffline = (): void => {
    listener(false)
  }
  globalThis.addEventListener('online', onOnline)
  globalThis.addEventListener('offline', onOffline)
  return () => {
    globalThis.removeEventListener('online', onOnline)
    globalThis.removeEventListener('offline', onOffline)
  }
}

/** 离线时是否应省略线索 LLM completer（走本机规则理解）。 */
export function shouldOmitClueLlmCompleterWhenOffline(online: boolean): boolean {
  return !online
}
