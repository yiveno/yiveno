import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  applyTreeExpandState,
  collapseManagementTrees,
  dispatchTreeExpandCommand
} from '@/pages/management/utils/management-tree-expand'

describe('management-tree-expand', () => {
  it('dispatchTreeExpandCommand 递增命令并设置目标状态', () => {
    const commandRef = ref(0)
    const expandedRef = ref(false)

    dispatchTreeExpandCommand(commandRef, expandedRef, true)

    expect(commandRef.value).toBe(1)
    expect(expandedRef.value).toBe(true)
  })

  it('未参与筛选时不改动展开状态', async () => {
    const expandAllRef = ref(true)
    const setExpanded = vi.fn()

    await applyTreeExpandState(expandAllRef, setExpanded, {
      isFiltered: false,
      hasMatches: true
    })

    expect(setExpanded).not.toHaveBeenCalled()
    expect(expandAllRef.value).toBe(true)
  })

  it('筛选有命中时触发展开', async () => {
    const expandAllRef = ref(false)
    const setExpanded = vi.fn()

    await applyTreeExpandState(expandAllRef, setExpanded, {
      isFiltered: true,
      hasMatches: true
    })

    expect(setExpanded).toHaveBeenCalledWith(true)
    expect(expandAllRef.value).toBe(true)
  })

  it('筛选无命中时触发收起', async () => {
    const expandAllRef = ref(true)
    const setExpanded = vi.fn()

    await applyTreeExpandState(expandAllRef, setExpanded, {
      isFiltered: true,
      hasMatches: false
    })

    expect(setExpanded).toHaveBeenCalledWith(false)
    expect(expandAllRef.value).toBe(false)
  })

  it('清空筛选时收起两侧树', async () => {
    const setLeftExpanded = vi.fn()
    const setRightExpanded = vi.fn()
    const leftExpandAll = ref(true)
    const rightExpandAll = ref(true)

    await collapseManagementTrees(setLeftExpanded, setRightExpanded, leftExpandAll, rightExpandAll)

    expect(setLeftExpanded).toHaveBeenCalledWith(false)
    expect(setRightExpanded).toHaveBeenCalledWith(false)
    expect(leftExpandAll.value).toBe(false)
    expect(rightExpandAll.value).toBe(false)
  })
})
