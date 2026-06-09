import { nextTick, type Ref } from 'vue'

/** 书签树实例（整理页展开/收起） */
export interface ManagementBookmarkTreeInstance {
  expandAll?: () => boolean | void
  collapseAll?: () => void
}

/**
 * 等待 Vue 完成 DOM 更新并完成一帧绘制，避免 ref 尚未挂载或 props 未落地就调用 expandAll。
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
  treeRef: Ref<ManagementBookmarkTreeInstance | null>,
  expandAllRef: Ref<boolean>,
  options: {
    /** 当前侧是否参与筛选 */
    isFiltered: boolean
    /** 是否有命中结果 */
    hasMatches: boolean
  }
): Promise<void> {
  if (!options.isFiltered) {
    return
  }

  await waitForTreePaint()

  if (options.hasMatches) {
    const expanded = treeRef.value?.expandAll?.()
    expandAllRef.value = expanded !== false
    return
  }

  treeRef.value?.collapseAll?.()
  expandAllRef.value = false
}

/**
 * 清空筛选后收起两侧树
 */
export async function collapseManagementTrees(
  leftTreeRef: Ref<ManagementBookmarkTreeInstance | null>,
  rightTreeRef: Ref<ManagementBookmarkTreeInstance | null>,
  leftExpandAll: Ref<boolean>,
  rightExpandAll: Ref<boolean>
): Promise<void> {
  await waitForTreePaint()

  leftTreeRef.value?.collapseAll?.()
  rightTreeRef.value?.collapseAll?.()
  leftExpandAll.value = false
  rightExpandAll.value = false
}
