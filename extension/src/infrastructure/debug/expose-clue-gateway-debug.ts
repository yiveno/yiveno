/**
 * DEV：把线索网关挂到 Background Service Worker 全局，便于手测噪音拦截。
 * 仅 import.meta.env.DEV；生产构建不挂载。不挂页面 window。
 *
 * 用法（chrome://extensions → 本扩展 → Service Worker「检查」）：
 *   checkClueGateway('asdasd')
 *   yiveno.checkClueGateway('poem')
 *
 * 总索引：docs/engineering/DEV-调试API.md
 */

import { selectClueProcessingDisposition } from '@/core/recall/understand/select-clue-processing-disposition'
import { selectClueUnderstandingMode } from '@/core/recall/understand/select-clue-understanding-mode'

export interface ClueGatewayDebugResult {
  clue: string
  disposition: 'reject_noise' | 'proceed'
  rejectReason: string | null
  /** 仅 proceed 时有值；拒绝时为 null（未进门禁）。 */
  understandingMode: 'lexical' | 'semantic' | null
}

type ClueGatewayDebugHost = {
  checkClueGateway?: (clue: string) => ClueGatewayDebugResult
  yiveno?: {
    checkClueGateway?: (clue: string) => ClueGatewayDebugResult
  }
}

/** 跑网关（+ 放行时顺带看门禁模式），并打印到 console。 */
export function checkClueGateway(clue: string): ClueGatewayDebugResult {
  const decision = selectClueProcessingDisposition(clue)
  const understandingMode =
    decision.disposition === 'proceed'
      ? selectClueUnderstandingMode(clue, { hasLlmCompleter: true })
      : null
  const result: ClueGatewayDebugResult = {
    clue,
    disposition: decision.disposition,
    rejectReason: decision.rejectReason,
    understandingMode
  }
  console.info('[yiveno] clue gateway', result)
  return result
}

/** 仅开发构建：挂到 Service Worker 的 globalThis。 */
export function exposeClueGatewayDebug(): void {
  if (!import.meta.env.DEV) {
    return
  }

  const host = globalThis as typeof globalThis & ClueGatewayDebugHost
  host.checkClueGateway = checkClueGateway
  host.yiveno = {
    ...(host.yiveno ?? {}),
    checkClueGateway
  }
  console.info("[yiveno] DEV：SW 可用 checkClueGateway('asdasd') 测噪音网关")
}
