import { describe, expect, it } from 'vitest'

import {
  resolveSidepanelBannerStack,
  splitSidepanelBannerStack,
  type SidepanelBannerFlags
} from '@/pages/sidepanel/sidepanel-banner-stack'

function flags(partial: Partial<SidepanelBannerFlags>): SidepanelBannerFlags {
  return {
    offline: false,
    website_mismatch: false,
    sign_out_remap: false,
    website_connect: false,
    post_release: false,
    ...partial
  }
}

describe('resolveSidepanelBannerStack', () => {
  it('5 条全出：按优先级 offline > mismatch > remap > connect > post_release', () => {
    expect(
      resolveSidepanelBannerStack(
        flags({
          offline: true,
          website_mismatch: true,
          sign_out_remap: true,
          website_connect: true,
          post_release: true
        })
      )
    ).toEqual(['offline', 'website_mismatch', 'sign_out_remap', 'website_connect', 'post_release'])
  })

  it('只出低优先级：保持相对序，不含未活跃条', () => {
    expect(
      resolveSidepanelBannerStack(
        flags({
          website_connect: true,
          post_release: true
        })
      )
    ).toEqual(['website_connect', 'post_release'])
  })

  it('只出 1 条', () => {
    expect(resolveSidepanelBannerStack(flags({ sign_out_remap: true }))).toEqual(['sign_out_remap'])
  })
})

describe('splitSidepanelBannerStack', () => {
  it('全出时 visible 最多 2，其余进 overflow', () => {
    const active = resolveSidepanelBannerStack(
      flags({
        offline: true,
        website_mismatch: true,
        sign_out_remap: true,
        website_connect: true,
        post_release: true
      })
    )
    expect(splitSidepanelBannerStack(active)).toEqual({
      visible: ['offline', 'website_mismatch'],
      overflow: ['sign_out_remap', 'website_connect', 'post_release']
    })
  })

  it('活跃 ≤2 时 overflow 为空', () => {
    expect(splitSidepanelBannerStack(['post_release'])).toEqual({
      visible: ['post_release'],
      overflow: []
    })
  })
})
