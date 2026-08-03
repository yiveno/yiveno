import { describe, expect, it } from 'vitest'

import {
  extractAvatarUrlFromUserMetadata,
  extractDisplayNameFromUserMetadata
} from '@/core/identity/auth-user-profile'

describe('auth-user-profile', () => {
  it('优先 avatar_url，回退 picture', () => {
    expect(
      extractAvatarUrlFromUserMetadata({
        picture: 'https://example.com/p.png',
        avatar_url: 'https://example.com/a.png'
      })
    ).toBe('https://example.com/a.png')
    expect(extractAvatarUrlFromUserMetadata({ picture: 'https://example.com/p.png' })).toBe(
      'https://example.com/p.png'
    )
  })

  it('优先 name，回退 full_name', () => {
    expect(extractDisplayNameFromUserMetadata({ name: 'A', full_name: 'B' })).toBe('A')
    expect(extractDisplayNameFromUserMetadata({ full_name: 'B' })).toBe('B')
  })

  it('空 metadata 返回 undefined', () => {
    expect(extractAvatarUrlFromUserMetadata(undefined)).toBeUndefined()
    expect(extractDisplayNameFromUserMetadata({})).toBeUndefined()
  })
})
