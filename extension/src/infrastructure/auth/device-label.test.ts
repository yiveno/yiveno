import { describe, expect, it } from 'vitest'

import { getDeviceLabelAndPlatform } from './device-label'

describe('getDeviceLabelAndPlatform', () => {
  it('Chrome on macOS（userAgentData.platform）', () => {
    expect(
      getDeviceLabelAndPlatform({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        userAgentData: { platform: 'macOS' }
      })
    ).toEqual({ deviceLabel: 'Chrome on macOS', platform: 'macOS' })
  })

  it('Edge on Windows（userAgentData.platform）', () => {
    expect(
      getDeviceLabelAndPlatform({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        platform: 'Win32',
        userAgentData: { platform: 'Windows' }
      })
    ).toEqual({ deviceLabel: 'Edge on Windows', platform: 'Windows' })
  })

  it('navigator 缺失 / 空 UA → 空串', () => {
    expect(getDeviceLabelAndPlatform({ userAgent: '', platform: '' })).toEqual({
      deviceLabel: '',
      platform: ''
    })
  })
})
