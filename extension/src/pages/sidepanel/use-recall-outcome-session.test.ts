import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useRecallOutcomeSession } from '@/pages/sidepanel/use-recall-outcome-session'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

describe('handleOutcomeExitFound', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      popup_reply_miss: { message: 'Nothing close enough turned up.' }
    })
  })

  it('传 id 认领指定 open', () => {
    const onComplete = vi.fn()
    const { outcomeSession, handleOutcomeExitFound } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      recallTelemetry: {
        recordUserConfirmed: vi.fn()
      } as never,
      onCompleteNewFindSession: onComplete
    })

    outcomeSession.value = {
      ...outcomeSession.value,
      opens: [
        { id: 'item-a', at: '2026-11-10T00:00:00.000Z' },
        { id: 'item-b', at: '2026-11-10T00:01:00.000Z' }
      ]
    }

    handleOutcomeExitFound('item-a')

    expect(outcomeSession.value.exitChoice).toBe('found')
    expect(outcomeSession.value.exitFoundId).toBe('item-a')
    expect(onComplete).toHaveBeenCalledWith('exit_found')
  })

  it('不传或非法 id 回落最后一次 open', () => {
    const onComplete = vi.fn()
    const { outcomeSession, handleOutcomeExitFound } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      recallTelemetry: {
        recordUserConfirmed: vi.fn()
      } as never,
      onCompleteNewFindSession: onComplete
    })

    outcomeSession.value = {
      ...outcomeSession.value,
      opens: [
        { id: 'item-a', at: '2026-11-10T00:00:00.000Z' },
        { id: 'item-b', at: '2026-11-10T00:01:00.000Z' }
      ]
    }

    handleOutcomeExitFound()
    expect(outcomeSession.value.exitFoundId).toBe('item-b')

    handleOutcomeExitFound('not-in-opens')
    expect(outcomeSession.value.exitFoundId).toBe('item-b')
    expect(onComplete).toHaveBeenCalledTimes(2)
    expect(onComplete).toHaveBeenNthCalledWith(1, 'exit_found')
    expect(onComplete).toHaveBeenNthCalledWith(2, 'exit_found')
  })
})
