/**
 * 托管 / 线索 chat 补全的任务种类（taskKind）。
 * Phase 0–1：观测 + 模型/maxTokens 路由插座；未配分档 env 时模型与全局 AI_HOSTED_MODEL 一致。
 * 见 docs/architecture/2026-10-任务级模型路由方案.md
 */

import { clampCompletionMaxTokens, resolveHostedModel } from './ai-hosted'

/** 已支持的 chat 任务种类（闭集）。 */
export const AI_CHAT_TASK_KINDS = [
  'nlu', // clue 理解 → 结构化槽位
  'framing_nlg', // Framing 润色
  'follow_up_nlg', // need_a_clue 追问
  'narrow_polish', // composer Narrow 举例润色
  'enrichment', // Capture enrichment（若走可配置层）
  'gs_samples' // Getting Started 示意 clue
] as const

export type AiChatTaskKind = (typeof AI_CHAT_TASK_KINDS)[number]

/** 缺省任务（兼容旧客户端未传 taskKind）。 */
export const AI_CHAT_TASK_KIND_DEFAULT: AiChatTaskKind = 'nlu'

/** NLG 浅任务（可共享 AI_HOSTED_MODEL_NLG 覆盖）。 */
const NLG_TASK_KINDS = new Set<AiChatTaskKind>(['framing_nlg', 'follow_up_nlg', 'narrow_polish'])

/**
 * 解析请求体 taskKind；未知或空 → 默认 nlu（不 400，兼容旧客户端）。
 */
export function parseAiChatTaskKind(raw: unknown): AiChatTaskKind {
  if (typeof raw !== 'string') {
    return AI_CHAT_TASK_KIND_DEFAULT
  }
  const trimmed = raw.trim()
  if ((AI_CHAT_TASK_KINDS as readonly string[]).includes(trimmed)) {
    return trimmed as AiChatTaskKind
  }
  return AI_CHAT_TASK_KIND_DEFAULT
}

export type AiTaskModelEnv = {
  AI_HOSTED_MODEL?: string
  /** 可选：仅 nlu 覆盖 */
  AI_HOSTED_MODEL_NLU?: string
  /** 可选：framing / follow_up / narrow 共用覆盖 */
  AI_HOSTED_MODEL_NLG?: string
  /** 可选：enrichment 覆盖 */
  AI_HOSTED_MODEL_ENRICHMENT?: string
  /** 可选：gs_samples 覆盖 */
  AI_HOSTED_MODEL_GS_SAMPLES?: string
}

/**
 * 按 taskKind 解析模型名；未配分档 env 时回退全局 AI_HOSTED_MODEL。
 * 客户端不得传 model 字符串——仅服务端由此决定。
 */
export function resolveHostedModelForTask(env: AiTaskModelEnv, taskKind: AiChatTaskKind): string {
  const fallback = resolveHostedModel(env)
  switch (taskKind) {
    case 'nlu': {
      const override = env.AI_HOSTED_MODEL_NLU?.trim()
      return override || fallback
    }
    case 'framing_nlg':
    case 'follow_up_nlg':
    case 'narrow_polish': {
      const override = env.AI_HOSTED_MODEL_NLG?.trim()
      return override || fallback
    }
    case 'enrichment': {
      const override = env.AI_HOSTED_MODEL_ENRICHMENT?.trim()
      return override || fallback
    }
    case 'gs_samples': {
      const override = env.AI_HOSTED_MODEL_GS_SAMPLES?.trim()
      return override || fallback
    }
  }
}

/** 是否属于浅 NLG 任务（观测/后续配额权重用）。 */
export function isNlgAiChatTaskKind(taskKind: AiChatTaskKind): boolean {
  return NLG_TASK_KINDS.has(taskKind)
}

/**
 * 各 task 的 maxTokens 服务端上限（亦作未传 requested 时的默认）。
 * NLG / polish 更短，压费用与超时；nlu 保持现网 400。
 */
export const AI_CHAT_TASK_MAX_TOKENS: Record<AiChatTaskKind, number> = {
  nlu: 400,
  framing_nlg: 256,
  follow_up_nlg: 256,
  narrow_polish: 128,
  enrichment: 400,
  gs_samples: 400
}

/**
 * 按 taskKind 解析 maxTokens：先落到合法区间，再钳到该任务上限。
 * 客户端可传更小值；不得突破任务 cap（防刷）。
 */
export function resolveHostedMaxTokensForTask(
  taskKind: AiChatTaskKind,
  requested: number | undefined
): number {
  const cap = AI_CHAT_TASK_MAX_TOKENS[taskKind]
  const withinGlobal = clampCompletionMaxTokens(requested, cap)
  return Math.min(cap, withinGlobal)
}
