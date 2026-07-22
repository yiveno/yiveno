import { describe, expect, it } from 'vitest'

import {
  createLocalProfile,
  resolveOwnerId,
  type AccountBinding,
  type LocalProfile
} from '@/core/identity/local-profile'

describe('local-profile', () => {
  const profile: LocalProfile = {
    localProfileId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-07-22T05:00:00.000Z',
    schemaVersion: 1
  }

  it('未绑定时 ownerId 等于 localProfileId', () => {
    expect(resolveOwnerId(profile, null)).toBe(profile.localProfileId)
  })

  it('绑定账号后 ownerId 等于 accountId', () => {
    const binding: AccountBinding = {
      accountId: '22222222-2222-4222-8222-222222222222',
      boundAt: '2026-07-22T06:00:00.000Z'
    }

    expect(resolveOwnerId(profile, binding)).toBe(binding.accountId)
  })

  it('createLocalProfile 生成合法 UUID 与时间戳', () => {
    const created = createLocalProfile(() => '2026-07-22T05:00:00.000Z')

    expect(created.schemaVersion).toBe(1)
    expect(created.createdAt).toBe('2026-07-22T05:00:00.000Z')
    expect(created.localProfileId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })
})
