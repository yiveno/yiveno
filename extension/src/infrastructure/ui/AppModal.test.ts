/**
 * AppModal：遮罩轻关 / 内容区不关 / Esc 仍关。
 * 用 createApp 挂载（仓内尚无 @vue/test-utils）。
 */

import { createApp, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppModal from '@/infrastructure/ui/AppModal.vue'

type MountResult = {
  app: App
  root: HTMLElement
  onClose: ReturnType<typeof vi.fn>
}

function mountModal(props: {
  open?: boolean
  title?: string
  loading?: boolean
  closeOnEscape?: boolean
}): MountResult {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const onClose = vi.fn()
  const app = createApp(AppModal, {
    open: props.open ?? true,
    title: props.title ?? 'Test modal',
    loading: props.loading ?? false,
    closeOnEscape: props.closeOnEscape ?? true,
    onClose
  })
  app.mount(root)
  return { app, root, onClose }
}

describe('AppModal 关闭交互', () => {
  const mounts: MountResult[] = []

  afterEach(() => {
    for (const m of mounts.splice(0)) {
      m.app.unmount()
      m.root.remove()
    }
  })

  it('点遮罩本身 → emit close', async () => {
    const m = mountModal({})
    mounts.push(m)
    await nextTick()
    const backdrop = m.root.querySelector('.app-modal-backdrop')
    expect(backdrop).toBeTruthy()
    backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(m.onClose).toHaveBeenCalledTimes(1)
  })

  it('点弹窗内容区 → 不关闭', async () => {
    const m = mountModal({})
    mounts.push(m)
    await nextTick()
    const panel = m.root.querySelector('.app-modal')
    expect(panel).toBeTruthy()
    panel!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('Esc → 仍关闭', async () => {
    const m = mountModal({})
    mounts.push(m)
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(m.onClose).toHaveBeenCalledTimes(1)
  })

  it('loading 时点遮罩不关闭', async () => {
    const m = mountModal({ loading: true })
    mounts.push(m)
    await nextTick()
    m.root
      .querySelector('.app-modal-backdrop')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(m.onClose).not.toHaveBeenCalled()
  })
})
