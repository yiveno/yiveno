/** 可聚焦元素选择器（Modal 焦点陷阱） */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

let previousFocus: HTMLElement | null = null

/** 收集容器内可见且可聚焦的元素 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hasAttribute('disabled') && element.tabIndex !== -1
  )
}

/** 聚焦容器内第一个可聚焦元素 */
export function focusFirstElement(container: HTMLElement): void {
  getFocusableElements(container)[0]?.focus()
}

/** Tab / Shift+Tab 在容器内循环 */
export function handleTabTrap(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') {
    return
  }

  const focusable = getFocusableElements(container)
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (active === last) {
    event.preventDefault()
    first.focus()
  }
}

/** 绑定 Modal 焦点陷阱；返回清理函数 */
export function bindModalFocusTrap(container: HTMLElement): () => void {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const onKeyDown = (event: KeyboardEvent) => {
    handleTabTrap(event, container)
  }

  container.addEventListener('keydown', onKeyDown)
  focusFirstElement(container)

  return () => {
    container.removeEventListener('keydown', onKeyDown)
    restoreFocus()
  }
}

/** 关闭 Modal 后将焦点还原到打开前的元素 */
export function restoreFocus(): void {
  previousFocus?.focus()
  previousFocus = null
}

/** 测试用：重置模块内保存的焦点 */
export function resetModalFocusStateForTest(): void {
  previousFocus = null
}
