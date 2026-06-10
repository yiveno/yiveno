import { nextTick, type Ref } from 'vue'

/**
 * 通过 expandCommand prop 触发 BookmarkTree 展开/收起（避免 ref 时序问题）
 */
export function dispatchTreeExpandCommand(
  commandRef: Ref<number>,
  expandedRef: Ref<boolean>,
  expanded: boolean
): void {
  expandedRef.value = expanded
  commandRef.value += 1
}

/**
 * 等待 Vue 完成 DOM 更新并完成一帧绘制
 */
export async function waitForTreePaint(): Promise<void> {
  await nextTick()
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve())
  })
  await nextTick()
}

/**
 * 同步单侧树的展开状态（筛选命中展开 / 清空收起 / 未参与筛选则保持原状）
 */
export async function applyTreeExpandState(
  expandAllRef: Ref<boolean>,
  setExpanded: (expanded: boolean) => void,
  options: {
    isFiltered: boolean
    hasMatches: boolean
  }
): Promise<void> {
  if (!options.isFiltered) {
    return
  }

  await waitForTreePaint()

  if (options.hasMatches) {
    setExpanded(true)
    expandAllRef.value = true
    return
  }

  setExpanded(false)
  expandAllRef.value = false
}

/**
 * 清空筛选后收起两侧树
 */
export async function collapseManagementTrees(
  setLeftExpanded: (expanded: boolean) => void,
  setRightExpanded: (expanded: boolean) => void,
  leftExpandAll: Ref<boolean>,
  rightExpandAll: Ref<boolean>
): Promise<void> {
  await waitForTreePaint()

  setLeftExpanded(false)
  setRightExpanded(false)
  leftExpandAll.value = false
  rightExpandAll.value = false
}
