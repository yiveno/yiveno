/**
 * 核心：书签树工具（与 UI 解耦）
 *
 * 能力：
 * - 查找/插入/移除节点；
 * - 递归重建 index 字段，维持稳定顺序；
 *
 * 设计：
 * - 使用迭代/递归混合策略，兼顾可读性与性能；
 * - 保持纯函数签名，便于单元测试与复用。
 */

/**
 * 通用树节点接口
 *
 * 定义树形结构节点的最小约束，支持泛型扩展
 */
export interface GenericTreeNode {
  /** 节点唯一标识符 */
  id: string
  /** 节点标题 */
  title?: string
  /** 节点URL（如果是书签） */
  url?: string
  /** 父节点ID */
  parentId?: string
  /** 在父节点中的位置索引 */
  index?: number
  /** 子节点列表 */
  children?: GenericTreeNode[]
}

/**
 * 根据ID查找树节点及其父节点
 *
 * 使用迭代栈遍历算法，避免深度过大时的栈溢出
 *
 * @param nodes - 树节点数组
 * @param id - 目标节点ID
 * @returns 包含目标节点和其父节点的对象，未找到时返回 null
 */
export function findNodeById<T extends GenericTreeNode>(
  nodes: T[],
  id: string
): { node: T | null; parent: T | null } {
  const stack: Array<{ node: T; parent: T | null }> = []
  nodes.forEach(n => stack.push({ node: n, parent: null }))
  while (stack.length) {
    const { node, parent } = stack.pop() as { node: T; parent: T | null }
    if (node.id === id) return { node, parent }
    if (node.children)
      node.children.forEach(ch => stack.push({ node: ch as T, parent: node }))
  }
  return { node: null, parent: null }
}

/**
 * 根据ID从树中移除节点
 *
 * 递归遍历树，找到目标节点后从其父节点的子列表中移除
 *
 * @param nodes - 树节点数组
 * @param id - 要移除的节点ID
 * @returns 如果成功移除返回 true，未找到节点返回 false
 */
export function removeNodeById<T extends GenericTreeNode>(
  nodes: T[],
  id: string
): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (!n) continue

    if (n.id === id) {
      nodes.splice(i, 1)
      return true
    }
    if (n.children?.length) {
      const removed = removeNodeById(n.children as T[], id)
      if (removed) return true
    }
  }
  return false
}

/**
 * 将新节点插入到指定父节点的子列表中
 *
 * @param nodes - 树节点数组
 * @param parentId - 父节点ID
 * @param newNode - 要插入的新节点
 * @param index - 插入位置索引，默认为 0
 * @returns 如果成功插入返回 true，父节点不存在返回 false
 */
export function insertNodeToParent<T extends GenericTreeNode>(
  nodes: T[],
  parentId: string | undefined,
  newNode: T,
  index = 0
): boolean {
  if (!parentId) return false
  const { node: parent } = findNodeById(nodes, parentId)
  if (!parent) return false
  if (!parent.children) parent.children = []
  const clampedIndex = Math.max(0, Math.min(index, parent.children.length))
  ;(parent.children as T[]).splice(clampedIndex, 0, newNode)
  // 重建index字段，确保顺序一致
  parent.children.forEach((c, i) => (c.index = i))
  return true
}

/**
 * 递归重建所有节点的 index 字段
 *
 * 遍历整棵树，为每个节点设置正确的 index 值，确保树结构的顺序一致性
 *
 * @param nodes - 树节点数组
 */
export function rebuildIndexesRecursively<T extends GenericTreeNode>(
  nodes: T[]
) {
  nodes.forEach((n, i) => {
    n.index = i
    if (n.children) rebuildIndexesRecursively(n.children as T[])
  })
}
