import { afterEach, describe, expect, it, vi } from 'vitest'

const { getWorkerApiAccessTokenMock } = vi.hoisted(() => ({
  getWorkerApiAccessTokenMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getWorkerApiAccessTokenMock
}))

import { requestGettingStartedClueSamples } from './gs-clue-samples-api-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

const fourClues = [
  'That piece about why agents struggle to keep track of earlier turns',
  'I remember reading something explaining why long-term memory is hard',
  'Something from work about giving assistants memory beyond one session',
  'The surprising bit about agents forgetting context even with history'
]

describe('requestGettingStartedClueSamples auth', () => {
  it('无 token → gs_missing_auth 且不发 fetch', async () => {
    getWorkerApiAccessTokenMock.mockResolvedValue(null)
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    await expect(
      requestGettingStartedClueSamples({ title: 'Why AI Agents Need Long-Term Memory' })
    ).rejects.toThrow('gs_missing_auth')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('有 token → Authorization Bearer', async () => {
    getWorkerApiAccessTokenMock.mockResolvedValue('ydt_gs_token')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ clues: fourClues.map(text => ({ text })) }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )
    globalThis.fetch = fetchMock as typeof fetch

    await requestGettingStartedClueSamples(
      { title: 'Why AI Agents Need Long-Term Memory' },
      'http://localhost:8787'
    )
    expect(fetchMock).toHaveBeenCalled()
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer ydt_gs_token')
  })
})
