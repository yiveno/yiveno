import { describe, expect, test } from 'bun:test'

import type { Env } from '../types/env'
import { handleDreamingComplete } from './ai-dreaming'

describe('handleDreamingComplete 匿名挡', () => {
  test('isAnonymous → 403 anonymous_not_allowed（不进 peek）', async () => {
    const res = await handleDreamingComplete(
      new Request('http://localhost/api/ai/dreaming/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sources: [] })
      }),
      {} as Env,
      'dream-anon',
      true
    )
    expect(res.status).toBe(403)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('anonymous_not_allowed')
  })
})
