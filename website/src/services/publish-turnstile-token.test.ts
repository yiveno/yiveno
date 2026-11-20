import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Stage 1：Turnstile 成功 → 桥发 token；失败路径不发。
 * （组件挂载依赖 Vite Vue 插件；此处测桥发送契约，与 AuthTurnstileBridge 同路径。）
 */

const { connectMock, postMessageMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  postMessageMock: vi.fn()
}))

vi.mock('./extension-auth-handoff', () => ({
  getPendingExtensionId: () => null,
  getLastConnectedExtensionId: () => null
}))

import { publishWebsiteTurnstileToken } from './ui-bridge'

describe('publishWebsiteTurnstileToken', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('有 extensionId 时 connect Port 并发送 website_turnstile_token', () => {
    connectMock.mockReturnValue({
      name: 'yiveno-ui-bridge',
      postMessage: postMessageMock,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      disconnect: vi.fn()
    })
    vi.stubGlobal('chrome', {
      runtime: { connect: connectMock }
    })

    publishWebsiteTurnstileToken('tok-1', { extensionId: 'ext-abc' })

    expect(connectMock).toHaveBeenCalledWith('ext-abc', { name: 'yiveno-ui-bridge' })
    expect(postMessageMock).toHaveBeenCalledWith({
      channel: 'yiveno_ui_bridge',
      v: 1,
      msg: { type: 'website_turnstile_token', payload: { token: 'tok-1' } }
    })
  })

  it('空 token 不发送', () => {
    vi.stubGlobal('chrome', {
      runtime: { connect: connectMock }
    })
    publishWebsiteTurnstileToken('   ', { extensionId: 'ext-abc' })
    expect(connectMock).not.toHaveBeenCalled()
    expect(postMessageMock).not.toHaveBeenCalled()
  })
})
