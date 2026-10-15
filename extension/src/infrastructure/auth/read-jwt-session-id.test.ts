import { describe, expect, it } from 'vitest'

import { readJwtSessionId } from '@/infrastructure/auth/read-jwt-session-id'

describe('readJwtSessionId', () => {
  it('读出 session_id', () => {
    const payload = btoa(JSON.stringify({ session_id: 'abc-123', sub: 'u1' }))
    expect(readJwtSessionId(`x.${payload}.y`)).toBe('abc-123')
  })

  it('无 session_id → null', () => {
    const payload = btoa(JSON.stringify({ sub: 'u1' }))
    expect(readJwtSessionId(`x.${payload}.y`)).toBeNull()
  })
})
