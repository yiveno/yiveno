import { beforeEach, describe, expect, it, vi } from 'vitest'

const showVoiceRecallNotification = vi.fn()
const ensureSelectionToolbarContentScript = vi.fn()
const tabsQuery = vi.fn()
const tabsSendMessage = vi.fn()

vi.mock('@/infrastructure/browser/voice-recall-notification', () => ({
  showVoiceRecallNotification: (...args: unknown[]) => showVoiceRecallNotification(...args)
}))

vi.mock('@/infrastructure/browser/selection-toolbar-command', () => ({
  ensureSelectionToolbarContentScript: (...args: unknown[]) =>
    ensureSelectionToolbarContentScript(...args)
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('voice-recall-page-feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showVoiceRecallNotification.mockResolvedValue(true)
    ensureSelectionToolbarContentScript.mockResolvedValue(false)
    vi.stubGlobal('chrome', {
      tabs: {
        query: tabsQuery,
        sendMessage: tabsSendMessage
      }
    })
  })

  it('横幅消息发送成功：走 banner，不发系统通知', async () => {
    tabsQuery.mockResolvedValueOnce([{ id: 7, url: 'https://example.com' }])
    tabsSendMessage.mockResolvedValueOnce({ shown: true })

    const { showVoiceRecallPageOrNotify } =
      await import('@/infrastructure/browser/voice-recall-page-feedback')
    const path = await showVoiceRecallPageOrNotify({
      title: 'Yiveno',
      message: 'no match'
    })

    expect(path).toBe('banner')
    expect(tabsSendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        scope: 'content',
        type: 'SHOW_VOICE_FEEDBACK',
        message: 'no match',
        title: 'Yiveno'
      })
    )
    expect(showVoiceRecallNotification).not.toHaveBeenCalled()
    expect(ensureSelectionToolbarContentScript).not.toHaveBeenCalled()
  })

  it('发送失败：回落系统通知', async () => {
    tabsQuery.mockResolvedValueOnce([{ id: 9, url: 'chrome://extensions' }])

    const { showVoiceRecallPageOrNotify } =
      await import('@/infrastructure/browser/voice-recall-page-feedback')
    const path = await showVoiceRecallPageOrNotify({
      title: 'Yiveno',
      message: 'unclear',
      openSidePanelOnClick: true
    })

    expect(path).toBe('notification')
    expect(tabsSendMessage).not.toHaveBeenCalled()
    expect(showVoiceRecallNotification).toHaveBeenCalledWith({
      title: 'Yiveno',
      message: 'unclear',
      openSidePanelOnClick: true
    })
  })

  it('可保存页无 receiver：注入仍失败则回落通知', async () => {
    tabsQuery.mockResolvedValueOnce([{ id: 11, url: 'https://news.example' }])
    tabsSendMessage.mockRejectedValue(new Error('Receiving end does not exist'))
    ensureSelectionToolbarContentScript.mockResolvedValueOnce(false)

    const { showVoiceRecallPageOrNotify } =
      await import('@/infrastructure/browser/voice-recall-page-feedback')
    const path = await showVoiceRecallPageOrNotify({
      title: 'Yiveno',
      message: 'candidates ready'
    })

    expect(path).toBe('notification')
    expect(ensureSelectionToolbarContentScript).toHaveBeenCalledWith(11)
    expect(showVoiceRecallNotification).toHaveBeenCalledWith({
      title: 'Yiveno',
      message: 'candidates ready'
    })
  })
})
