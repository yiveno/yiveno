import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { createRecallOutcomeSessionState } from '@/application/recall/commit-recall-outcome'
import type { ConversationTurn } from '@/pages/sidepanel/recall-conversation-types'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import {
  collectExportableDetailExportIds,
  useDetailExport
} from '@/pages/sidepanel/use-detail-export'

function card(id: string, siblings?: RecallCardModel[]): RecallCardModel {
  return {
    id,
    itemKind: 'text_excerpt',
    title: id,
    subtitle: '',
    url: `https://example.com/${id}`,
    typeLabel: 'Excerpt',
    titleParts: [{ text: id, hit: false }],
    subtitleParts: [],
    excerptParts: [],
    noteParts: [],
    ...(siblings ? { siblings } : {})
  }
}

describe('collectExportableDetailExportIds', () => {
  it('收集 primary / related / candidates 并含 siblings，去重保序', () => {
    const turns: ConversationTurn[] = [
      {
        id: 'u1',
        role: 'user',
        text: 'x'
      },
      {
        id: 'a1',
        role: 'assistant',
        tone: 'confident',
        text: '',
        allowDismiss: true,
        primaryCard: card('p1', [card('s1'), card('s2')]),
        relatedGuessCard: card('r1'),
        candidateCards: [card('c1'), card('p1')]
      }
    ]
    expect(collectExportableDetailExportIds(turns)).toEqual(['p1', 's1', 's2', 'r1', 'c1'])
  })
})

describe('useDetailExport bulk', () => {
  it('全选 → 反选 → 退出重置为全选', () => {
    const conversationTurns = ref<ConversationTurn[]>([
      {
        id: 'a1',
        role: 'assistant',
        tone: 'confident',
        text: '',
        allowDismiss: true,
        primaryCard: card('a'),
        candidateCards: [card('b'), card('c')]
      }
    ])
    const outcomeSession = ref(createRecallOutcomeSessionState())
    const api = useDetailExport({ conversationTurns, outcomeSession })

    api.enterDetailExportMode()
    expect(api.detailExportBulkAction.value).toBe('selectAll')

    api.handleDetailExportBulk()
    expect([...api.selectedDetailExportIds.value].sort()).toEqual(['a', 'b', 'c'])
    expect(api.detailExportBulkAction.value).toBe('invert')

    api.handleToggleDetailExportSelection('b')
    api.handleDetailExportBulk()
    expect([...api.selectedDetailExportIds.value].sort()).toEqual(['b'])
    expect(api.detailExportBulkAction.value).toBe('selectAll')

    api.exitDetailExportMode()
    expect(api.selectedDetailExportIds.value.size).toBe(0)
    expect(api.detailExportBulkAction.value).toBe('selectAll')
  })
})
