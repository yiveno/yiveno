import { describe, expect, it } from 'vitest'
import {
  bookmarkNeedsRetrievalProfile,
  buildRetrievalProfileSourceHash
} from '@/core/ai/retrieval-profile-hash'
import { RETRIEVAL_PROFILE_CONTENT_VERSION } from '@/core/ai/retrieval-profile-types'

describe('retrieval-profile-hash', () => {
  it('title 或 url 变化时需要重新生成', () => {
    const hash = buildRetrievalProfileSourceHash('QQ音乐', 'https://y.qq.com')
    expect(
      bookmarkNeedsRetrievalProfile(
        {
          url: 'https://y.qq.com',
          title: 'QQ音乐',
          retrievalProfile: '音乐平台',
          retrievalProfileSourceHash: hash,
          retrievalProfileVersion: RETRIEVAL_PROFILE_CONTENT_VERSION
        },
        RETRIEVAL_PROFILE_CONTENT_VERSION
      )
    ).toBe(false)

    expect(
      bookmarkNeedsRetrievalProfile(
        {
          url: 'https://y.qq.com',
          title: 'QQ音乐新版',
          retrievalProfile: '音乐平台',
          retrievalProfileSourceHash: hash,
          retrievalProfileVersion: RETRIEVAL_PROFILE_CONTENT_VERSION
        },
        RETRIEVAL_PROFILE_CONTENT_VERSION
      )
    ).toBe(true)
  })
})
