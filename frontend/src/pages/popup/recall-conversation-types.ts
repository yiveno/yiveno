import type { PopupRecallCardModel } from '@/pages/popup/RecallResultCard.vue'

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
  primaryCard?: PopupRecallCardModel | null
  /** 最近同类猜测卡（非 Top Pick）；与 primaryCard 互斥使用场景 */
  relatedGuessCard?: PopupRecallCardModel | null
  /** 猜测卡上方硬标签文案 */
  relatedGuessLabel?: string
  /** 次要相关 / 弱候选列表 */
  candidateCards?: PopupRecallCardModel[]
  /** 候选区标题（如「可能是这些」） */
  candidateSectionLabel?: string
  suggestions?: RecallSuggestion[]
  allowDismiss: boolean
}

export type ConversationTurn = UserTurn | AssistantTurn
