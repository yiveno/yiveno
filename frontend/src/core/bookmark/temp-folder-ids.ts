/**
 * 提案树临时文件夹 ID 工具（apply 前内存占位，落盘时映射为 Chrome 真实 ID）
 */

import { BOOKMARKS_BAR_ID } from '@/core/bookmark/chrome-system-ids'

/** AI 一键整理生成的临时文件夹前缀 */
export const TEMP_AI_FOLDER_PREFIX = 'temp_ai_' as const

/** 手动编辑 / 通用临时文件夹前缀 */
export const TEMP_FOLDER_PREFIX = 'temp_' as const

/** 节点 parentId 只读视图，供子树判断复用 */
export interface TempFolderParentView {
  parentId?: string | undefined
}

/**
 * 是否为临时文件夹 ID（含 AI 与手动）
 */
export function isTempFolderId(id: string): boolean {
  return id.startsWith(TEMP_FOLDER_PREFIX)
}

/**
 * 是否为 AI 整理临时文件夹 ID
 */
export function isAiTempFolderId(id: string): boolean {
  return id.startsWith(TEMP_AI_FOLDER_PREFIX)
}

/**
 * 分配下一个临时文件夹 ID
 *
 * @param existingIds 提案树已有节点 ID
 * @param variant `ai` → temp_ai_N；`manual` → temp_N（不含 temp_ai_ 序号）
 */
export function allocateTempFolderId(
  existingIds: Iterable<string>,
  variant: 'ai' | 'manual' = 'manual'
): string {
  const prefix = variant === 'ai' ? TEMP_AI_FOLDER_PREFIX : TEMP_FOLDER_PREFIX
  let maxSeq = 0

  for (const id of existingIds) {
    if (variant === 'manual' && id.startsWith(TEMP_AI_FOLDER_PREFIX)) {
      continue
    }
    if (!id.startsWith(prefix)) {
      continue
    }
    const suffix = id.slice(prefix.length)
    const parsed = Number.parseInt(suffix, 10)
    if (Number.isFinite(parsed)) {
      maxSeq = Math.max(maxSeq, parsed)
    }
  }

  return `${prefix}${maxSeq + 1}`
}

/**
 * 节点是否位于临时文件夹子树下
 *
 * @param options.aiOnly 为 true 时仅识别 temp_ai_* 子树（一键整理审计用）
 */
export function isNodeUnderTempFolderSubtree(
  nodeId: string,
  nodeMap: Map<string, TempFolderParentView>,
  options?: { aiOnly?: boolean }
): boolean {
  const matchPrefix = options?.aiOnly ? TEMP_AI_FOLDER_PREFIX : TEMP_FOLDER_PREFIX

  if (nodeId.startsWith(matchPrefix)) {
    return true
  }

  let current: string | undefined = nodeId
  const visited = new Set<string>()

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current.startsWith(matchPrefix)) {
      return true
    }
    const node = nodeMap.get(current)
    if (!node) {
      return false
    }
    const parentId = node.parentId ? String(node.parentId) : undefined
    if (!parentId || parentId === '0') {
      return false
    }
    if (options?.aiOnly && parentId === BOOKMARKS_BAR_ID) {
      return false
    }
    current = parentId
  }

  return false
}
