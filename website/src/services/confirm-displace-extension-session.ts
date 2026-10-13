/**
 * 自定义挤掉确认弹窗（非 window.confirm）。
 * 确认后由调用方执行「先废前者扩展 session 再 mint」；取消则返回 false。
 */

import { createApp, h } from 'vue'
import DisplaceExtensionConfirmDialog from '../components/DisplaceExtensionConfirmDialog.vue'

/**
 * @param onConfirm 用户点 Continue 后执行的交接（返回是否成功）
 * @returns 用户是否最终成功完成挤掉交接（取消 / 失败均为 false；失败时弹窗可重试）
 */
export function confirmDisplaceExtensionSession(
  onConfirm: () => Promise<boolean>
): Promise<boolean> {
  if (typeof document === 'undefined') {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    const host = document.createElement('div')
    host.setAttribute('data-yiveno-displace-confirm', '1')
    document.body.appendChild(host)

    const app = createApp({
      render: () =>
        h(DisplaceExtensionConfirmDialog, {
          onConfirm,
          onResolve: (ok: boolean) => {
            app.unmount()
            host.remove()
            resolve(ok)
          }
        })
    })

    app.mount(host)
  })
}
