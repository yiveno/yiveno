import type {
  ConversationTurn,
  AssistantTurn,
  RecallSuggestion
} from '@/pages/popup/recall-conversation-types'
import type { PopupRecallCardModel } from '@/pages/popup/RecallResultCard.vue'

export function createAssistantTurn(input: {
  id: string
  tone: AssistantTurn['tone']
  text: string
  primaryCard?: PopupRecallCardModel | null
  relatedGuessCard?: PopupRecallCardModel | null
  relatedGuessLabel?: string
  candidateCards?: PopupRecallCardModel[]
  suggestions?: RecallSuggestion[]
  allowDismiss?: boolean
}): ConversationTurn {
  return {
    id: input.id,
    role: 'assistant',
    tone: input.tone,
    text: input.text,
    ...(input.primaryCard === undefined ? {} : { primaryCard: input.primaryCard }),
    ...(input.relatedGuessCard === undefined ? {} : { relatedGuessCard: input.relatedGuessCard }),
    ...(input.relatedGuessLabel === undefined
      ? {}
      : { relatedGuessLabel: input.relatedGuessLabel }),
    ...(input.candidateCards === undefined ? {} : { candidateCards: input.candidateCards }),
    ...(input.suggestions === undefined ? {} : { suggestions: input.suggestions }),
    allowDismiss: input.allowDismiss ?? false
  }
}
