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
  candidateCards?: PopupRecallCardModel[]
  suggestions?: RecallSuggestion[]
  allowDismiss: boolean
}

export type ConversationTurn = UserTurn | AssistantTurn
