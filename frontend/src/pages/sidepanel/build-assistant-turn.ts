import type {
  ConversationTurn,
  AssistantTurn,
  RecallSuggestion
} from '@/pages/sidepanel/recall-conversation-types'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'

export function createAssistantTurn(input: {
  id: string
  tone: AssistantTurn['tone']
  text: string
  contextStatus?: string
  primaryCard?: RecallCardModel | null
  relatedGuessCard?: RecallCardModel | null
  relatedGuessLabel?: string
  candidateCards?: RecallCardModel[]
  candidateSectionLabel?: string
  suggestions?: RecallSuggestion[]
  allowDismiss?: boolean
}): ConversationTurn {
  return {
    id: input.id,
    role: 'assistant',
    tone: input.tone,
    text: input.text,
    ...(input.contextStatus === undefined ? {} : { contextStatus: input.contextStatus }),
    ...(input.primaryCard === undefined ? {} : { primaryCard: input.primaryCard }),
    ...(input.relatedGuessCard === undefined ? {} : { relatedGuessCard: input.relatedGuessCard }),
    ...(input.relatedGuessLabel === undefined
      ? {}
      : { relatedGuessLabel: input.relatedGuessLabel }),
    ...(input.candidateCards === undefined ? {} : { candidateCards: input.candidateCards }),
    ...(input.candidateSectionLabel === undefined
      ? {}
      : { candidateSectionLabel: input.candidateSectionLabel }),
    ...(input.suggestions === undefined ? {} : { suggestions: input.suggestions }),
    allowDismiss: input.allowDismiss ?? false
  }
}
