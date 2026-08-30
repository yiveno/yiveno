import { ref, type Ref } from 'vue'

/** Toast 语气：info=中性提示；success=操作成功；warning=需注意；error=失败可重试 */
export type AppToastTone = 'info' | 'success' | 'warning' | 'error'

export interface AppToastItem {
  id: number
  tone: AppToastTone
  message: string
}

export interface AppToastShowInput {
  tone: AppToastTone
  message: string
  /** 自动消失毫秒；默认 3200 */
  durationMs?: number
}

const DEFAULT_DURATION_MS = 3200
const MAX_VISIBLE_TOASTS = 3

const toasts: Ref<AppToastItem[]> = ref([])
const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>()
let nextToastId = 0

function scheduleDismiss(id: number, durationMs: number): void {
  const existing = dismissTimers.get(id)
  if (existing) {
    clearTimeout(existing)
  }
  const timer = setTimeout(() => {
    dismissToast(id)
  }, durationMs)
  dismissTimers.set(id, timer)
}

/** 展示一条页内 toast（须页面已挂载 `AppToastHost`）。 */
export function showAppToast(input: AppToastShowInput): number {
  const message = input.message.trim()
  if (!message) {
    return -1
  }

  const id = ++nextToastId
  const item: AppToastItem = {
    id,
    tone: input.tone,
    message
  }
  toasts.value = [...toasts.value, item].slice(-MAX_VISIBLE_TOASTS)
  scheduleDismiss(id, input.durationMs ?? DEFAULT_DURATION_MS)
  return id
}

/** 手动关闭 toast。 */
export function dismissToast(id: number): void {
  const timer = dismissTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    dismissTimers.delete(id)
  }
  toasts.value = toasts.value.filter(item => item.id !== id)
}

/** 页内 toast 控制器；同一扩展页单例队列。 */
export function useAppToast() {
  return {
    toasts,
    show: showAppToast,
    success: (message: string, durationMs?: number) => {
      const input: AppToastShowInput = { tone: 'success', message }
      if (durationMs !== undefined) {
        input.durationMs = durationMs
      }
      return showAppToast(input)
    },
    error: (message: string, durationMs?: number) => {
      const input: AppToastShowInput = { tone: 'error', message }
      if (durationMs !== undefined) {
        input.durationMs = durationMs
      }
      return showAppToast(input)
    },
    info: (message: string, durationMs?: number) => {
      const input: AppToastShowInput = { tone: 'info', message }
      if (durationMs !== undefined) {
        input.durationMs = durationMs
      }
      return showAppToast(input)
    },
    warning: (message: string, durationMs?: number) => {
      const input: AppToastShowInput = { tone: 'warning', message }
      if (durationMs !== undefined) {
        input.durationMs = durationMs
      }
      return showAppToast(input)
    },
    dismiss: dismissToast
  }
}

/** 测试用：清空队列与定时器。 */
export function resetAppToastStateForTests(): void {
  for (const timer of dismissTimers.values()) {
    clearTimeout(timer)
  }
  dismissTimers.clear()
  toasts.value = []
  nextToastId = 0
}
