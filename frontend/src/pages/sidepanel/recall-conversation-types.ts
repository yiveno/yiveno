import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'

export type RecallSuggestion = {
  id: string
  label: string
  value: string
}

export type UserTurn = {
  id: string
  role: 'user'
  text: string
}

export type AssistantTurn = {
  id: string
  role: 'assistant'
  tone: 'confident' | 'uncertain' | 'miss' | 'error'
  text: string
  /** 续找线程时展示：标明仍在本找，非新一轮 */
  contextStatus?: string
  primaryCard?: RecallCardModel | null
  /** 最近同类猜测卡（非 Top Pick）；与 primaryCard 互斥使用场景 */
  relatedGuessCard?: RecallCardModel | null
  /** 猜测卡上方硬标签文案 */
  relatedGuessLabel?: string
  /**
   * 排序池全量卡片（可多于首屏；展示用 visibleCount 截取）。
   */
  candidateCards?: RecallCardModel[]
  /** 当前可见条数（首屏 PAGE_SIZE，Show more 递增） */
  visibleCount?: number
  /** 相关总数（与 candidateCards.length 对齐；文案报 N） */
  rankedTotalCount?: number
  /** 可选列表眉题；高置信排序列表通常省略，由 reply 文案承担 */
  candidateSectionLabel?: string
  suggestions?: RecallSuggestion[]
  /**
   * SW 返回的 grounded Narrow 举例（可选经 LLM 润色）。
   * 缺省时 Side Panel 对本轮 candidateCards 再抽。
   */
  composerNarrowExamples?: string[]
  /** 列表级 Framing 事实；Show more 时重渲染 P6 计数。 */
  recallFramingFacts?: RecallFramingFacts
  allowDismiss: boolean
}

export type ConversationTurn = UserTurn | AssistantTurn
