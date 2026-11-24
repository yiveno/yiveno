import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  consumeFromExtensionSignInArrival,
  probeExtensionAuthStatus,
  rememberFromExtensionSignInArrival
} from './extension-auth-handoff'

/** Map stub：website vitest 默认 node 无 sessionStorage */
function createStubStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    key() {
      return null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    }
  }
}

describe('from-extension sign-in arrival mark', () => {
  it('round-trip：remember → consume 一次有效，再 consume 为 null', () => {
    const storage = createStubStorage()
    rememberFromExtensionSignInArrival('Yiveno', storage)
    const now = Date.now()
    expect(consumeFromExtensionSignInArrival(now, storage)).toBe('Yiveno')
    expect(consumeFromExtensionSignInArrival(now, storage)).toBeNull()
  })

  it('过期：超过 10 秒 → null', () => {
    const storage = createStubStorage()
    rememberFromExtensionSignInArrival('Yiveno', storage)
    expect(consumeFromExtensionSignInArrival(Date.now() + 11_000, storage)).toBeNull()
  })

  it('损坏：非 JSON → null 且标记已删', () => {
    const storage = createStubStorage()
    storage.setItem('yiveno_from_extension_signed_in', 'not-json')
    expect(consumeFromExtensionSignInArrival(Date.now(), storage)).toBeNull()
    expect(storage.getItem('yiveno_from_extension_signed_in')).toBeNull()
  })

  it('缺失：空 storage → null', () => {
    const storage = createStubStorage()
    expect(consumeFromExtensionSignInArrival(Date.now(), storage)).toBeNull()
  })
})

describe('AN5：probeExtensionAuthStatus 匿名豁免', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubSendMessage(response: unknown): void {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: (
          _extensionId: string,
          _message: unknown,
          responseCallback?: (response: unknown) => void
        ) => {
          responseCallback?.(response)
        }
      }
    })
    vi.stubGlobal('window', {
      setTimeout: (_fn: () => void) => {
        // 探测路径不依赖超时回调；返回假 timer id
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: () => undefined
    })
  }

  it('扩展匿名占位 → anonymous_placeholder', async () => {
    stubSendMessage({
      ok: true,
      signedIn: true,
      userId: 'A',
      isAnonymous: true
    })
    await expect(probeExtensionAuthStatus('ext-id', 'B')).resolves.toEqual({
      kind: 'anonymous_placeholder',
      userId: 'A'
    })
  })

  it('扩展真实其它账号（含缺 isAnonymous）→ other_account', async () => {
    stubSendMessage({
      ok: true,
      signedIn: true,
      userId: 'A',
      isAnonymous: false
    })
    await expect(probeExtensionAuthStatus('ext-id', 'B')).resolves.toEqual({
      kind: 'other_account',
      userId: 'A'
    })

    stubSendMessage({
      ok: true,
      signedIn: true,
      userId: 'A'
    })
    await expect(probeExtensionAuthStatus('ext-id', 'B')).resolves.toEqual({
      kind: 'other_account',
      userId: 'A'
    })
  })
})
