/**
 * AI 上游候选注册表（Batch 2）。
 *
 * 只登记元数据与合格任务；不持有密钥值。
 * listRoutableCandidates 仅返回 enabled 且 qualifiedTaskKinds 含该 taskKind 的条目。
 * 生产默认仍走 AI_PROVIDER 单路径；本表供 shadow / 后续 quota 路由查询。
 */

import { AI_CHAT_TASK_KINDS, type AiChatTaskKind } from '../../config/ai-task-kind'

/** 隐私档：付费标准 / 免费条款未核 / 免费条款已核。 */
export type AiCandidatePrivacyTier =
  | 'paid_standard' // 付费标准条款
  | 'free_terms_unverified' // 免费层条款未核验
  | 'free_terms_ok' // 免费层条款已核验

/** 免费层限额（可选；无则视为付费条目，账本只记账不拦截）。 */
export type AiCandidateFreeTier = {
  rpm?: number // 每分钟请求上限
  tpm?: number // 每分钟 token 上限
  rpd?: number // 每日请求上限
  tpd?: number // 每日 token 上限
  /** IANA 时区名（如 America/Los_Angeles）；日窗重置参考 */
  resetTimezone?: string
  /** 日窗重置的 UTC 小时（0–23） */
  resetHourUtc?: number
}

/** 付费单价（每 1M token；可选，仅观测）。 */
export type AiCandidatePaidPricePer1M = {
  input?: number
  output?: number
}

/** 注册表条目。 */
export type AiCandidateEntry = {
  /** 稳定候选 id（如 deepseek-flash） */
  candidateId: string
  /** deepseek | gateway-compat */
  providerId: 'deepseek' | 'gateway-compat'
  /** compat 时的厂商前缀 */
  compatVendor?: 'deepseek' | 'openai' | 'google-ai-studio' | 'groq'
  /**
   * 模型名。gateway-compat 时为 `{provider}/{model}` 串；
   * deepseek 原生时为上游模型名（如 deepseek-flash）。
   */
  model: string
  /** Env 中 API key 的键名（只登记名，不登记值） */
  apiKeyEnv: string
  freeTier?: AiCandidateFreeTier
  paidPricePer1M?: AiCandidatePaidPricePer1M
  privacyTier: AiCandidatePrivacyTier
  /**
   * 已合格的 taskKind；空数组 = 尚未合格（不得进入 routable）。
   * deepseek 现任对照组填全部 10 种。
   */
  qualifiedTaskKinds: readonly AiChatTaskKind[]
  /** 判读结论与日期 */
  evalNote: string
  /** 注册表级开关；默认 false，仅现任对照组 true */
  enabled: boolean
}

/**
 * Env 中已知可用作 apiKeyEnv 的键名（契约测试闭集）。
 * 与 gateway-compat / deepseek adapter 读取的 Secret 对齐。
 */
export const AI_CANDIDATE_KNOWN_API_KEY_ENV_NAMES = [
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GROQ_API_KEY'
] as const

/** 全量候选（顺序稳定；路由取第一个可用）。 */
export const AI_CANDIDATE_REGISTRY: readonly AiCandidateEntry[] = [
  {
    candidateId: 'deepseek-flash',
    providerId: 'deepseek',
    model: 'deepseek-flash',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    privacyTier: 'paid_standard',
    qualifiedTaskKinds: [...AI_CHAT_TASK_KINDS],
    evalNote:
      '2026-11-27：现任生产对照组（AI_PROVIDER=deepseek）；全部 taskKind 合格；Batch 2 注册表落地。',
    enabled: true
  },
  {
    candidateId: 'gemini-3.5-flash-lite',
    providerId: 'gateway-compat',
    compatVendor: 'google-ai-studio',
    model: 'google-ai-studio/gemini-3.5-flash-lite',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    freeTier: {
      rpm: 15,
      tpm: 250_000,
      rpd: 500,
      resetTimezone: 'America/Los_Angeles',
      resetHourUtc: 8
    },
    privacyTier: 'free_terms_unverified',
    qualifiedTaskKinds: [],
    evalNote: '2026-11-27：JSON 失败率 4.29%，未过门槛；enabled=false，qualifiedTaskKinds 空。',
    enabled: false
  },
  {
    candidateId: 'groq-gpt-oss-120b',
    providerId: 'gateway-compat',
    compatVendor: 'groq',
    model: 'groq/openai/gpt-oss-120b',
    apiKeyEnv: 'GROQ_API_KEY',
    freeTier: {
      rpm: 30,
      tpm: 8_000,
      rpd: 1_000,
      tpd: 200_000,
      resetTimezone: 'UTC',
      resetHourUtc: 0
    },
    privacyTier: 'free_terms_unverified',
    qualifiedTaskKinds: [],
    evalNote:
      '2026-11-27：core 68 / intent 68 / JSON 2.86%，未过门槛；enabled=false，qualifiedTaskKinds 空。',
    enabled: false
  }
] as const

const BY_ID = new Map(AI_CANDIDATE_REGISTRY.map(entry => [entry.candidateId, entry]))

/** 按 id 取条目；未知返回 undefined。 */
export function getCandidate(candidateId: string): AiCandidateEntry | undefined {
  return BY_ID.get(candidateId)
}

/**
 * 可路由候选：enabled 且 qualifiedTaskKinds 含该 taskKind。
 * 保持注册表顺序（当前仅 deepseek-flash 可路由）。
 */
export function listRoutableCandidates(taskKind: AiChatTaskKind): AiCandidateEntry[] {
  return AI_CANDIDATE_REGISTRY.filter(
    entry => entry.enabled && entry.qualifiedTaskKinds.includes(taskKind)
  )
}
