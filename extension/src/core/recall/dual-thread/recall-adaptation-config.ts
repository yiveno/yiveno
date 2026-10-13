/**
 * 暗线 · 受控适应配置登记（脚手架）。
 * 只登记「有哪些旋钮、在哪、如何回退」——**不**在运行时自动改值。
 *
 * 权威：docs/engineering/暗线基建-失败归因与受控适应.md · ADR-016
 */

import { z } from 'zod'

/** 配置表版本：旋钮登记变更时 bump（非自动学习代数）。 */
export const RECALL_ADAPTATION_CONFIG_VERSION = '2026-10-10.0' as const

export const RecallAdaptationLayerSchema = z.enum([
  'param', // 参数层：阈值 / 权重 / cap
  'strategy' // 策略层：路径选择 / 预算（登记预留；当前多为人工常量）
])

export const RecallAdaptationKnobSchema = z.object({
  /** 稳定 id */
  id: z.string().min(1).max(64),
  /** 适应层 */
  layer: RecallAdaptationLayerSchema,
  /** 中文说明 */
  summaryZh: z.string().min(1).max(160),
  /** 代码锚点（仓库相对路径或符号） */
  codeAnchor: z.string().min(1).max(200),
  /** 回退提示（git / 常量名） */
  rollbackHint: z.string().min(1).max(200),
  /** 改动前须过的评估门（简述） */
  evalGate: z.string().min(1).max(200),
  /** Omnibox 是否禁止触碰（ADR-007） */
  omniboxForbidden: z.boolean().default(false)
})

export type RecallAdaptationKnob = z.infer<typeof RecallAdaptationKnobSchema>

export const RecallAdaptationConfigSchema = z.object({
  version: z.string().min(1),
  /** 登记冻结说明 */
  noteZh: z.string().max(400),
  knobs: z.array(RecallAdaptationKnobSchema).min(1)
})

export type RecallAdaptationConfig = z.infer<typeof RecallAdaptationConfigSchema>

/**
 * 当前已登记旋钮（人工维护；改常量前先改本表或同 PR 更新）。
 * 值仍散落在既有模块——本表是索引，不是第二套真相源。
 */
export const RECALL_ADAPTATION_CONFIG: RecallAdaptationConfig = RecallAdaptationConfigSchema.parse({
  version: RECALL_ADAPTATION_CONFIG_VERSION,
  noteZh: '脚手架：禁止运行时自改。变更旋钮实际数值 = 明线任务 + must/§5；暗线笔记可选。',
  knobs: [
    {
      id: 'behavior_boost_cap',
      layer: 'param',
      summaryZh: '行为 soft rank 上限（settled/open）',
      codeAnchor: 'extension/src/core/recall/keyword-filter.ts · RECALL_BEHAVIOR_BOOST_CAP',
      rollbackHint: '恢复 keyword-filter.ts 中 RECALL_BEHAVIOR_BOOST_CAP 原值',
      evalGate: 'recall-eval must + 真机邻域抽测',
      omniboxForbidden: false
    },
    {
      id: 'outcome_pair_soft_adjust',
      layer: 'param',
      summaryZh: '本机 Outcome 对升/降权（须内容佐证）',
      codeAnchor: 'extension/src/application/recall/apply-stored-outcome-pairs.ts',
      rollbackHint: '关闭或回退 applyOutcomePairScoreAdjustments 权重',
      evalGate: 'must + Outcome 正例佐证护栏；Omnibox 禁止',
      omniboxForbidden: true
    },
    {
      id: 'time_confidence_hard_soft',
      layer: 'strategy',
      summaryZh: '相对时间 high 硬筛 / low 软排（ADR-011）',
      codeAnchor: 'extension/src/core/recall（时间置信度相关）',
      rollbackHint: 'ADR-011 常量与 soft reopen 例外',
      evalGate: 'time must + MCP Framing',
      omniboxForbidden: false
    },
    {
      id: 'hybrid_fusion',
      layer: 'strategy',
      summaryZh: '关键词 + 语义 Hybrid / RRF',
      codeAnchor: 'extension/src/application/recall/backends/hybrid-recall-backend.ts',
      rollbackHint: '降级关键词路径；Omnibox 禁止 Hybrid',
      evalGate: 'hybrid-eval + recall-eval must',
      omniboxForbidden: true
    },
    {
      id: 'content_term_corroboration',
      layer: 'strategy',
      summaryZh: '内容佐证门 + 硬筛空窗 soft 回退',
      codeAnchor: 'extension/src/core/recall/content-term-corroboration.ts',
      rollbackHint: '恢复佐证门阈值与 reopen 开关',
      evalGate: '相关 must（retention/yesterday 等）',
      omniboxForbidden: false
    }
  ]
})

/** 按 id 查找旋钮；未知 id → null。 */
export function getAdaptationKnob(id: string): RecallAdaptationKnob | null {
  return RECALL_ADAPTATION_CONFIG.knobs.find(k => k.id === id) ?? null
}

/** 列出禁止在 Omnibox 路径改动的旋钮 id。 */
export function listOmniboxForbiddenAdaptationKnobIds(): string[] {
  return RECALL_ADAPTATION_CONFIG.knobs.filter(k => k.omniboxForbidden).map(k => k.id)
}
