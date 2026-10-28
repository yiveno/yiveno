/**
 * 扩展侧 chat 补全任务种类（与 Worker `ai-task-kind` 闭集对齐）。
 * 见 docs/architecture/2026-10-任务级模型路由方案.md
 */

/** 已支持的 chat 任务种类。 */
export const AI_CHAT_TASK_KINDS = [
  'nlu', // clue 理解
  'framing_nlg', // Framing 润色
  'follow_up_nlg', // 追问 NLG
  'narrow_polish', // Narrow 举例润色
  'enrichment', // enrichment（若经同一 completer）
  'gs_samples' // GS 示意 clue
] as const

export type AiChatTaskKind = (typeof AI_CHAT_TASK_KINDS)[number]

/** completer 调用选项（须声明 taskKind，便于服务端观测/路由）。 */
export type LlmChatCompleteOptions = {
  taskKind: AiChatTaskKind
}
