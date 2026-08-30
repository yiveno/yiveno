/** AppSectionTabs 方向键 / Home / End 导航。 */

export function resolveAppSectionTabIndex(input: {
  key: string
  currentIndex: number
  lastIndex: number
}): number | null {
  if (input.lastIndex < 0) {
    return null
  }

  switch (input.key) {
    case 'Home':
      return 0
    case 'End':
      return input.lastIndex
    case 'ArrowRight':
    case 'ArrowDown':
      return input.currentIndex >= input.lastIndex ? 0 : input.currentIndex + 1
    case 'ArrowLeft':
    case 'ArrowUp':
      return input.currentIndex <= 0 ? input.lastIndex : input.currentIndex - 1
    default:
      return null
  }
}
