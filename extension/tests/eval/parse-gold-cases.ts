import type { RecallRelativeTimeLabel } from '@/core/recall/parse-recall-clue-lexicon'
import type {
  RecallBehaviorHint,
  RecallClueConfidence,
  RecallObjectType
} from '@/core/recall/parse-recall-clue-types'

/**
 * 理想槽位（人工金标字段形状）。
 * - 字段省略 = 不检查该项
 * - `null`（timeLabel / objectTypes / behaviorHints）= 该项必须缺失
 * - contentTerms：默认要求 mustInclude 全部出现；exact 时集合须精确相等
 *
 * 仍被 `metrics.ts` 槽位一致率与 `diffParseGoldSlots` 使用。
 * 全表 `PARSE_GOLD_CASES` 与 `ParseGoldCase` 门禁壳已随 parse-gold:llm 报告链退役删除
 *（历史表见 `docs/audits/snapshots/`）。
 */
export interface ParseGoldSlots {
  timeLabel?: RecallRelativeTimeLabel | null
  objectTypes?: RecallObjectType[] | null
  behaviorHints?: RecallBehaviorHint[] | null
  /** true = 必须有 noteHint；false = 必须无 */
  noteHint?: boolean
  contentTermsMustInclude?: string[]
  contentTermsMustExclude?: string[]
  contentTermsExact?: boolean
  /** 明确排除槽：须全部出现在 excludeContentTerms */
  excludeContentTermsMustInclude?: string[]
  /** 排除槽不得含这些词（冲突消解后） */
  excludeContentTermsMustExclude?: string[]
  /** true = excludeContentTerms 须与 mustInclude 精确相等（可空） */
  excludeContentTermsExact?: boolean
  /** true = 不得有排除槽（空或缺省） */
  excludeContentTermsEmpty?: boolean
  confidence?: RecallClueConfidence
}
