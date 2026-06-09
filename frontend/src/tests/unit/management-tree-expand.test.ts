import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  applyTreeExpandState,
  collapseManagementTrees
} from '@/pages/management/utils/management-tree-expand'

describe('management-tree-expand', () => {
  it('未参与筛选时不改动展开状态', async () => {
    const treeRef = ref({
      expandAll: vi.fn(() => true),
      collapseAll: vi.fn()
    })
    const expandAllRef = ref(true)

    await applyTreeExpandState(treeRef, expandAllRef, {
      isFiltered: false,
      hasMatches: true
    })

    expect(treeRef.value.expandAll).not.toHaveBeenCalled()
    expect(treeRef.value.collapseAll).not.toHaveBeenCalled()
    expect(expandAllRef.value).toBe(true)
  })

  it('筛选有命中时展开并同步按钮状态', async () => {
    const treeRef = ref({
      expandAll: vi.fn(() => true),
      collapseAll: vi.fn()
    })
    const expandAllRef = ref(false)

    await applyTreeExpandState(treeRef, expandAllRef, {
      isFiltered: true,
      hasMatches: true
    })

    expect(treeRef.value.expandAll).toHaveBeenCalledTimes(1)
    expect(expandAllRef.value).toBe(true)
  })

  it('筛选无命中时收起', async () => {
    const treeRef = ref({
      expandAll: vi.fn(() => true),
      collapseAll: vi.fn()
    })
    const expandAllRef = ref(true)

    await applyTreeExpandState(treeRef, expandAllRef, {
      isFiltered: true,
      hasMatches: false
    })

    expect(treeRef.value.collapseAll).toHaveBeenCalledTimes(1)
    expect(expandAllRef.value).toBe(false)
  })

  it('expandAll 失败时按钮保持收起态', async () => {
    const treeRef = ref({
      expandAll: vi.fn(() => false),
      collapseAll: vi.fn()
    })
    const expandAllRef = ref(false)

    await applyTreeExpandState(treeRef, expandAllRef, {
      isFiltered: true,
      hasMatches: true
    })

    expect(expandAllRef.value).toBe(false)
  })

  it('清空筛选时收起两侧树', async () => {
    const leftRef = ref({ collapseAll: vi.fn() })
    const rightRef = ref({ collapseAll: vi.fn() })
    const leftExpandAll = ref(true)
    const rightExpandAll = ref(true)

    await collapseManagementTrees(leftRef, rightRef, leftExpandAll, rightExpandAll)

    expect(leftRef.value.collapseAll).toHaveBeenCalledTimes(1)
    expect(rightRef.value.collapseAll).toHaveBeenCalledTimes(1)
    expect(leftExpandAll.value).toBe(false)
    expect(rightExpandAll.value).toBe(false)
  })
})
