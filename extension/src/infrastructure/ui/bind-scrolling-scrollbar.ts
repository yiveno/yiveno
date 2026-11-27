/**
 * 全局滚动条「滚动中显示」：捕获阶段监听 scroll，给滚动容器加 is-scrolling，
 * 停止约 800ms 后移除（与 extension-ui.css 拇指显隐规则配合）。
 */

export const SCROLLING_SCROLLBAR_CLASS = 'is-scrolling' as const
export const SCROLLING_SCROLLBAR_HIDE_MS = 800

const hideTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>()

function markScrolling(el: Element): void {
  el.classList.add(SCROLLING_SCROLLBAR_CLASS)
  const prev = hideTimers.get(el)
  if (prev !== undefined) {
    clearTimeout(prev)
  }
  hideTimers.set(
    el,
    setTimeout(() => {
      el.classList.remove(SCROLLING_SCROLLBAR_CLASS)
      hideTimers.delete(el)
    }, SCROLLING_SCROLLBAR_HIDE_MS)
  )
}

/**
 * 在 root 上捕获 scroll；返回卸载函数。
 * 默认挂 document，覆盖扩展页全部滚动容器。
 */
export function bindScrollingScrollbarIndicator(root: ParentNode = document): () => void {
  const onScroll = (event: Event): void => {
    const target = event.target
    if (target instanceof Element) {
      markScrolling(target)
    }
  }
  root.addEventListener('scroll', onScroll, true)
  return () => {
    root.removeEventListener('scroll', onScroll, true)
  }
}
