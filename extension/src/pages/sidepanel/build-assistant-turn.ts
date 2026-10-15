import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'
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
  visibleCount?: number
  rankedTotalCount?: number
  candidateSectionLabel?: string
  suggestions?: RecallSuggestion[]
  composerNarrowExamples?: string[]
  recallFramingFacts?: RecallFramingFacts
  understandingEcho?: string[]
  deeperReadingTip?: string
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
    ...(input.visibleCount === undefined ? {} : { visibleCount: input.visibleCount }),
    ...(input.rankedTotalCount === undefined ? {} : { rankedTotalCount: input.rankedTotalCount }),
    ...(input.candidateSectionLabel === undefined
      ? {}
      : { candidateSectionLabel: input.candidateSectionLabel }),
    ...(input.suggestions === undefined ? {} : { suggestions: input.suggestions }),
    ...(input.composerNarrowExamples === undefined
      ? {}
      : { composerNarrowExamples: input.composerNarrowExamples }),
    ...(input.recallFramingFacts === undefined
      ? {}
      : { recallFramingFacts: input.recallFramingFacts }),
    ...(input.understandingEcho === undefined
      ? {}
      : { understandingEcho: input.understandingEcho }),
    ...(input.deeperReadingTip === undefined ? {} : { deeperReadingTip: input.deeperReadingTip }),
    allowDismiss: input.allowDismiss ?? false
  }
}
