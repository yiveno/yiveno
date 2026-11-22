/**
 * 找东西设置面板展开时：给面板外区域标 inert（焦点 / hit-testing / AX 隔离）。
 * root（`.page-context`）嵌在 toolbar 内，不是 shell 直接子元素——排除规则用 contains(root)。
 */

/** 收集应对面板外 inert 的元素（不含 root 祖先链上的容器本身）。 */
export function collectPageContextOutsideInertTargets(root: Element): Element[] {
  const targets: Element[] = []
  const seen = new Set<Element>()

  function pushIfOutside(parent: Element | null): void {
    if (!parent) {
      return
    }
    for (const child of parent.children) {
      if (seen.has(child) || child.contains(root)) {
        continue
      }
      seen.add(child)
      targets.push(child)
    }
  }

  // 壳内：inert composer-main 等，保留含 root 的 toolbar
  pushIfOutside(root.closest('.recall-composer-shell'))
  // 滚动区：inert 会话 body，保留含 root 的 float-dock
  pushIfOutside(root.closest('.recall-scroll-region'))
  // main：inert header / gate 等，保留含 root 的 scroll-region
  pushIfOutside(root.closest('main.recall-shell'))

  return targets
}

/** 展开/收起时同步 inert 属性。 */
export function setPageContextOutsideInert(root: Element | null, active: boolean): void {
  if (!root) {
    return
  }
  for (const el of collectPageContextOutsideInertTargets(root)) {
    if (active) {
      el.setAttribute('inert', '')
    } else {
      el.removeAttribute('inert')
    }
  }
}
