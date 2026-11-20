import { describe, expect, it } from 'vitest'
import { UiBridgeEnvelopeSchema, wrapUiBridgeMessage } from '@/core/identity/ui-bridge-messages'

describe('ui-bridge-messages', () => {
  it('wrap + parse website_auth_changed', () => {
    const envelope = wrapUiBridgeMessage({
      type: 'website_auth_changed',
      payload: { signedIn: true, userId: '11111111-1111-4111-8111-111111111111' }
    })
    expect(UiBridgeEnvelopeSchema.parse(envelope).msg.type).toBe('website_auth_changed')
  })

  it('wrap + parse request_extension_connect / ack / result', () => {
    expect(
      UiBridgeEnvelopeSchema.parse(
        wrapUiBridgeMessage({
          type: 'request_extension_connect',
          payload: { extensionId: 'abcdefghijklmnopqrstuvwxyz' }
        })
      ).msg.type
    ).toBe('request_extension_connect')
    expect(
      UiBridgeEnvelopeSchema.parse(
        wrapUiBridgeMessage({ type: 'website_connect_ack', payload: {} })
      ).msg.type
    ).toBe('website_connect_ack')
    expect(
      UiBridgeEnvelopeSchema.parse(
        wrapUiBridgeMessage({
          type: 'website_connect_result',
          payload: { status: 'account_mismatch' }
        })
      ).msg
    ).toMatchObject({ type: 'website_connect_result', payload: { status: 'account_mismatch' } })
  })

  it('wrap + parse website_turnstile_token', () => {
    const envelope = wrapUiBridgeMessage({
      type: 'website_turnstile_token',
      payload: { token: 'cf-turnstile-response-token' }
    })
    expect(UiBridgeEnvelopeSchema.parse(envelope).msg).toMatchObject({
      type: 'website_turnstile_token',
      payload: { token: 'cf-turnstile-response-token' }
    })
  })

  it('拒绝非法 channel', () => {
    expect(() =>
      UiBridgeEnvelopeSchema.parse({
        channel: 'other',
        v: 1,
        msg: { type: 'bridge_hello', payload: { role: 'website' } }
      })
    ).toThrow()
  })
})
