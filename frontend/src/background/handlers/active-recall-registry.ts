/**
 * Recall in-flight 追踪（per-source）。
 *
 * 目的：
 * - Side Panel 同源多次 recall（用户连按 Enter / 改 clue）：新 recall 自动覆盖旧 activeRecallId
 * - Side Panel 显式 RECALL_CANCEL{ recallId }：清除旧 activeRecallId
 * - handler 入口：recallId !== activeRecallId → 早退，避免无效 LLM 调用 + 无效 telemetry
 *
 * 边界：
 * - 同一 source 同时只允许一个 activeRecallId（Side Panel 单实例场景）
 * - SW 重启丢失：handler 启动时未登记即视为「无活动 recall」，早退的 recall 不会假复活
 * - 不同 source 互不影响：Side Panel / Omnibox / 其他面板独立
 *
 * 与 Phase 1（LLM parse cache）配合：
 * - 同 clue 5min 内复用 LLM proposal → 重复 Enter 同 clue 已不调 LLM
 * - 不同 clue 改 Enter → Phase 2 早退避免旧 recall 仍跑完
 */

import type { RecallSource } from '@/core/messaging/recall-messages'

const activeRecalls = new Map<RecallSource, string>()

/** 设置 source 当前活动 recallId。返回旧值（便于调试）。 */
export function setActiveRecall(source: RecallSource, recallId: string): string | undefined {
  const previous = activeRecalls.get(source)
  activeRecalls.set(source, recallId)
  return previous
}

/** 读取 source 当前活动 recallId（无 → undefined）。 */
export function getActiveRecall(source: RecallSource): string | undefined {
  return activeRecalls.get(source)
}

/** 清除 source 当前活动 recallId（仅当 recallId 匹配；防止误清新 recall）。 */
export function clearActiveRecall(source: RecallSource, recallId: string): boolean {
  const current = activeRecalls.get(source)
  if (current === recallId) {
    activeRecalls.delete(source)
    return true
  }
  return false
}

/** 强制清除 source 活动 recallId（无 recallId 校验）。测试 / 紧急复位使用。 */
export function forceClearActiveRecall(source: RecallSource): void {
  activeRecalls.delete(source)
}

/** 当前追踪的活动 recall 数（仅诊断 / 单测）。 */
export function getActiveRecallCount(): number {
  return activeRecalls.size
}
