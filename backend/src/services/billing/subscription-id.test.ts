import { describe, expect, test } from 'bun:test'

import { isFakeProviderSubscriptionId, isValidYivenoUserId } from './subscription-id'

describe('isValidYivenoUserId', () => {
  test('只接受 UUID', () => {
    expect(isValidYivenoUserId('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isValidYivenoUserId('user_1')).toBe(false)
    expect(isValidYivenoUserId(null)).toBe(false)
  })
})

describe('isFakeProviderSubscriptionId', () => {
  test('真实 Paddle sub_ + 26 位才通过', () => {
    expect(isFakeProviderSubscriptionId('sub_01h1vjes1y163hjs1s211srxny')).toBe(false)
    expect(isFakeProviderSubscriptionId('sub_abc12345')).toBe(true)
    expect(isFakeProviderSubscriptionId('test-sub-1')).toBe(true)
    expect(isFakeProviderSubscriptionId('')).toBe(true)
  })
})
