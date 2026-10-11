import { describe, expect, test } from 'bun:test'
import { readJwtSessionId } from './read-jwt-session-id'

describe('readJwtSessionId', () => {
  test('读出 session_id', () => {
    const payload = btoa(JSON.stringify({ session_id: 'abc-123', sub: 'u1' }))
    expect(readJwtSessionId(`x.${payload}.y`)).toBe('abc-123')
  })

  test('无 claim → null', () => {
    const payload = btoa(JSON.stringify({ sub: 'u1' }))
    expect(readJwtSessionId(`x.${payload}.y`)).toBeNull()
  })
})
