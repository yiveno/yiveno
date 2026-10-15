import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: vi.fn(async () => null),
  setAuthSession: vi.fn(async () => undefined)
}))

import {
  applyUiBridgeEnvelopeForTests,
  getUiBridgePortCountForTests,
  registerUiBridgeListener,
  resetUiBridgeListenerForTests
} from '@/background/listeners/ui-bridge'
import {
  WEBSITE_AUTH_UI_SESSION_KEY,
  wrapUiBridgeMessage
} from '@/core/identity/ui-bridge-messages'
import { getAuthSession, setAuthSession } from '@/infrastructure/identity/auth-session-service'
import { readWebsiteAuthUiState } from '@/infrastructure/auth/website-auth-ui-storage'

type StorageMap = Record<string, unknown>

function createChromeMock(initialSession: StorageMap = {}) {
  const sessionStore: StorageMap = { ...initialSession }
  const localStore: StorageMap = {}
  const onConnectExternal = { addListener: vi.fn() }
  const onChanged = { addListener: vi.fn() }
  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys]
          return Object.fromEntries(list.map(k => [k, localStore[k]]))
        }),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(localStore, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete localStore[key]
          }
        })
      },
      session: {
        get: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys]
          return Object.fromEntries(list.map(k => [k, sessionStore[k]]))
        }),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(sessionStore, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete sessionStore[key]
          }
        })
      },
      onChanged
    },
    runtime: {
      onConnectExternal
    },
    sessionStore
  }
}

describe('ui bridge listener', () => {
  beforeEach(() => {
    resetUiBridgeListenerForTests()
    vi.mocked(getAuthSession).mockReset()
    vi.mocked(setAuthSession).mockReset()
    vi.mocked(getAuthSession).mockResolvedValue(null)
    vi.stubGlobal('chrome', createChromeMock())
  })

  it('register 幂等挂上 onConnectExternal', () => {
    registerUiBridgeListener()
    registerUiBridgeListener()
    expect(chrome.runtime.onConnectExternal.addListener).toHaveBeenCalledTimes(1)
    expect(getUiBridgePortCountForTests()).toBe(0)
  })

  it('Port disconnect 时读取 lastError，避免 Unchecked runtime.lastError', async () => {
    let lastError: { message: string } | undefined = {
      message:
        'The page keeping the extension port is moved into back/forward cache, so the message channel is closed.'
    }
    const chromeMock = createChromeMock()
    Object.defineProperty(chromeMock.runtime, 'lastError', {
      configurable: true,
      get: () => lastError
    })
    vi.stubGlobal('chrome', chromeMock)

    registerUiBridgeListener()
    const connectHandler = vi.mocked(chrome.runtime.onConnectExternal.addListener).mock
      .calls[0]?.[0] as ((port: chrome.runtime.Port) => void) | undefined
    expect(connectHandler).toBeTypeOf('function')

    let onDisconnect: (() => void) | undefined
    const port = {
      name: 'yiveno-ui-bridge',
      sender: { url: 'http://localhost:3001/account' },
      onMessage: { addListener: vi.fn() },
      onDisconnect: {
        addListener: (handler: () => void) => {
          onDisconnect = handler
        }
      },
      postMessage: vi.fn(),
      disconnect: vi.fn()
    } as unknown as chrome.runtime.Port

    await Promise.resolve(connectHandler?.(port))
    expect(getUiBridgePortCountForTests()).toBe(1)
    onDisconnect?.()
    // 访问过即视为已消费
    lastError = undefined
    expect(getUiBridgePortCountForTests()).toBe(0)
  })

  it('website_auth_changed signedIn=true 写入 session', async () => {
    await applyUiBridgeEnvelopeForTests(
      wrapUiBridgeMessage({
        type: 'website_auth_changed',
        payload: {
          signedIn: true,
          userId: '11111111-1111-4111-8111-111111111111'
        }
      })
    )
    const row = await readWebsiteAuthUiState()
    expect(row?.signedIn).toBe(true)
    expect(row?.userId).toBe('11111111-1111-4111-8111-111111111111')
    expect(chrome.storage.session.set).toHaveBeenCalled()
  })

  it('website_auth_changed signedIn=false 写入否态行（避免删键回落 probe）', async () => {
    await chrome.storage.session.set({
      [WEBSITE_AUTH_UI_SESSION_KEY]: {
        signedIn: true,
        userId: '11111111-1111-4111-8111-111111111111',
        at: 1
      }
    })
    await applyUiBridgeEnvelopeForTests(
      wrapUiBridgeMessage({
        type: 'website_auth_changed',
        payload: { signedIn: false }
      })
    )
    const row = await readWebsiteAuthUiState()
    expect(row?.signedIn).toBe(false)
    expect(row?.userId).toBeUndefined()
    expect(chrome.storage.session.set).toHaveBeenCalled()
  })

  it('website_profile_changed 仅同 userId 才写 session', async () => {
    const session = {
      userId: '11111111-1111-4111-8111-111111111111',
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: Date.now() + 60_000,
      displayName: 'Old',
      avatarUrl: 'https://example.com/old.png'
    }
    vi.mocked(getAuthSession).mockResolvedValue(session as never)
    await applyUiBridgeEnvelopeForTests(
      wrapUiBridgeMessage({
        type: 'website_profile_changed',
        payload: {
          userId: '11111111-1111-4111-8111-111111111111',
          displayName: 'New Name',
          avatarUrl: 'https://example.com/new.png'
        }
      })
    )
    expect(setAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'New Name',
        avatarUrl: 'https://example.com/new.png'
      })
    )

    vi.mocked(setAuthSession).mockClear()
    await applyUiBridgeEnvelopeForTests(
      wrapUiBridgeMessage({
        type: 'website_profile_changed',
        payload: {
          userId: '22222222-2222-4222-8222-222222222222',
          displayName: 'Other'
        }
      })
    )
    expect(setAuthSession).not.toHaveBeenCalled()
  })
})
