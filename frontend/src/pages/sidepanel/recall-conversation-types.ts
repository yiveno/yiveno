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
  /** 次要相关 / 弱候选列表 */
  candidateCards?: RecallCardModel[]
  /** 候选区标题（如「可能是这些」） */
  candidateSectionLabel?: string
  suggestions?: RecallSuggestion[]
  allowDismiss: boolean
}

export type ConversationTurn = UserTurn | AssistantTurn
