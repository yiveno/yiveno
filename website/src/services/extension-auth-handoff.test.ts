import { describe, expect, it } from 'vitest'

import {
  consumeFromExtensionSignInArrival,
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
