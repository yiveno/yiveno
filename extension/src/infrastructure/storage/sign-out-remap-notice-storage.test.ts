import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readMock, writeMock, removeMock } = vi.hoisted(() => ({
  readMock: vi.fn(),
  writeMock: vi.fn(),
  removeMock: vi.fn()
}))

vi.mock('@/infrastructure/storage/chrome-storage-session', () => ({
  readChromeStorageSession: readMock,
  writeChromeStorageSession: writeMock,
  removeChromeStorageSession: removeMock
}))

import {
  clearSignOutRemapNotice,
  readSignOutRemapNotice,
  writeSignOutRemapNotice
} from '@/infrastructure/storage/sign-out-remap-notice-storage'

describe('sign-out-remap-notice-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('write 后可读 flushOk', async () => {
    writeMock.mockResolvedValue(undefined)
    readMock.mockResolvedValue({ flushOk: false, at: 1 })
    await writeSignOutRemapNotice(false)
    expect(writeMock).toHaveBeenCalled()
    await expect(readSignOutRemapNotice()).resolves.toEqual({ flushOk: false, at: 1 })
  })

  it('clear 清除标记', async () => {
    removeMock.mockResolvedValue(undefined)
    await clearSignOutRemapNotice()
    expect(removeMock).toHaveBeenCalled()
  })
})
