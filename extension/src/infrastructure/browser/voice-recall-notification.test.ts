import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.fn()
const clearMock = vi.fn()
const onClickedAddListener = vi.fn()
const openRecallSidePanel = vi.fn()

vi.stubGlobal('chrome', {
  runtime: { getURL: (path: string) => `chrome-extension://id/${path}` },
  notifications: {
    create: (...args: unknown[]) => createMock(...args),
    clear: (...args: unknown[]) => clearMock(...args),
    onClicked: { addListener: onClickedAddListener }
  },
  tabs: {
    get: vi.fn(),
    update: vi.fn()
  },
  windows: {
    update: vi.fn()
  }
})

vi.mock('@/infrastructure/browser/side-panel', () => ({
  openRecallSidePanel: (...args: unknown[]) => openRecallSidePanel(...args)
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('showVoiceRecallNotification', () => {
  beforeEach(async () => {
    createMock.mockReset()
    clearMock.mockReset()
    onClickedAddListener.mockClear()
    openRecallSidePanel.mockReset()
    openRecallSidePanel.mockResolvedValue(undefined)
    vi.resetModules()
    const { resetVoiceRecallNotificationListenersForTests } =
      await import('@/infrastructure/browser/voice-recall-notification')
    resetVoiceRecallNotificationListenersForTests()
  })

  it('通知失败不影响调用方（返回 false、不抛）', async () => {
    createMock.mockRejectedValueOnce(new Error('quota'))
    const { showVoiceRecallNotification } =
      await import('@/infrastructure/browser/voice-recall-notification')
    await expect(showVoiceRecallNotification({ title: 'T', message: 'M', tabId: 3 })).resolves.toBe(
      false
    )
  })

  it('发送成功返回 true', async () => {
    createMock.mockResolvedValueOnce(undefined)
    const { showVoiceRecallNotification } =
      await import('@/infrastructure/browser/voice-recall-notification')
    await expect(
      showVoiceRecallNotification({ title: 'Opened', message: 'Heard: hi' })
    ).resolves.toBe(true)
    expect(createMock).toHaveBeenCalled()
  })

  it('handoff 通知点击：同步调 openRecallSidePanel', async () => {
    createMock.mockResolvedValueOnce(undefined)
    clearMock.mockResolvedValueOnce(undefined)
    const { showVoiceRecallNotification } =
      await import('@/infrastructure/browser/voice-recall-notification')
    await showVoiceRecallNotification({
      title: 'Yiveno',
      message: 'candidates ready',
      openSidePanelOnClick: true
    })

    expect(onClickedAddListener).toHaveBeenCalledTimes(1)
    const listener = onClickedAddListener.mock.calls[0]?.[0] as (id: string) => void
    const createdId = createMock.mock.calls[0]?.[0] as string
    listener(createdId)

    expect(openRecallSidePanel).toHaveBeenCalledTimes(1)
    expect(chrome.tabs.get).not.toHaveBeenCalled()
  })
})
