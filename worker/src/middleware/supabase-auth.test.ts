import { describe, expect, test } from 'bun:test'

import { bodyForSupabaseAuthFailure } from './supabase-auth'

describe('bodyForSupabaseAuthFailure', () => {
  test('expired → 401 invalid_token + reason expired', () => {
    expect(bodyForSupabaseAuthFailure('expired')).toEqual({
      status: 401,
      body: { error: 'invalid_token', reason: 'expired' }
    })
  })

  test('invalid_token → 401 + reason invalid', () => {
    expect(bodyForSupabaseAuthFailure('invalid_token')).toEqual({
      status: 401,
      body: { error: 'invalid_token', reason: 'invalid' }
    })
  })

  test('malformed_response → 401 + reason malformed_response', () => {
    expect(bodyForSupabaseAuthFailure('malformed_response')).toEqual({
      status: 401,
      body: { error: 'invalid_token', reason: 'malformed_response' }
    })
  })

  test('auth_unreachable → 503 不变', () => {
    expect(bodyForSupabaseAuthFailure('auth_unreachable')).toEqual({
      status: 503,
      body: { error: 'auth_unreachable' }
    })
  })
})
