/**
 * 语料适配器（Corpus Adapter）契约旁挂类型。
 *
 * 产品 Normative：产品文档 §0.1.1「语料源可插拔」。
 * 工程说明：`docs/engineering/语料适配器契约.md`。
 *
 * 本文件**不**实现第三方连接器；只固定插头形状与准入清单，避免日后各写一套。
 */

import { z } from 'zod'

/**
 * 内建语料源（今日已接线）。
 * - text_excerpt：摘录（主角）
 * - bookmark：Chrome 书签（配角）
 */
export const BuiltinCorpusSourceSchema = z.enum([
  'text_excerpt', // 摘录适配器
  'bookmark' // 书签适配器
])

/**
 * 质量门禁结果（映射后、写库前）。
 * - accept：可进召回池
 * - weak：可写但须降权 / 引导补锚点
 * - reject：拒写
 */
export const CorpusQualityGateDecisionSchema = z.enum([
  'accept', // 接受
  'weak', // 弱锚点
  'reject' // 拒绝
])

type CorpusQualityGateDecision = z.infer<typeof CorpusQualityGateDecisionSchema>

/** 门禁输出：决策 + 稳定机器原因（日志 / 将来 errorCode）。 */
export type CorpusQualityGateResult = {
  decision: CorpusQualityGateDecision
  /** 稳定英文蛇形原因，便于过滤日志 */
  reason: string
}

/**
 * 第三方源准入检查项 id（实现侧 checklist；顺序即推荐审题顺序）。
 * 与 `docs/engineering/语料适配器契约.md` §5 对齐。
 */
export const THIRD_PARTY_CORPUS_ADMISSION_CHECKS = [
  'proposition_before_after_recall', // 命题：接入前后口语找回对比
  'object_id_provenance_body', // 对象：稳定 id + 出处 + 可问正文
  'quality_gate_min_anchor', // 门禁：弱锚点拒写或降权
  'map_to_memory_item_only', // 映射：只产 MemoryItem
  'same_recall_pipeline', // 主链：同一 Filter/Hybrid
  'explicit_auth_revocable', // Auth：显式可撤销
  'idempotent_remote_upsert', // 幂等：source+remoteId upsert
  'not_notes_product', // 边界：导入≠做 Notion
  'flow_log_per_source', // 观测：按源可过滤日志
  'acceptance_must_or_manual' // 验收：must 或 §5 步骤
] as const

/**
 * 适配器管道阶段（文档与日志共用口径；非运行时状态机）。
 * - auth：认证
 * - fetch：拉取
 * - map：映射为 MemoryItem
 * - gate：质量门禁
 * - write：确定性写库
 */
export const CorpusAdapterStageSchema = z.enum([
  'auth', // 认证
  'fetch', // 拉取
  'map', // 映射
  'gate', // 门禁
  'write' // 写库
])
