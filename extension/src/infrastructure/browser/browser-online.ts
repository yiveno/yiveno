/**
 * 浏览器在线态（ADR-021 薄适配）：Side Panel 壳级断网条 + SW 断网时省略线索 LLM。
 * 不是离线产品支柱；履约仍默认在线。
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

/**
 * 断网薄适配：`navigator.onLine === false` 时省略线索 LLM completer（走本机规则，避免空等云端）。
 * 弱网/配额失败另走 `rules_fallback`，与本函数分计。
 */
export function shouldOmitClueLlmCompleterWhenBrowserOffline(online: boolean): boolean {
  return !online
}
