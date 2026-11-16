/**
 * 死链探测：网络失败 → probe_failed（不得冒充 dead）。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkMemoryLinkUrl } from '@/application/dreaming/check-memory-link-url'

const originalFetch = globalThis.fetch

describe('checkMemoryLinkUrl', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('超时 / 网络错误 → probe_failed', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as typeof fetch
    await expect(checkMemoryLinkUrl('https://example.com/x')).resolves.toBe('probe_failed')
  })

  it('非法 URL → dead', async () => {
    await expect(checkMemoryLinkUrl('not-a-url')).resolves.toBe('dead')
  })
})
