/**
 * `nlu:try` 终端报告的类型表（仅 CLI 可读契约；不进生产 Recall runtime）。
 *
 * 对齐 Hybrid 理解阶段出口：`understandRecallClue` → 下一环接手点。
 */

import type { ClueUnderstandingSource } from '../src/core/recall/understand/understand-recall-clue'
import type { ClueUnderstandingMode } from '../src/core/recall/understand/select-clue-understanding-mode'
import type { ClueProcessingRejectReason } from '../src/core/recall/understand/select-clue-processing-disposition'
import type {
  RecallBehaviorHint,
  RecallClueConfidence,
  RecallClueIntent,
  RecallObjectType,
  RecallTimeConfidence
} from '../src/core/recall/parse-recall-clue-types'

/**
 * 终端打印用的槽位摘要（由 `ParsedRecallClue` 投影；去掉 embedding 等大字段）。
 * 与 Hybrid 写入 `mergeRecallDialogTurn` 的 `currentParsed` 语义一致，仅展示形态。
 */
export type NluTryParsedSlotsView = {
  /** 相对时间标签（如 yesterday / last_week）；无则 null */
  timeLabel: string | null
  /** 闭合时间窗 ISO；无则 null */
  timeRange: { from: string; to: string } | null
  /**
   * 时间置信度（ADR-011）。
   * - high：硬筛
   * - low：软排
   * - null：无线束
   */
  timeConfidence: RecallTimeConfidence | null
  /** 对象类型闭集（bookmark / article / …）；空数组 = 未听出 */
  objectTypes: RecallObjectType[]
  /** 行为提示闭集（half_read / often_opened / recently_saved） */
  behaviorHints: RecallBehaviorHint[]
  /** 是否指向附注（MemoryItem.clues.note） */
  noteHint: boolean
  /** 内容检索词（剥时间/类型等后的词） */
  contentTerms: string[]
  /** 明确排除词（not the …）；空 = 无排除槽 */
  excludeContentTerms: string[]
  /** 解析置信度 high / medium / low */
  confidence: RecallClueConfidence
  /** 用户意图；缺省按 recall */
  intent: RecallClueIntent
  /** intent=chitchat 时的自然回复；其余 null */
  assistantReply: string | null
  /**
   * 主题锚摘要；null = 未派生或无可展示 topic。
   * （完整 `ParsedRecallClue.topic` 可含 embedding，此处不打印）
   */
  topic: {
    /** 主题词面 */
    terms: string[]
    /** content=内容大意；goal=附注/目标指向 */
    source: 'content' | 'goal' // 内容 | 目标
    /** strong=有具体内容词；weak=仅弱指向 */
    strength: 'strong' | 'weak' // 强 | 弱
  } | null
}

/**
 * 交给下一链路时的旁路元数据（计时 / 遥测 / 调试）。
 * **不是**检索主输入；主输入见 `NluTryNextStageHandoff.payload`。
 */
export type NluTryHandoffMeta = {
  /** 理解引擎来源：rules / llm / rules_fallback（与 pipelineTiming.understandSource 同源） */
  understandSource: ClueUnderstandingSource
  /** 理解模式：lexical | semantic */
  mode: ClueUnderstandingMode
  /**
   * `buildFilterClueFromParsed` 调试串。
   * Hybrid 主路径吃的是 parsed，不是单独传这个字符串。
   */
  filterClueDebug: string
}

/**
 * 理解阶段 → 下一环的交接报告。
 *
 * 产品真接手点（`hybrid-recall-backend`）：
 * - `reject_noise` → 直接 `no_match`，不进 merge/检索
 * - `intent=chitchat` + 非空回复 → `emptyKind=chitchat` 短路，不进 merge/检索
 * - 否则 `currentParsed: understood.parsed` → `mergeRecallDialogTurn` → topic → retrieve
 */
export type NluTryNextStageHandoff =
  | {
      /** 是否继续进入下一阶段 */
      continues: false
      /** 下一站标签：流水线在此结束 */
      next: 'end_no_match'
      /** 网关拒绝原因（keyboard_mash 等） */
      reason: ClueProcessingRejectReason | null
      /** 无 payload：Hybrid 不接收 parsed */
      payload: null
      /** 给人看的一句说明 */
      note: string
    }
  | {
      /** 是否继续进入下一阶段 */
      continues: false
      /** 闲聊短路终局 */
      next: 'end_chitchat_reply'
      /** 仅自然回复；Hybrid 不拿 parsed */
      payload: { assistantReply: string | null }
      /** 给人看的一句说明 */
      note: string
    }
  | {
      /** 是否继续进入下一阶段 */
      continues: true
      /** 下一站标签（人读路径） */
      next: 'mergeRecallDialogTurn → topic → retrieve'
      /**
       * 下一环主输入：对应 Hybrid 的 `currentParsed`（ParsedRecallClue 投影）。
       * 首轮无 accumulated 时，merge 结果 ≈ 本 payload。
       */
      payload: NluTryParsedSlotsView
      /** 旁路元数据；勿当成检索主输入 */
      meta: NluTryHandoffMeta
      /** 给人看的一句说明 */
      note: string
    }

/**
 * `nlu:try` 一次运行的完整终端报告。
 */
export type NluTryReport = {
  /** 噪音网关：proceed | reject_noise */
  disposition: 'proceed' | 'reject_noise'
  /** reject 时非 null */
  rejectReason: ClueProcessingRejectReason | null
  /** 理解模式 */
  mode: ClueUnderstandingMode
  /** 实际产出结构的引擎 */
  source: ClueUnderstandingSource
  /** 调试用 filter 词面（同 meta.filterClueDebug） */
  filterClue: string
  /** 本阶段解析槽位（完整理解结果投影） */
  parsed: NluTryParsedSlotsView
  /**
   * 真实要交给下一链路的交接对象。
   * 看懂下一环吃什么：先看 `continues`，再看 `payload`。
   */
  nextStageHandoff: NluTryNextStageHandoff
}
