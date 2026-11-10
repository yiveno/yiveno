import { z } from 'zod'

import { ParsedRecallClueSchema } from '@/core/recall/parse-recall-clue-types'
import { PAGE_CONTEXT_MODES } from '@/core/recall/page-context-mode'
import { RECALL_SOURCE_SCOPES } from '@/core/recall/recall-source-scope'
import type { RecallResult } from '@/core/recall/recall-result'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/**
 * 单条 recall clue 最大字符数（契约 ∪ composer 物理上限）。
 * UI 键入/粘贴/听写须在此拦住；与 Zod `clue.max` 同值。
 * R9：须 **大于** 理解层 `MAX_RECALL_CLUE_LENGTH`（2000），否则超长粘贴在
 * composer/契约层就被夹到 ≤2000，理解层截断标志永远不亮、用户看不到轻提示。
 * 理解层仍只按前 2000 检索；本常量只是「允许粘贴进来」的硬顶。
 */
export const RECALL_CLUE_MAX_CHARS = 10_000

/** Side Panel 多轮会话上下文（Omnibox 不传）。 */
export const recallDialogContextSchema = z.object({
  /** 本轮之前已发送的用户原文（有序；最多 5）。 */
  priorUserUtterances: z.array(z.string().max(RECALL_CLUE_MAX_CHARS)).max(5).optional(),
  /** 上一轮合并后的 ParsedRecallClue 快照。 */
  accumulated: ParsedRecallClueSchema.optional(),
  /** 本会话已否定的 MemoryItem id（硬排除）。 */
  dismissedIds: z.array(z.string().uuid()).max(50).optional(),
  /**
   * 当前标签页域名（§7.1 Contextual Clue；不含路径）。
   * 仅在 pageContextMode 为 boost/restrict 时参与检索；none 时忽略。
   */
  currentTabDomain: z.string().max(253).optional(),
  /**
   * 当前页上下文模式（默认 none）。
   * none=不参与；boost=同域软抬；restrict=同域硬筛。
   */
  pageContextMode: z.enum(PAGE_CONTEXT_MODES).optional(),
  /**
   * 来源范围（默认 all）。
   * text_excerpt / bookmark 在候选加载后按 MemoryItem.type 硬筛。
   */
  sourceScope: z.enum(RECALL_SOURCE_SCOPES).optional()
})

export type RecallDialogContext = z.infer<typeof recallDialogContextSchema>

/**
 * Recall 来源（用于 activeRecallId 命名空间隔离）。
 * - sidepanel：Side Panel 主壳
 * - omnibox：地址栏
 * - extension-page：扩展内页（Settings 等）
 */
export const RECALL_SOURCE = {
  sidepanel: 'sidepanel', // Side Panel
  omnibox: 'omnibox', // Omnibox
  extensionPage: 'extension-page' // 扩展内页
} as const

export type RecallSource = (typeof RECALL_SOURCE)[keyof typeof RECALL_SOURCE]

const recallWithCluePayloadSchema = z.object({
  /** 用户本轮 clue 原文 */
  clue: z.string().min(1).max(RECALL_CLUE_MAX_CHARS),
  /** 多轮会话上下文（Omnibox 通常不传） */
  context: recallDialogContextSchema.optional(),
  /**
   * 来源标记（用于 active recall 命名空间隔离，避免 Side Panel cancel Omnibox）。
   * Side Panel / Omnibox / 扩展页各自独立追踪；UI 层填。
   */
  source: z.enum([
    RECALL_SOURCE.sidepanel, // Side Panel
    RECALL_SOURCE.omnibox, // Omnibox
    RECALL_SOURCE.extensionPage // 扩展内页
  ]),
  /**
   * 本轮请求 id。SW 用它做 in-flight 追踪：
   * - 同 source 收到新 RECALL_WITH_CLUE 自动覆盖 activeRecallId
   * - 收到 RECALL_CANCEL{ recallId } 时清除
   * - handler 入口若 recallId !== activeRecallId → 直接早退（不调 LLM / 不写 telemetry）
   * 必填；UI 层生成（递增数字或 UUID）。
   */
  recallId: z.string().min(1).max(64),
  /**
   * Side Panel 可见进展：本轮请求 id，SW 经 RECALL_VISIBLE_PROGRESS 回推阶段。
   * Omnibox / 无 UI 监听时可省略。
   */
  progressRequestId: z.string().min(1).max(128).optional()
})

/** Recall 主动取消信号。Side Panel 提交新 clue 时同步发出，旧 in-flight 早退。 */
const recallCancelPayloadSchema = z.object({
  source: z.enum([
    RECALL_SOURCE.sidepanel, // Side Panel
    RECALL_SOURCE.omnibox, // Omnibox
    RECALL_SOURCE.extensionPage // 扩展内页
  ]),
  /** 要取消的 in-flight recallId */
  recallId: z.string().min(1).max(64)
})

/** Recall 面向 UI 的稳定错误码。 */
export const RecallErrorCodeSchema = z.enum([
  'RECALL_FAILED' // Recall 流水线失败
])

export type RecallErrorCode = z.infer<typeof RecallErrorCodeSchema>

/** 根据线索执行 Recall。 */
export type RecallWithClueMessage = {
  scope: BackgroundMessageScope
  type: 'RECALL_WITH_CLUE'
  payload: z.infer<typeof recallWithCluePayloadSchema>
}

/** Recall 主动取消（Side Panel → SW）。 */
export type RecallCancelMessage = {
  scope: BackgroundMessageScope
  type: 'RECALL_CANCEL'
  payload: z.infer<typeof recallCancelPayloadSchema>
}

/** 读取当前浏览页域名（composer 页上下文开关展示；不参与检索）。 */
export type GetRecallPageContextMessage = {
  scope: BackgroundMessageScope
  type: 'GET_RECALL_PAGE_CONTEXT'
}

export type GetRecallPageContextResponse =
  | {
      ok: true
      /** 规范化前的 host；无可用 http(s) Tab 时为 null */
      domain: string | null
    }
  | {
      ok: false
      errorCode: 'RECALL_FAILED'
      error?: string
    }

/** composer URL 芯片：异步解析展示标题（本机库优先，其次打开中的 tab；不联网抓页）。 */
const resolveClueUrlDisplayPayloadSchema = z.object({
  /** 规范化后的 http(s) URL；单次最多 8 条。 */
  urls: z.array(z.string().url().max(2000)).min(1).max(8)
})

export type ResolveClueUrlDisplayPayload = z.infer<typeof resolveClueUrlDisplayPayloadSchema>

export type ResolveClueUrlDisplayMessage = {
  scope: BackgroundMessageScope
  type: 'RESOLVE_CLUE_URL_DISPLAY'
  payload: ResolveClueUrlDisplayPayload
}

/**
 * 单条解析来源。
 * - library：本机 Memory（书签 title / 摘录 pageTitle）
 * - tab：当前浏览器已打开标签的 title
 * - none：未命中（UI 保持缩短 host/path）
 */
export type ClueUrlDisplaySource =
  | 'library' // 本机库标题
  | 'tab' // 打开中的标签标题
  | 'none' // 无标题，回退缩短 URL

export type ResolveClueUrlDisplayEntry = {
  /** 请求中的规范化 URL */
  url: string
  /** 解析到的展示标题；无则 null（UI 回退缩短 URL） */
  title: string | null
  /** 标题来源：本机库 / 打开中的 tab / 无 */
  source: ClueUrlDisplaySource
}

export type ResolveClueUrlDisplayResponse =
  | {
      ok: true
      /** 与请求 urls 对齐的解析结果 */
      entries: ResolveClueUrlDisplayEntry[]
    }
  | {
      ok: false
      errorCode: 'RECALL_FAILED'
      error?: string
    }

export type RecallBackgroundMessage =
  | RecallWithClueMessage
  | RecallCancelMessage
  | GetRecallPageContextMessage
  | ResolveClueUrlDisplayMessage

export type RecallSuccessResponse = {
  ok: true
  /** 邻域结果（Top Pick / 弱候选 / no_match） */
  result: RecallResult
}

export type RecallErrorResponse = {
  ok: false
  /** 稳定错误码（UI 经 t() 展示） */
  errorCode: RecallErrorCode
  /** 开发者向细节；禁止当 UI 分支依据 */
  error?: string
}

export type RecallBackgroundResponse = RecallSuccessResponse | RecallErrorResponse

/** Recall 取消响应（Side Panel → SW → Side Panel；Side Panel 通常不再消费）。 */
export type RecallCancelResponse = {
  ok: true
  /** 是否清掉了匹配的 in-flight recallId */
  cleared: boolean
}

export function parseRecallWithCluePayload(value: unknown) {
  return recallWithCluePayloadSchema.parse(value)
}

export function parseRecallCancelPayload(value: unknown) {
  return recallCancelPayloadSchema.parse(value)
}

export function parseResolveClueUrlDisplayPayload(value: unknown) {
  return resolveClueUrlDisplayPayloadSchema.parse(value)
}
