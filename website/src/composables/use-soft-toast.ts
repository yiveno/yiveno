/**
 * 官网轻提示 Toast（对齐设计标准 6.2.3 气质：顶部浮层、自动消失、不挡操作）。
 * 登录等页的操作反馈用此，避免插进表单排版造成跳动。
 */

export type SoftToastTone = 'info' | 'success' | 'warning' | 'error'

export type SoftToastItem = {
  id: number
  tone: SoftToastTone
  message: string
}

type SoftToastListener = (items: SoftToastItem[]) => void

const MAX_VISIBLE = 3
const DEFAULT_HOLD_MS = 3200

let nextId = 1
const items: SoftToastItem[] = []
const listeners = new Set<SoftToastListener>()
const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>()

function emit(): void {
  const snapshot = items.slice()
  for (const listener of listeners) {
    listener(snapshot)
  }
}

function dismiss(id: number): void {
  const timer = dismissTimers.get(id)
  if (timer != null) {
    clearTimeout(timer)
    dismissTimers.delete(id)
  }
  const index = items.findIndex(item => item.id === id)
  if (index < 0) return
  items.splice(index, 1)
  emit()
}

function push(tone: SoftToastTone, message: string, holdMs = DEFAULT_HOLD_MS): number {
  const text = message.trim()
  if (!text) return -1
  while (items.length >= MAX_VISIBLE) {
    const oldest = items[0]
    if (oldest) dismiss(oldest.id)
    else break
  }
  const id = nextId++
  items.push({ id, tone, message: text })
  emit()
  dismissTimers.set(
    id,
    setTimeout(() => {
      dismiss(id)
    }, holdMs)
  )
  return id
}

export function subscribeSoftToast(listener: SoftToastListener): () => void {
  listeners.add(listener)
  listener(items.slice())
  return () => {
    listeners.delete(listener)
  }
}

export function useSoftToast() {
  return {
    info: (message: string, holdMs?: number) => push('info', message, holdMs),
    success: (message: string, holdMs?: number) => push('success', message, holdMs),
    warning: (message: string, holdMs?: number) => push('warning', message, holdMs),
    error: (message: string, holdMs?: number) => push('error', message, holdMs ?? 4200),
    dismiss
  }
}
