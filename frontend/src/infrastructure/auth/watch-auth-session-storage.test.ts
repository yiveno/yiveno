import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_SESSION_STORAGE_KEY } from '@/core/identity/auth-session'
import { ACCOUNT_BINDING_STORAGE_KEY } from '@/core/identity/local-profile'
import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'

describe('watchAuthSessionStorage', () => {
  let listener:
    | ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void)
    | null = null

  beforeEach(() => {
    listener = null
    vi.stubGlobal('chrome', {
      storage: {
        onChanged: {
          addListener: (fn: typeof listener) => {
            listener = fn
          },
          removeListener: (fn: typeof listener) => {
            if (listener === fn) {
              listener = null
            }
          }
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('session 或 binding 变更时回调；其它键与 area 忽略', () => {
    const onChange = vi.fn()
    const stop = watchAuthSessionStorage(onChange)

    listener?.({ [AUTH_SESSION_STORAGE_KEY]: { newValue: { userId: 'x' } } }, 'local')
    listener?.({ [ACCOUNT_BINDING_STORAGE_KEY]: { newValue: { accountId: 'x' } } }, 'local')
    listener?.({ unrelated: { newValue: 1 } }, 'local')
    listener?.({ [AUTH_SESSION_STORAGE_KEY]: { newValue: null } }, 'session')

    expect(onChange).toHaveBeenCalledTimes(2)
    stop()
    listener?.({ [AUTH_SESSION_STORAGE_KEY]: { newValue: null } }, 'local')
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
