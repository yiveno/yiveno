/**
 * Side Panel 空态按时问候（纯函数；文案经注入的 translate）。
 * 只做人味开场，不承担引导或闲聊。
 */
import type { TranslateFn } from '@/core/i18n/translate'

/** 本地时段桶（按小时，闭开区间语义见 resolve）。 */
export type TimeOfDayPeriod =
  | 'morning' // 清晨—午前
  | 'afternoon' // 午后
  | 'evening' // 傍晚—入夜前
  | 'night' // 深夜—凌晨

/**
 * 按本地小时划时段。
 * 05–11 morning · 12–16 afternoon · 17–21 evening · 其余 night。
 */
export function resolveTimeOfDayPeriod(now: Date = new Date()): TimeOfDayPeriod {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) {
    return 'morning'
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon'
  }
  if (hour >= 17 && hour < 22) {
    return 'evening'
  }
  return 'night'
}

/**
 * 生成空态问候语。有展示名时带名；无名则仅时段问候。
 */
export function getTimeOfDayGreeting(
  translate: TranslateFn,
  options: { displayName?: string; now?: Date } = {}
): string {
  const period = resolveTimeOfDayPeriod(options.now ?? new Date())
  const name = options.displayName?.trim()
  if (name) {
    return translate(`popup_greeting_${period}_named`, name)
  }
  return translate(`popup_greeting_${period}`)
}
