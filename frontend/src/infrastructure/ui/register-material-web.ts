/**
 * 按需注册 Material Web 组件（MD3 token 驱动）。
 * Popup / Settings 入口在 mount 前调用一次。
 */
import { styles as typescaleStyles } from '@material/web/typography/md-typescale-styles.js'

import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/switch/switch.js'

let registered = false

/** 注册 typography + 已用到的 md-* 自定义元素。 */
export function registerMaterialWebComponents(): void {
  if (registered) {
    return
  }
  registered = true

  document.adoptedStyleSheets.push(
    ...(typescaleStyles.styleSheet ? [typescaleStyles.styleSheet] : [])
  )

  const root = document.documentElement
  if (!root.dataset.theme) {
    root.dataset.theme = 'light'
  }
  if (!root.dataset.colorPreset) {
    root.dataset.colorPreset = 'default'
  }
}

/** Material Web Switch 元素最小类型。 */
export interface MdSwitchElement extends HTMLElement {
  selected: boolean
  disabled: boolean
}

/** 判断事件目标是否为 md-switch。 */
export function asMdSwitchElement(target: EventTarget | null): MdSwitchElement | null {
  if (!(target instanceof HTMLElement) || target.localName !== 'md-switch') {
    return null
  }
  return target as MdSwitchElement
}
