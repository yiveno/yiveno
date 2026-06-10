import { computed, ref } from 'vue'
import { dispatchTreeExpandCommand } from '../utils/management-tree-expand'

/**
 * 管理页左右树展开/折叠与左侧面板宽度状态
 */
export function useManagementTreeExpand() {
  const leftExpandAll = ref(false)
  const rightExpandAll = ref(false)
  const leftExpandCommand = ref(0)
  const leftExpandCommandExpanded = ref(false)
  const rightExpandCommand = ref(0)
  const rightExpandCommandExpanded = ref(false)
  const isLeftPanelCollapsed = ref(true)

  function setLeftTreeExpanded(expanded: boolean): void {
    dispatchTreeExpandCommand(leftExpandCommand, leftExpandCommandExpanded, expanded)
    leftExpandAll.value = expanded
  }

  function setRightTreeExpanded(expanded: boolean): void {
    dispatchTreeExpandCommand(rightExpandCommand, rightExpandCommandExpanded, expanded)
    rightExpandAll.value = expanded
  }

  function handleLeftExpandStateChange(expanded: boolean): void {
    leftExpandAll.value = expanded
    leftExpandCommandExpanded.value = expanded
  }

  function handleRightExpandStateChange(expanded: boolean): void {
    rightExpandAll.value = expanded
    rightExpandCommandExpanded.value = expanded
  }

  const isLeftTreeExpanded = computed(() => leftExpandCommandExpanded.value)
  const isRightTreeExpanded = computed(() => rightExpandCommandExpanded.value)
  const leftPanelWidthVar = computed(() => (isLeftPanelCollapsed.value ? '0px' : 'minmax(0, 1fr)'))
  const leftPanelGapVar = computed(() =>
    isLeftPanelCollapsed.value ? '0' : 'clamp(var(--spacing-3), 3vw, var(--spacing-10))'
  )

  return {
    leftExpandAll,
    rightExpandAll,
    leftExpandCommand,
    leftExpandCommandExpanded,
    rightExpandCommand,
    rightExpandCommandExpanded,
    isLeftPanelCollapsed,
    isLeftTreeExpanded,
    isRightTreeExpanded,
    leftPanelWidthVar,
    leftPanelGapVar,
    setLeftTreeExpanded,
    setRightTreeExpanded,
    handleLeftExpandStateChange,
    handleRightExpandStateChange
  }
}
