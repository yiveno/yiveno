/**
 * 扩展侧 chat 补全任务种类镜像表。
 *
 * **事实源：** `worker/src/config/ai-task-kind.ts`（注册表）。
 * 本文件须与 Worker 注册表的 kind / maxTokens / route 逐项对齐；
 * 跨包契约测试会读 Worker 源文件并断言相等。
 */

/** 请求路由：hosted=/api/ai/hosted/complete；dedicated=专用端点（扩展不经 hosted/complete）。 */
export type AiChatTaskRoute = 'hosted' | 'dedicated'

export type AiChatTaskRegistryEntry = {
  kind: string
  route: AiChatTaskRoute
  maxTokens: number
}

/**
 * 全量 10 kind 镜像（含 dedicated；扩展侧不直接调用 hosted/complete 的也登记齐全）。
 * maxTokens 与 Worker 现网生效值对齐。
 */
export const AI_CHAT_TASK_REGISTRY = [
  { kind: 'nlu', route: 'hosted', maxTokens: 400 }, // clue 理解
  { kind: 'framing_nlg', route: 'hosted', maxTokens: 256 }, // Framing 润色
  { kind: 'follow_up_nlg', route: 'hosted', maxTokens: 256 }, // 追问 NLG
  { kind: 'narrow_polish', route: 'hosted', maxTokens: 128 }, // Narrow 举例润色
  { kind: 'portrait_narrative', route: 'hosted', maxTokens: 256 }, // 画像摘要自然语言组装
  { kind: 'portrait_cluster', route: 'hosted', maxTokens: 512 }, // 待确认项语义聚类
  { kind: 'enrichment', route: 'dedicated', maxTokens: 400 }, // enrichment（专用端点）
  { kind: 'gs_samples', route: 'dedicated', maxTokens: 700 }, // GS 示意 clue（专用端点）
  { kind: 'dreaming', route: 'dedicated', maxTokens: 1200 }, // 夜间命题编译（专用端点）
  { kind: 'extract', route: 'dedicated', maxTokens: 800 } // 打开页内容提炼（专用端点）
] as const satisfies readonly AiChatTaskRegistryEntry[]

/** 已支持的 chat 任务种类（由镜像注册表派生）。 */
export const AI_CHAT_TASK_KINDS = AI_CHAT_TASK_REGISTRY.map(entry => entry.kind)

export type AiChatTaskKind = (typeof AI_CHAT_TASK_REGISTRY)[number]['kind']

/** hosted/complete 允许的 taskKind（route=hosted；dedicated 不得经此客户端误发）。 */
export type HostedCompleteTaskKind = Extract<
  (typeof AI_CHAT_TASK_REGISTRY)[number],
  { route: 'hosted' }
>['kind']

/** completer 调用选项（仅 hosted kind，便于服务端观测/路由）。 */
export type LlmChatCompleteOptions = {
  taskKind: HostedCompleteTaskKind
  /** 本次调用的 temperature；不传则各 completer 用各自默认值（解析为 0）。 */
  temperature?: number
}

/**
 * 各 task 请求 maxTokens（与 Worker 注册表对齐；服务端仍会再钳制）。
 */
export const AI_CHAT_TASK_MAX_TOKENS: Record<AiChatTaskKind, number> = Object.fromEntries(
  AI_CHAT_TASK_REGISTRY.map(entry => [entry.kind, entry.maxTokens])
) as Record<AiChatTaskKind, number>

/** 解析某任务应传的 maxTokens。 */
export function resolveClientMaxTokensForTask(taskKind: AiChatTaskKind): number {
  return AI_CHAT_TASK_MAX_TOKENS[taskKind]
}
