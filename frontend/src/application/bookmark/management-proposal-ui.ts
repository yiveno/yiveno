/**
 * 管理页提案面板 UI 元数据（纯函数，不依赖 store）
 */
export function getProposalPanelTitle(isAIGenerated: boolean): string {
  return isAIGenerated ? 'AI 整理建议' : '整理建议'
}

export function getProposalPanelIcon(isAIGenerated: boolean): string {
  return isAIGenerated ? 'sparkles' : 'zap'
}
