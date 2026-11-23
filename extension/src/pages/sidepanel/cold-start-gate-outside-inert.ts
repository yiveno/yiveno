/**
 * ColdStartGate 显示时：给 Gate 外区域标 inert（焦点 / hit-testing / AX 隔离）。
 * root（`.cold-start-gate`）是 `main.recall-shell` 的直接子元素——排除规则用 contains(root)。
 */

/** 收集应对 Gate 外 inert 的元素（不含 root 自身及其祖先链上的容器）。 */
export function collectColdStartGateOutsideInertTargets(root: Element): Element[] {
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

  // main：inert header / 滚动区等，保留 Gate 自身
  pushIfOutside(root.closest('main.recall-shell'))

  return targets
}

/** 展开/收起时同步 inert 属性。 */
export function setColdStartGateOutsideInert(root: Element | null, active: boolean): void {
  if (!root) {
    return
  }
  for (const el of collectColdStartGateOutsideInertTargets(root)) {
    if (active) {
      el.setAttribute('inert', '')
    } else {
      el.removeAttribute('inert')
    }
  }
}
