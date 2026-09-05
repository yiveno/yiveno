/**
 * DEV：Memory 调试 API（保存时刻回溯等）。
 * 仅 import.meta.env.DEV。
 *
 * 用法（SW Console）：
 *   await yiveno.backdateMemorySavedAt({ ids: ['<uuid>'], daysAgo: 21 })
 */

import {
  backdateMemorySavedAt,
  type BackdateMemorySavedAtInput
} from '@/infrastructure/debug/memory-dev-backdate-saved-at'

type MemoryDevHost = {
  yiveno?: {
    backdateMemorySavedAt?: (
      input: BackdateMemorySavedAtInput
    ) => Promise<Awaited<ReturnType<typeof backdateMemorySavedAt>>>
  }
}

/** 仅开发构建：挂到 Service Worker globalThis。 */
export function exposeMemoryDevDebug(): void {
  if (!import.meta.env.DEV) {
    return
  }

  const host = globalThis as typeof globalThis & MemoryDevHost
  host.yiveno = {
    ...(host.yiveno ?? {}),
    backdateMemorySavedAt: async (input: BackdateMemorySavedAtInput) => {
      const result = await backdateMemorySavedAt(input)
      console.info('[yiveno] 保存时刻已回溯', result)
      return result
    }
  }
}
