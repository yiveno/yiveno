/**
 * 由扩展页面请求 Background 执行书签向量同步
 */

/**
 * 通知 Service Worker 在条件允许时启动 embedding 同步（静默、幂等）
 */
export function requestBookmarkEmbeddingSyncFromPage(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return
  }

  chrome.runtime.sendMessage({ type: 'REQUEST_EMBEDDING_SYNC' }).catch(() => {
    /* Service Worker 未唤醒或页面即将关闭 */
  })
}
