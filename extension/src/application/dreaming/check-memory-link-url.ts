/**
 * 死链 URL 探测（扩展侧直连用户存过的站点；URL 不经 Yiveno 服务器）。
 * 网络/超时 → unknown；4xx/5xx/无法解析 → 计一次死链失败候选。
 */

import { LINK_STATUS_CHECK_TIMEOUT_MS } from '@/core/dreaming/dreaming-constants'

/** 单次探测结论（升 stale 由调用方按连续失败计数）。 */
export type MemoryLinkCheckOutcome =
  | 'ok' // 可达
  | 'dead' // 明确死链（HTTP 错误 / 非法 URL）
  | 'probe_failed' // 离线 / 超时 / 其它探测失败 → 标 unknown，不得升 stale

/**
 * HEAD 探测；失败时再试 GET（部分站点拒 HEAD）。
 * fail-open：抛错/超时一律 probe_failed。
 */
export async function checkMemoryLinkUrl(url: string): Promise<MemoryLinkCheckOutcome> {
  const trimmed = url.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return 'dead'
  }

  try {
    const head = await fetch(trimmed, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(LINK_STATUS_CHECK_TIMEOUT_MS)
    })
    if (head.ok || (head.status >= 300 && head.status < 400)) {
      return 'ok'
    }
    // 部分站点拒 HEAD：再试 GET
    if (head.status === 405 || head.status === 501) {
      const get = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(LINK_STATUS_CHECK_TIMEOUT_MS)
      })
      if (get.ok || (get.status >= 300 && get.status < 400)) {
        return 'ok'
      }
      return get.status >= 400 ? 'dead' : 'probe_failed'
    }
    return head.status >= 400 ? 'dead' : 'probe_failed'
  } catch {
    return 'probe_failed'
  }
}
