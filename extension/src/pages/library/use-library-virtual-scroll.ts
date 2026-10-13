import type { ShallowRef } from 'vue'

/**
 * 将 scroll 事件合并到每帧最多一次 scrollTop 更新，减轻快速滚动时的 computed 链压力。
 */
export function createLibraryVirtualScrollHandler(
  scrollTop: ShallowRef<number>
): (event: Event) => void {
  let pending = false
  let latestTop = 0

  return (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    latestTop = target.scrollTop
    if (pending) {
      return
    }
    pending = true
    requestAnimationFrame(() => {
      scrollTop.value = latestTop
      pending = false
    })
  }
}
