import { afterEach, describe, expect, it, vi } from 'vitest'

const { getWorkerApiAccessTokenMock } = vi.hoisted(() => ({
  getWorkerApiAccessTokenMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getWorkerApiAccessTokenMock
}))

import { requestMemoryEnrichmentProposal } from './memory-enrichment-api-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('requestMemoryEnrichmentProposal auth', () => {
  it('无 token → enrichment_missing_auth 且不发 fetch', async () => {
    getWorkerApiAccessTokenMock.mockResolvedValue(null)
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    await expect(requestMemoryEnrichmentProposal({ title: 'x' })).rejects.toThrow(
      'enrichment_missing_auth'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('有 token → Authorization Bearer', async () => {
    getWorkerApiAccessTokenMock.mockResolvedValue('ydt_test_token')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          proposal: { keywords: ['a'], entities: [], summary: 's' }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    globalThis.fetch = fetchMock as typeof fetch

    await requestMemoryEnrichmentProposal({ title: 'hello' }, 'http://localhost:8787')
    expect(fetchMock).toHaveBeenCalled()
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer ydt_test_token')
  })
})
